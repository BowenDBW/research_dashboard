import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Collapse,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Bookmark as BookmarkIcon,
  History as HistoryIcon,
  Tune as TuneIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Folder as FolderIcon,
  InsertDriveFile as InsertDriveFileIcon,
  Chat as ChatIcon,
  Newspaper as NewspaperIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useDailyStore } from '../../stores/useDailyStore';
import { SubscriptionDialog } from '../common/SubscriptionDialog';
import { AbstractDialog } from '../article/AbstractDialog';
import { DailyReportDialog } from '../daily/DailyReportDialog';
import { FavoriteItem, Article } from '../../types';

interface RightToolbarProps {
  open: boolean;
  onToggle: () => void;
}

const TOOLBAR_WIDTH = 300;

// 递归渲染收藏夹项（最多三层）
const FavoriteItemRenderer = ({
  items,
  level = 0,
  expandedFolders,
  toggleFolder,
  onArticleClick,
}: {
  items: FavoriteItem[];
  level?: number;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  onArticleClick: (article: Article) => void;
}) => {
  if (level >= 3) return null;

  return (
    <>
      {items.map((item) => (
        <Box key={item.id}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              py: 0.5,
              px: 1 + level * 1.5,
              borderRadius: 1,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={() => {
              if (item.type === 'folder') {
                toggleFolder(item.id);
              } else if (item.article) {
                onArticleClick(item.article);
              }
            }}
          >
            {item.type === 'folder' ? (
              <>
                <FolderIcon sx={{ color: '#FFA726', fontSize: 18 }} />
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {item.name}
                </Typography>
                {item.children && item.children.length > 0 && (
                  expandedFolders.has(item.id) ? (
                    <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  ) : (
                    <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  )
                )}
              </>
            ) : (
              <>
                <InsertDriveFileIcon sx={{ color: '#42A5F5', fontSize: 18 }} />
                <Tooltip title={item.article?.title || ''} placement="top" arrow enterDelay={500}>
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.article?.title}
                  </Typography>
                </Tooltip>
              </>
            )}
          </Box>
          {item.type === 'folder' && item.children && item.children.length > 0 && (
            <Collapse in={expandedFolders.has(item.id)}>
              <FavoriteItemRenderer
                items={item.children}
                level={level + 1}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                onArticleClick={onArticleClick}
              />
            </Collapse>
          )}
        </Box>
      ))}
    </>
  );
};

