import { useState } from 'react';
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
import { useHistoryStore } from '../../stores/useHistoryStore';
import { ArticleActions } from '../../components/article/ArticleActions';

const ALL_ACTIONS = ['view_abstract', 'view_source', 'favorite', 'download'];
const CHAT_MODES = ['chat', 'paper_search', 'chapter_summary'];

const HistoryPage = () => {
  const navigate = useNavigate();
  const { records, setFilters } = useHistoryStore();
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(dayjs().subtract(7, 'day'));
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [historyType, setHistoryType] = useState<'reading' | 'chat'>('reading');
  const [showActionFilter, setShowActionFilter] = useState(false);
  const [showChatModeFilter, setShowChatModeFilter] = useState(false);
  const [selectedActions, setSelectedActions] = useState<string[]>([...ALL_ACTIONS]);
  const [selectedChatModes, setSelectedChatModes] = useState<string[]>([...CHAT_MODES]);

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
      setFilters({ actions: newActions });
      return newActions;
    });
  };

  const handleShowActionFilterChange = (show: boolean) => {
    setShowActionFilter(show);
    if (show) {
      setSelectedActions([...ALL_ACTIONS]);
      setFilters({ actions: [...ALL_ACTIONS] });
    } else {
      setSelectedActions([]);
      setFilters({ actions: [] });
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
        return '摘要';
      case 'view_source':
        return '链接';
      case 'favorite':
        return '收藏';
      case 'download':
        return '下载';
      default:
        return action;
    }
  };

  const getChatModeLabel = (mode: string) => {
    switch (mode) {
      case 'chat':
        return '对话';
      case 'paper_search':
        return '搜索';
      case 'chapter_summary':
        return '总结';
      default:
        return mode;
    }
  };

  // Group records by date
  const groupedRecords = records.reduce((acc, record) => {
    const date = new Date(record.timestamp).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as Record<string, typeof records>);

  // Mock chat history data
  const chatHistory = [
    {
      id: 'ch1',
      mode: 'chat',
      title: '关于 Transformer 架构的讨论',
      timestamp: new Date().toISOString(),
      messageCount: 12,
    },
    {
      id: 'ch2',
      mode: 'paper_search',
      title: '搜索注意力机制相关论文',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      messageCount: 8,
    },
    {
      id: 'ch3',
      mode: 'chapter_summary',
      title: 'Attention Is All You Need 总结',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      messageCount: 5,
    },
  ];

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
              <ToggleButton value="reading">阅读历史</ToggleButton>
              <ToggleButton value="chat">对话历史</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ width: 150 }}>
              <MuiDatePicker
                label="开始"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Box>
            <Box sx={{ width: 150 }}>
              <MuiDatePicker
                label="结束"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Box>
            <Tooltip title={historyType === 'reading' ? '筛选操作类型' : '筛选对话类型'} arrow>
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
                筛选
              </ToggleButton>
            </Tooltip>
          </Toolbar>

          {/* 阅读历史 - 操作类型筛选 */}
          {historyType === 'reading' && showActionFilter && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, px: 2, py: 0.5, minHeight: 32 }}>
              <Typography variant="body2" color="text.secondary">
                操作类型:
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
            </Box>
          )}

          {/* 对话历史 - 对话类型筛选 */}
          {historyType === 'chat' && showChatModeFilter && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, px: 2, py: 0.5, minHeight: 32 }}>
              <Typography variant="body2" color="text.secondary">
                对话类型:
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
                '& .MuiTimelineContent-root': { flex: 1 },
              }}
            >
              {Object.entries(groupedRecords).map(([date, dateRecords]) => (
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
                      <Box
                        key={record.id}
                        sx={{
                          mb: 0.5,
                          px: 1.5,
                          py: 1,
                          borderRadius: 1,
                          bgcolor: 'background.paper',
                          border: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {/* 第一行 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
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
                          <Typography variant="subtitle2" sx={{ fontWeight: 500 }} noWrap>
                            {record.article.title}
                          </Typography>
                          <Tooltip title="AI 总结" arrow>
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/?tab=summary&articleId=${record.article.id}`)}
                              color="secondary"
                              sx={{ p: 0, '&:hover': { bgcolor: 'transparent' }, flexShrink: 0 }}
                            >
                              <AutoAwesomeIcon sx={{ fontSize: 18 }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, ml: 0.25 }}>
                                ASK AI
                              </Typography>
                            </IconButton>
                          </Tooltip>
                          <Box sx={{ flex: 1 }} />
                        </Box>
                        {/* 第二行：作者 + 功能按钮 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, mr: 1 }}>
                            {record.article.authors.join(', ')}
                          </Typography>
                          <ArticleActions article={record.article} compact />
                        </Box>
                      </Box>
                    ))}
                  </TimelineContent>
                </TimelineItem>
              ))}
              {records.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">暂无阅读历史记录</Typography>
                </Box>
              )}
            </Timeline>
          ) : (
            /* Chat History Timeline */
            <Timeline
              position="right"
              sx={{
                '& .MuiTimelineItem-root:before': { flex: 0, padding: 0 },
                '& .MuiTimelineContent-root': { flex: 1 },
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
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 500 }} noWrap>
                            {chat.title}
                          </Typography>
                          <Box sx={{ flex: 1 }} />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(chat.timestamp).toLocaleTimeString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {chat.messageCount} 条
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </TimelineContent>
                </TimelineItem>
              ))}
              {filteredChatHistory.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">暂无对话历史记录</Typography>
                </Box>
              )}
            </Timeline>
          )}
        </Container>

        {/* Pagination - Fixed at bottom */}
        <Paper sx={{ px: 3, py: 1.5, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Pagination count={1} color="primary" />
          </Box>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default HistoryPage;