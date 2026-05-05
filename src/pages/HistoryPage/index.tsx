import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Chip,
  Pagination,
  Paper,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useHistory } from '../../hooks';
import { useChat } from '../../hooks';
import { AbstractDialog } from '../../components/article/AbstractDialog';
import { useTranslation } from 'react-i18next';
import { Article } from '../../types';

const ALL_ACTIONS = ['view_abstract', 'view_source', 'favorite', 'download'];
const CHAT_MODES = ['chat', 'paper_search', 'chapter_summary'];

const HistoryPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { records, totalCount, page, pageSize, updateFilters, updatePage } = useHistory();
  const { sessions, messages } = useChat();
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(dayjs().subtract(7, 'day'));
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [historyType, setHistoryType] = useState<'reading' | 'chat'>('reading');
  const [showActionFilter, setShowActionFilter] = useState(false);
  const [showChatModeFilter, setShowChatModeFilter] = useState(false);
  const [selectedActions, setSelectedActions] = useState<string[]>([...ALL_ACTIONS]);
  const [selectedChatModes, setSelectedChatModes] = useState<string[]>([...CHAT_MODES]);
  const [deduplicate, setDeduplicate] = useState(false);
  const [abstractDialogOpen, setAbstractDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // 筛选条件变化时更新 filters（会自动重置页码并获取数据）
  useEffect(() => {
    if (historyType === 'reading') {
      updateFilters({
        dateRange: [
          startDate ? startDate.format('YYYY-MM-DD') : null,
          endDate ? endDate.format('YYYY-MM-DD') : null,
        ],
        actions: showActionFilter ? selectedActions : [],
      });
    }
  }, [historyType, startDate, endDate, showActionFilter, selectedActions, updateFilters]);

  // 页面可见时刷新数据
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && historyType === 'reading') {
        // 通过更新 filters 来触发刷新，保持当前筛选条件
        updateFilters({
          dateRange: [
            startDate ? startDate.format('YYYY-MM-DD') : null,
            endDate ? endDate.format('YYYY-MM-DD') : null,
          ],
          actions: showActionFilter ? selectedActions : [],
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [historyType, startDate, endDate, showActionFilter, selectedActions, updateFilters]);

  const handleHistoryTypeChange = (_: React.MouseEvent<HTMLElement>, newValue: 'reading' | 'chat' | null) => {
    if (newValue) {
      setHistoryType(newValue);
      // 切换类型时重置筛选
      if (newValue === 'reading') {
        setShowActionFilter(false);
        setSelectedActions([...ALL_ACTIONS]);
      } else {
        setShowChatModeFilter(false);
        setSelectedChatModes([...CHAT_MODES]);
      }
    }
  };

  const handleActionToggle = (action: string) => {
    setSelectedActions((prev) => {
      const newActions = prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action];
      return newActions;
    });
  };

  const handleShowActionFilterChange = (show: boolean) => {
    setShowActionFilter(show);
    if (show) {
      setSelectedActions([...ALL_ACTIONS]);
    } else {
      setSelectedActions([]);
    }
  };

  const handleChatModeToggle = (mode: string) => {
    setSelectedChatModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'view_abstract':
        return t('history.actions.view_abstract');
      case 'view_source':
        return t('history.actions.view_source');
      case 'favorite':
        return t('history.actions.favorite');
      case 'download':
        return t('history.actions.download');
      default:
        return action;
    }
  };

  const getChatModeLabel = (mode: string) => {
    switch (mode) {
      case 'chat':
        return t('history.chatModes.chat');
      case 'paper_search':
        return t('history.chatModes.paper_search');
      case 'chapter_summary':
        return t('history.chatModes.chapter_summary');
      default:
        return mode;
    }
  };

  // Group records by date, with optional deduplication
  const groupedRecords = records.reduce((acc, record) => {
    const date = new Date(record.timestamp).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as Record<string, typeof records>);

  // Deduplicate: keep only the most recent record for each article per day
  const deduplicatedGroupedRecords = deduplicate
    ? Object.fromEntries(
        Object.entries(groupedRecords).map(([date, dateRecords]) => {
          const uniqueArticles = new Map<string, typeof dateRecords[0]>();
          // Sort by timestamp descending, then keep first occurrence of each article
          dateRecords
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .forEach((record) => {
              if (!uniqueArticles.has(record.articleId)) {
                uniqueArticles.set(record.articleId, record);
              }
            });
          return [date, Array.from(uniqueArticles.values())];
        })
      )
    : groupedRecords;

  // Get chat sessions with messages (most recent first)
  const chatHistory = sessions
    .filter(session => messages[session.id] && messages[session.id].length > 0)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(session => ({
      id: session.id,
      mode: session.mode,
      title: session.title,
      timestamp: session.updatedAt,
      messageCount: messages[session.id]?.length || 0,
    }));

  const filteredChatHistory = chatHistory.filter((chat) => selectedChatModes.includes(chat.mode));

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'background.paper' }}>
          <Toolbar sx={{ gap: 2 }}>
            <IconButton onClick={() => navigate('/')} size="small">
              <ArrowBackIcon />
            </IconButton>
            <ToggleButtonGroup
              value={historyType}
              exclusive
              onChange={handleHistoryTypeChange}
              size="small"
              sx={{ ml: 1 }}
            >
              <ToggleButton value="reading">{t('history.readingHistory')}</ToggleButton>
              <ToggleButton value="chat">{t('history.chatHistory')}</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ width: 150 }}>
              <MuiDatePicker
                label={t('articles.startDate')}
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Box>
            <Box sx={{ width: 150 }}>
              <MuiDatePicker
                label={t('articles.endDate')}
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Box>
            <Tooltip title={historyType === 'reading' ? t('history.actionType') : t('history.chatMode')} arrow>
              <ToggleButton
                value="filter"
                selected={historyType === 'reading' ? showActionFilter : showChatModeFilter}
                onChange={() => {
                  if (historyType === 'reading') {
                    handleShowActionFilterChange(!showActionFilter);
                  } else {
                    setShowChatModeFilter(!showChatModeFilter);
                    if (!showChatModeFilter) {
                      setSelectedChatModes([...CHAT_MODES]);
                    } else {
                      setSelectedChatModes([]);
                    }
                  }
                }}
                size="small"
              >
                {t('history.filter')}
              </ToggleButton>
            </Tooltip>
          </Toolbar>

          {/* 阅读历史 - 操作类型筛选 */}
          {historyType === 'reading' && showActionFilter && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, px: 2, py: 0.5, minHeight: 32 }}>
              <Typography variant="body2" color="text.secondary">
                {t('history.actionType')}:
              </Typography>
              {ALL_ACTIONS.map((action) => (
                <Chip
                  key={action}
                  label={getActionLabel(action)}
                  size="small"
                  onClick={() => handleActionToggle(action)}
                  color={selectedActions.includes(action) ? 'primary' : 'default'}
                  variant={selectedActions.includes(action) ? 'filled' : 'outlined'}
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              ))}
              <Chip
                label={t('history.deduplicate')}
                size="small"
                onClick={() => setDeduplicate(!deduplicate)}
                color={deduplicate ? 'secondary' : 'default'}
                variant={deduplicate ? 'filled' : 'outlined'}
                sx={{ height: 22, fontSize: '0.7rem', ml: 1 }}
              />
            </Box>
          )}

          {/* 对话历史 - 对话类型筛选 */}
          {historyType === 'chat' && showChatModeFilter && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, px: 2, py: 0.5, minHeight: 32 }}>
              <Typography variant="body2" color="text.secondary">
                {t('history.chatMode')}:
              </Typography>
              {CHAT_MODES.map((mode) => (
                <Chip
                  key={mode}
                  label={getChatModeLabel(mode)}
                  size="small"
                  onClick={() => handleChatModeToggle(mode)}
                  color={selectedChatModes.includes(mode) ? 'primary' : 'default'}
                  variant={selectedChatModes.includes(mode) ? 'filled' : 'outlined'}
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              ))}
            </Box>
          )}
        </AppBar>

        {/* Content */}
        <Container maxWidth="lg" sx={{ flex: 1, py: 1, overflow: 'auto' }}>
          {historyType === 'reading' ? (
            /* Reading History Timeline */
            <Timeline
              position="right"
              sx={{
                '& .MuiTimelineItem-root:before': { flex: 0, padding: 0 },
                '& .MuiTimelineContent-root': { flex: 0, minWidth: 600, maxWidth: 600 },
              }}
            >
              {Object.entries(deduplicatedGroupedRecords).map(([date, dateRecords]) => (
                <TimelineItem key={date}>
                  <TimelineSeparator>
                    <TimelineDot color="primary" />
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      {date}
                    </Typography>
                    {dateRecords.map((record) => (
                      <Paper
                        key={record.id}
                        elevation={0}
                        onClick={() => {
                          setSelectedArticle(record.article);
                          setAbstractDialogOpen(true);
                        }}
                        sx={{
                          mb: 0.5,
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 1,
                          bgcolor: 'background.paper',
                          border: 1,
                          borderColor: 'divider',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                          width: '100%',
                          boxSizing: 'border-box',
                          '&:hover': {
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        {/* 单行布局 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 24 }}>
                          <Chip
                            label={`${new Date(record.timestamp).toLocaleTimeString()} | ${getActionLabel(record.action)}`}
                            size="small"
                            sx={{ flexShrink: 0, height: 20, fontSize: '0.65rem' }}
                          />
                          <Chip
                            label={record.article.source}
                            size="small"
                            variant="outlined"
                            sx={{ flexShrink: 0, height: 20, fontSize: '0.65rem' }}
                          />
                          <Tooltip title={record.article.title} arrow enterDelay={500}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: 500,
                                flex: 1,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {record.article.title}
                            </Typography>
                          </Tooltip>
                          <Tooltip title={t('article.aiSummary')} arrow>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/?tab=summary&articleId=${record.article.id}`);
                              }}
                              color="secondary"
                              sx={{ p: 0, '&:hover': { bgcolor: 'transparent' }, flexShrink: 0 }}
                            >
                              <AutoAwesomeIcon sx={{ fontSize: 18 }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, ml: 0.25 }}>
                                {t('article.askAI')}
                              </Typography>
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    ))}
                  </TimelineContent>
                </TimelineItem>
              ))}
              {records.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">{t('history.noReadingHistory')}</Typography>
                </Box>
              )}
            </Timeline>
          ) : (
            /* Chat History Timeline */
            <Timeline
              position="right"
              sx={{
                '& .MuiTimelineItem-root:before': { flex: 0, padding: 0 },
                '& .MuiTimelineContent-root': { flex: 0, minWidth: 600, maxWidth: 600 },
              }}
            >
              {Object.entries(
                filteredChatHistory.reduce((acc, chat) => {
                  const date = new Date(chat.timestamp).toLocaleDateString();
                  if (!acc[date]) {
                    acc[date] = [];
                  }
                  acc[date].push(chat);
                  return acc;
                }, {} as Record<string, typeof filteredChatHistory>)
              ).map(([date, dateChats]) => (
                <TimelineItem key={date}>
                  <TimelineSeparator>
                    <TimelineDot color="secondary" />
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      {date}
                    </Typography>
                    {dateChats.map((chat) => (
                      <Paper
                        key={chat.id}
                        sx={{
                          mb: 0.5,
                          p: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={() => navigate(`/?sessionId=${chat.id}`)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={getChatModeLabel(chat.mode)}
                            size="small"
                            color={chat.mode === 'chat' ? 'primary' : chat.mode === 'paper_search' ? 'secondary' : 'info'}
                            sx={{ height: 20, fontSize: '0.65rem', flexShrink: 0 }}
                          />
                          <Tooltip title={chat.title} arrow enterDelay={500}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: 500,
                                flex: 1,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {chat.title}
                            </Typography>
                          </Tooltip>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {new Date(chat.timestamp).toLocaleTimeString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {chat.messageCount} {t('history.messages')}
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </TimelineContent>
                </TimelineItem>
              ))}
              {filteredChatHistory.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">{t('history.noChatHistory')}</Typography>
                </Box>
              )}
            </Timeline>
          )}
        </Container>

        {/* Pagination - Fixed at bottom */}
        <Paper sx={{ px: 3, py: 1.5, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={Math.ceil(totalCount / pageSize)}
              page={page}
              onChange={(_, newPage) => updatePage(newPage)}
              color="primary"
            />
          </Box>
        </Paper>

        {/* Abstract Dialog */}
        <AbstractDialog
          open={abstractDialogOpen}
          article={selectedArticle}
          onClose={() => setAbstractDialogOpen(false)}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default HistoryPage;