export const RightToolbar = ({ open, onToggle }: RightToolbarProps) => {
  const navigate = useNavigate();
  const { items } = useFavoriteStore();
  const { records } = useHistoryStore();
  const { getRecentReports } = useDailyStore();
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [expandedPanels, setExpandedPanels] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [abstractDialogOpen, setAbstractDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedArticleFavorited, setSelectedArticleFavorited] = useState(false);
  const [historyType, setHistoryType] = useState<'reading' | 'chat'>('reading');
  const [dailyDialogOpen, setDailyDialogOpen] = useState(false);
  const [selectedDailyId, setSelectedDailyId] = useState<string | null>(null);

  const recentReports = getRecentReports();

  // Mock chat history data
  const chatHistory = [
    { id: 'ch1', mode: 'chat', title: '关于 Transformer 架构的讨论' },
    { id: 'ch2', mode: 'paper_search', title: '搜索注意力机制相关论文' },
    { id: 'ch3', mode: 'chapter_summary', title: 'Attention Is All You Need 总结' },
    { id: 'ch4', mode: 'chat', title: 'GPT-4 与 Claude 对比' },
    { id: 'ch5', mode: 'paper_search', title: '检索深度学习优化方法' },
  ];

  const getChatModeIcon = (mode: string) => {
    switch (mode) {
      case 'chat':
        return <ChatIcon sx={{ fontSize: 16 }} />;
      default:
        return <InsertDriveFileIcon sx={{ fontSize: 16 }} />;
    }
  };

  const handlePanelToggle = (panel: string) => {
    setExpandedPanels((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]
    );
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
    setSelectedArticleFavorited(article.isFavorited);
    setAbstractDialogOpen(true);
  };

  const handleAbstractDialogClose = () => {
    setAbstractDialogOpen(false);
    setSelectedArticle(null);
  };

  const handleFavoriteChange = (isFavorited: boolean) => {
    setSelectedArticleFavorited(isFavorited);
  };

  const handleDailyClick = (id: string) => {
    setSelectedDailyId(id);
    setDailyDialogOpen(true);
  };

  const handleDailyDialogClose = () => {
    setDailyDialogOpen(false);
    setSelectedDailyId(null);
  };

  // Get recent history (last 7 days)
  const recentRecords = records.slice(0, 5);

  if (!open) {
    return (
      <Box sx={{ position: 'relative', width: 0, pointerEvents: 'none' }}>
        <IconButton
          onClick={onToggle}
          sx={{
            position: 'absolute',
            left: -16,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1200,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            boxShadow: 1,
            width: 24,
            height: 24,
            '&:hover': { bgcolor: 'action.hover' },
            pointerEvents: 'auto',
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', pointerEvents: 'none' }}>
      <Box
        sx={{
          width: TOOLBAR_WIDTH,
          flexShrink: 0,
          borderLeft: 1,
          borderColor: 'divider',
          height: '100vh',
          overflow: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          scrollbarGutter: 'stable',
        }}
      >
        {/* Claw Daily - First */}
        <Accordion
          expanded={expandedPanels.includes('daily')}
          onChange={() => handlePanelToggle('daily')}
          sx={{ borderRadius: 0, margin: 0, marginTop: '0 !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NewspaperIcon fontSize="small" sx={{ color: '#C5E1A5' }} />
                <Typography variant="subtitle2">Claw 日报</Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/daily');
                }}
              >
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, px: 0.5, maxHeight: 200, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {recentReports.map((report) => (
                <Box
                  key={report.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 0.5,
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => handleDailyClick(report.id)}
                >
                  <CalendarIcon sx={{ color: '#9CCC65', fontSize: 16, mt: 0.25 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {report.date}
                    </Typography>
                    <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.title}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Favorites Tree */}
        <Accordion
          expanded={expandedPanels.includes('favorites')}
          onChange={() => handlePanelToggle('favorites')}
          sx={{ borderRadius: 0, margin: 0, marginTop: '0 !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BookmarkIcon fontSize="small" sx={{ color: '#BBDEFB' }} />
                <Typography variant="subtitle2">收藏夹</Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/favorites');
                }}
              >
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, px: 0.5, maxHeight: 200, overflow: 'auto' }}>
            <FavoriteItemRenderer
              items={items}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onArticleClick={handleArticleClick}
            />
          </AccordionDetails>
        </Accordion>

        {/* History */}
        <Accordion
          expanded={expandedPanels.includes('history')}
          onChange={() => handlePanelToggle('history')}
          sx={{ borderRadius: 0, margin: 0, marginTop: '0 !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <HistoryIcon fontSize="small" sx={{ color: '#FFCDD2' }} />
              <Typography variant="subtitle2">历史记录</Typography>
              <ToggleButtonGroup
                value={historyType}
                exclusive
                onChange={(_, newValue) => {
                  if (newValue) {
                    newValue && setHistoryType(newValue);
                  }
                }}
                size="small"
                onClick={(e) => e.stopPropagation()}
              >
                <ToggleButton value="reading" sx={{ px: 1, py: 0.25, fontSize: '0.65rem' }}>
                  阅读
                </ToggleButton>
                <ToggleButton value="chat" sx={{ px: 1, py: 0.25, fontSize: '0.65rem' }}>
                  对话
                </ToggleButton>
              </ToggleButtonGroup>
              <Box sx={{ flex: 1 }} />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/history');
                }}
              >
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, px: 0.5, maxHeight: 200, overflow: 'auto' }}>
            {historyType === 'reading' ? (
              /* Reading History */
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {recentRecords.map((record) => (
                  <Box
                    key={record.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      py: 0.5,
                      px: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => handleArticleClick(record.article)}
                  >
                    <InsertDriveFileIcon sx={{ color: '#42A5F5', fontSize: 18 }} />
                    <Tooltip title={record.article.title} placement="top" arrow enterDelay={500}>
                      <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {record.article.title}
                      </Typography>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            ) : (
              /* Chat History */
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {chatHistory.map((chat) => (
                  <Box
                    key={chat.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      py: 0.5,
                      px: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => navigate(`/?sessionId=${chat.id}`)}
                  >
                    {getChatModeIcon(chat.mode)}
                    <Tooltip title={chat.title} placement="top" arrow enterDelay={500}>
                      <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chat.title}
                      </Typography>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Subscription Settings */}
        <Accordion
          expanded={expandedPanels.includes('subscription')}
          onChange={() => handlePanelToggle('subscription')}
          sx={{ borderRadius: 0, margin: 0, marginTop: '0 !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneIcon fontSize="small" sx={{ color: '#B39DDB' }} />
              <Typography variant="subtitle2">订阅设置</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, maxHeight: 200, overflow: 'auto' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              点击下方按钮管理订阅的关键词和作者
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label="cs.LG" size="small" />
              <Chip label="transformer" size="small" />
            </Box>
            <Box sx={{ mt: 1 }}>
              <Chip label="Yann LeCun" size="small" variant="outlined" />
            </Box>
            <IconButton
              onClick={() => setSubscriptionDialogOpen(true)}
              sx={{ mt: 1 }}
            >
              <TuneIcon />
              <Typography sx={{ ml: 1 }}>编辑订阅</Typography>
            </IconButton>
          </AccordionDetails>
        </Accordion>

        <SubscriptionDialog
          open={subscriptionDialogOpen}
          onClose={() => setSubscriptionDialogOpen(false)}
        />
      </Box>

      {/* Abstract Dialog */}
      <AbstractDialog
        open={abstractDialogOpen}
        article={selectedArticle}
        isFavorited={selectedArticleFavorited}
        onClose={handleAbstractDialogClose}
        onFavoriteChange={handleFavoriteChange}
      />

      {/* Daily Report Dialog */}
      <DailyReportDialog
        open={dailyDialogOpen}
        reportId={selectedDailyId}
        onClose={handleDailyDialogClose}
      />

      {/* Toggle Button */}
      <IconButton
        onClick={onToggle}
        sx={{
          position: 'absolute',
          left: -16,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1200,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          boxShadow: 1,
          width: 24,
          height: 24,
          '&:hover': { bgcolor: 'action.hover' },
          pointerEvents: 'auto',
        }}
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};