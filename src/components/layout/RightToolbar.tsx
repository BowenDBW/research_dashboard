import { useState, useEffect, useRef } from 'react';
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
  ToggleButtonGroup,
  ToggleButton,
  alpha,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Slider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  ExpandMore as ExpandMoreIcon,
  Bookmark as BookmarkIcon,
  History as HistoryIcon,
  Tune as TuneIcon,
  ChevronLeft as ChevronLeftIcon,
  Folder as FolderIcon,
  InsertDriveFile as InsertDriveFileIcon,
  Chat as ChatIcon,
  Newspaper as NewspaperIcon,
  CalendarToday as CalendarIcon,
  Search as SearchIcon,
  Summarize as SummarizeIcon,
  BarChart as BarChartIcon,
  DragIndicator as DragIndicatorIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  MenuBook as MenuBookIcon,
  Done as DoneIcon,
  CloudDownload as CloudDownloadIcon,
  Schedule as ScheduleIcon,
  Storage as StorageIcon,
  ArrowUpward as ArrowUpwardIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFavoritesStore, useHistoryStore, useDailyStore, useStatsStore, useSubscriptionStore, useChat } from '../../stores';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { DailyRecommendationDialog } from '../daily/DailyRecommendationDialog';
import { SubscriptionDialog } from '../common/SubscriptionDialog';
import { AbstractDialog } from '../article/AbstractDialog';
import { CategorySelectDialog } from '../common/CategorySelectDialog';
import { FavoriteItem, Article, HeatmapCell } from '../../types';
import { MonthlyHeatmap } from '../stats/MonthlyHeatmap';
import { getCategoryByCode } from '../../constants/academicCategories';
import { useTranslation } from 'react-i18next';

interface RightToolbarProps {
  open: boolean;
  onToggle: () => void;
}

const TOOLBAR_WIDTH = 300;
const TRANSITION_DURATION = 200; // ms

// Panel IDs
const DEFAULT_PANEL_ORDER = ['arxiv', 'daily', 'favorites', 'history', 'stats', 'subscription'] as const;
type PanelId = typeof DEFAULT_PANEL_ORDER[number];

// Panel configuration with route info - labels will be set dynamically
const PANEL_CONFIG: Record<PanelId, { icon: React.ReactNode; labelKey: string; route?: string }> = {
  arxiv: { icon: <CloudDownloadIcon fontSize="small" sx={{ color: '#FF7043' }} />, labelKey: 'rightToolbar.arxivCrawler' },
  daily: { icon: <NewspaperIcon fontSize="small" sx={{ color: '#C5E1A5' }} />, labelKey: 'dailyReport.recommendations', route: '/daily' },
  favorites: { icon: <BookmarkIcon fontSize="small" sx={{ color: '#BBDEFB' }} />, labelKey: 'rightToolbar.favorites', route: '/favorites' },
  history: { icon: <HistoryIcon fontSize="small" sx={{ color: '#FFCDD2' }} />, labelKey: 'history.title', route: '/history' },
  stats: { icon: <BarChartIcon fontSize="small" sx={{ color: '#4CAF50' }} />, labelKey: 'stats.title', route: '/stats' },
  subscription: { icon: <TuneIcon fontSize="small" sx={{ color: '#B39DDB' }} />, labelKey: 'subscription.title' },
};

// 渲染收藏夹项（单层，点击文件夹进入子文件夹）
const FavoriteItemRenderer = ({
  items,
  onFolderClick,
  onArticleClick,
}: {
  items: FavoriteItem[];
  onFolderClick: (folderId: string) => void;
  onArticleClick: (article: Article) => void;
}) => {
  return (
    <>
      {items.map((item) => (
        <Box
          key={`${item.type}-${item.id}`}
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
          onClick={() => {
            if (item.type === 'folder') {
              onFolderClick(item.id);
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
              <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
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
      ))}
    </>
  );
};

// Sortable Panel Component
interface SortablePanelProps {
  id: PanelId;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  summaryContent: React.ReactNode;
  isEditMode: boolean;
  hidden: boolean;
}

const SortablePanel = ({
  id,
  isExpanded,
  onToggle,
  children,
  summaryContent,
  isEditMode,
  hidden,
}: SortablePanelProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    display: hidden ? 'none' : 'block',
  };

  return (
    <Box ref={setNodeRef} style={style}>
      <Accordion
        expanded={isExpanded}
        onChange={onToggle}
        sx={{
          borderRadius: 0,
          margin: 0,
          marginTop: '0 !important',
          '&:before': { display: 'none' },
          bgcolor: isDragging ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'background.paper',
          boxShadow: isDragging ? 2 : 0,
          userSelect: 'none',
        }}
      >
        <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            {isEditMode && (
              <Box
                {...attributes}
                {...listeners}
                sx={{
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  mr: 0.5,
                  color: 'text.disabled',
                  '&:hover': { color: 'text.secondary' },
                  '&:active': { cursor: 'grabbing' },
                }}
              >
                <DragIndicatorIcon fontSize="small" />
              </Box>
            )}
            {summaryContent}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, px: 1 }}>
          {children}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export const RightToolbar = ({ open, onToggle }: RightToolbarProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items, folderPath, navigateToFolder } = useFavoritesStore();
  const { records } = useHistoryStore();
  const { recommendations, fetchRecommendations } = useDailyStore();
  const { sessions, messages, switchSession, fetchSessions } = useChat();
  const { settings, updateSettings, loadSettings } = useSettingsStore();
  const { todayStats, fetchTodayStats, statsData, fetchStats } = useStatsStore();
  const { authors, categories, keywords, loadSubscriptions } = useSubscriptionStore();
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [expandedPanels, setExpandedPanels] = useState<string[]>([]);
  const [abstractDialogOpen, setAbstractDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedArticleFavorited, setSelectedArticleFavorited] = useState(false);
  const [historyType, setHistoryType] = useState<'reading' | 'chat'>('reading');
  const [recommendationDialogOpen, setRecommendationDialogOpen] = useState(false);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  // Edit mode and panel visibility state
  const [isEditMode, setIsEditMode] = useState(false);
  const [panelOrder, setPanelOrder] = useState<PanelId[]>([...DEFAULT_PANEL_ORDER]);
  const [hiddenPanels, setHiddenPanels] = useState<Set<PanelId>>(new Set());
  const [savedOrder, setSavedOrder] = useState<PanelId[] | null>(null);
  const [savedHidden, setSavedHidden] = useState<Set<PanelId> | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // Quick preview dialog state (for collapsed toolbar)
  const [quickPreviewPanel, setQuickPreviewPanel] = useState<PanelId | null>(null);

  // Transition state for animation
  const [showContent, setShowContent] = useState(open);
  const prevOpenRef = useRef(open);

  // Track transition state - hide content during transition, show after complete
  useEffect(() => {
    if (prevOpenRef.current !== open) {
      // Toggle started - hide content immediately
      setShowContent(false);
      // Show content after transition completes
      const timer = setTimeout(() => {
        setShowContent(open);
      }, TRANSITION_DURATION);
      prevOpenRef.current = open;
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Fetch data on mount
  useEffect(() => {
    // Initialize data fetching for sidebar panels
    loadSettings();
    navigateToFolder(null); // Load favorites root folder
    // useHistory 自动获取数据，不需要手动调用
    fetchRecommendations(1, 10); // Fetch daily recommendations
    fetchSessions();
    fetchTodayStats();
    // Fetch stats data for sidebar - get current month data
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];
    fetchStats(startDate, endDate);
    loadSubscriptions();
  }, []);

  // Fill missing days in heatmap data for current month (always show FULL month, 28-31 days)
  const fillMissingDaysInHeatmap = (data: HeatmapCell[]): HeatmapCell[] => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Get total days in this month (28, 29, 30, or 31)
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    const filledData: HeatmapCell[] = [];
    const dataMap = new Map(data.map(d => [d.date, d]));

    // Fill ALL days of the month, including future days (count=0 for future)
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const existingData = dataMap.get(dateStr);
      if (existingData) {
        filledData.push(existingData);
      } else {
        filledData.push({ date: dateStr, count: 0, level: 0 });
      }
    }

    return filledData;
  };

  // Get recent recommendations from state (first 5)
  const recentRecommendations = recommendations.slice(0, 5);

  const handleCrawlIntervalChange = (_: Event, value: number | number[]) => {
    updateSettings({ crawlIntervalHours: value as number });
  };

  const handleCategoriesChange = (categories: string[]) => {
    updateSettings({ crawlerCategories: categories });
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get chat sessions with messages (most recent first)
  const chatHistory = sessions
    .filter(session => messages[session.id] && messages[session.id].length > 0)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const getChatModeIcon = (mode: string) => {
    switch (mode) {
      case 'chat':
        return <ChatIcon sx={{ fontSize: 16 }} />;
      case 'paper_search':
        return <SearchIcon sx={{ fontSize: 16 }} />;
      case 'chapter_summary':
        return <SummarizeIcon sx={{ fontSize: 16 }} />;
      default:
        return <InsertDriveFileIcon sx={{ fontSize: 16 }} />;
    }
  };

  const handlePanelToggle = (panel: string) => {
    setExpandedPanels((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]
    );
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

  const handleRecommendationClick = (id: string) => {
    setSelectedRecommendationId(id);
    setRecommendationDialogOpen(true);
  };

  const handleRecommendationDialogClose = () => {
    setRecommendationDialogOpen(false);
    setSelectedRecommendationId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPanelOrder((items) => {
        const oldIndex = items.indexOf(active.id as PanelId);
        const newIndex = items.indexOf(over.id as PanelId);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Edit mode handlers
  const handleEnterEditMode = () => {
    setSavedOrder([...panelOrder]);
    setSavedHidden(new Set(hiddenPanels));
    setIsEditMode(true);
    handleCloseContextMenu();
  };

  const handleExitEditMode = (save: boolean) => {
    if (!save && savedOrder && savedHidden) {
      setPanelOrder(savedOrder);
      setHiddenPanels(savedHidden);
    }
    setSavedOrder(null);
    setSavedHidden(null);
    setIsEditMode(false);
  };

  // Panel visibility handlers
  const handleTogglePanelVisibility = (panelId: PanelId) => {
    setHiddenPanels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(panelId)) {
        newSet.delete(panelId);
      } else {
        newSet.add(panelId);
      }
      return newSet;
    });
  };

  // Get recent history (last 7 days)
  const recentRecords = records.slice(0, 5);

  // Panel content renderers
  const renderPanelContent = (panelId: PanelId) => {
    switch (panelId) {
      case 'arxiv':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Crawler Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {t('rightToolbar.lastCrawl')}:
                </Typography>
                <Typography variant="body2">
                  {settings.lastCrawlTime
                    ? new Date(settings.lastCrawlTime).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StorageIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {t('rightToolbar.totalArticles')}:
              </Typography>
              <Typography variant="body2">
                {todayStats?.totalPaperCount?.toLocaleString() || 0} {t('rightToolbar.articlesCount')}
              </Typography>
            </Box>

            <Divider />

            {/* Crawler Categories */}
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                {t('rightToolbar.crawlCategories')} ({settings.crawlerCategories.length} {t('rightToolbar.categoriesSelected')})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 80, overflow: 'auto' }}>
                {settings.crawlerCategories.slice(0, 6).map((code) => {
                  const cat = getCategoryByCode(code);
                  return (
                    <Chip
                      key={code}
                      label={cat?.name || code}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  );
                })}
                {settings.crawlerCategories.length > 6 && (
                  <Chip
                    label={`+${settings.crawlerCategories.length - 6}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => setCategoryDialogOpen(true)}
                sx={{ mt: 0.5, fontSize: '0.7rem' }}
              >
                {t('rightToolbar.editCategories')}
              </Button>
            </Box>

            {/* Crawl Interval */}
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                {t('rightToolbar.crawlFrequency')}: {settings.crawlIntervalHours} {t('rightToolbar.hours')}
              </Typography>
              <Slider
                value={settings.crawlIntervalHours}
                onChange={handleCrawlIntervalChange}
                min={1}
                max={24}
                step={1}
                marks
                valueLabelDisplay="auto"
                size="small"
              />
            </Box>

            {/* Refresh Button */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              fullWidth
              sx={{ mt: 0.5 }}
              onClick={() => {
                // Simulate an update to the last crawl time when clicking Refresh
                updateSettings({ lastCrawlTime: new Date().toISOString().slice(0, 16).replace('T', ' ') });
              }}
            >
              {t('rightToolbar.crawlNow')}
            </Button>
          </Box>
        );

      case 'daily':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 200, overflow: 'auto' }}>
            {recentRecommendations.map((rec) => (
              <Box
                key={rec.id}
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
                onClick={() => handleRecommendationClick(rec.id)}
              >
                <CalendarIcon sx={{ color: '#9CCC65', fontSize: 16 }} />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {rec.date}
                </Typography>
                <Chip
                  icon={<InsertDriveFileIcon sx={{ fontSize: 14 }} />}
                  label={`${rec.articleCount} ${t('rightToolbar.articlesCount')}`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              </Box>
            ))}
          </Box>
        );

      case 'favorites':
        // Can go up if folderPath has more than 1 level
        const canGoUp = folderPath.length > 1;
        const handleGoUp = () => {
          const parentId = folderPath[folderPath.length - 2]?.id;
          navigateToFolder(parentId);
        };
        const handleBreadcrumbClick = (folderId: string | null) => {
          navigateToFolder(folderId);
        };
        const handleFolderClick = (folderId: string) => {
          navigateToFolder(folderId);
        };

        return (
          <>
            {/* Breadcrumb path */}
            <Box sx={{ px: 1, pb: 0.5, borderBottom: 1, borderColor: 'divider' }}>
              <Breadcrumbs sx={{ fontSize: '0.7rem' }}>
                {folderPath.map((node) => (
                  <Link
                    key={node.id || 'root'}
                    component="button"
                    underline="hover"
                    sx={{ fontSize: '0.7rem', cursor: 'pointer' }}
                    onClick={() => handleBreadcrumbClick(node.id)}
                  >
                    {node.id === null ? t('favorites.rootFolder') : node.name}
                  </Link>
                ))}
              </Breadcrumbs>
            </Box>

            {/* Back button */}
            {canGoUp && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  py: 0.5,
                  px: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
                onClick={handleGoUp}
              >
                <ArrowUpwardIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {t('article.parentFolder')}
                </Typography>
              </Box>
            )}

            {/* Items list */}
            <Box sx={{ maxHeight: 150, overflow: 'auto' }}>
              <FavoriteItemRenderer
                items={items}
                onFolderClick={handleFolderClick}
                onArticleClick={handleArticleClick}
              />
            </Box>
          </>
        );

      case 'history':
        return (
          <>
            {/* Type toggle buttons inside the panel */}
            <ToggleButtonGroup
              value={historyType}
              exclusive
              onChange={(_, newValue) => {
                if (newValue) {
                  setHistoryType(newValue);
                }
              }}
              size="small"
              fullWidth
              sx={{ mb: 1 }}
            >
              <ToggleButton value="reading" sx={{ py: 0.25, fontSize: '0.7rem' }}>
                {t('rightToolbar.reading')}
              </ToggleButton>
              <ToggleButton value="chat" sx={{ py: 0.25, fontSize: '0.7rem' }}>
                {t('rightToolbar.chat')}
              </ToggleButton>
            </ToggleButtonGroup>

            {historyType === 'reading' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 160, overflow: 'auto' }}>
                {recentRecords.length > 0 ? (
                  recentRecords.map((record) => (
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
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {t('rightToolbar.noReadingHistory')}
                  </Typography>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 160, overflow: 'auto' }}>
                {chatHistory.length > 0 ? (
                  chatHistory.map((chat) => (
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
                      onClick={() => {
                        switchSession(chat.id);
                        navigate('/');
                      }}
                    >
                      {getChatModeIcon(chat.mode)}
                      <Tooltip title={chat.title} placement="top" arrow enterDelay={500}>
                        <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {chat.title}
                        </Typography>
                      </Tooltip>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {t('rightToolbar.noChatHistory')}
                  </Typography>
                )}
              </Box>
            )}
          </>
        );

      case 'stats':
        // Get sidebar cards configuration
        const sidebarCards = settings.statsCardConfig?.sidebarCards || [
          { id: 'sidebar-view-today-1', type: 'view_today', enabled: true },
          { id: 'sidebar-favorite-total-1', type: 'favorite_total', enabled: true },
        ];

        // Helper to get stat value for card type
        const getSidebarCardValue = (cardType: string): number => {
          if (!statsData?.readingStats) return 0;
          const stats = statsData.readingStats;
          switch (cardType) {
            // New types
            case 'view_today':
              return stats.todayCount;
            case 'view_week':
              return stats.weekCount;
            case 'view_30days':
              return stats.days30Count;
            case 'view_month':
              return stats.monthCount;
            case 'read_today':
              return stats.todayReadCount;
            case 'read_week':
              return stats.weekReadCount;
            case 'read_30days':
              return stats.days30ReadCount;
            case 'read_month':
              return stats.monthReadCount;
            case 'favorite_week':
              return stats.weekFavorites;
            case 'favorite_30days':
              return stats.days30Favorites;
            case 'favorite_total':
              return stats.totalFavorites;
            case 'chat_week':
              return stats.weekChats;
            case 'chat_30days':
              return stats.days30Chats;
            case 'chat_total':
              return stats.totalChats;
            // Legacy types (backward compatibility)
            case 'view':
              return stats.todayCount;
            case 'read':
              return stats.todayReadCount;
            case 'favorite':
              return stats.totalFavorites;
            case 'chat':
              return stats.totalChats;
            default:
              return 0;
          }
        };

        // Helper to get icon and color for card type
        const getSidebarCardConfig = (cardType: string) => {
          switch (cardType) {
            // New types
            case 'view_today':
              return { icon: <VisibilityIcon sx={{ fontSize: 16 }} />, color: '#2196f3', label: t('stats.cardTypes.view_today') };
            case 'view_week':
              return { icon: <VisibilityIcon sx={{ fontSize: 16 }} />, color: '#42a5f5', label: t('stats.cardTypes.view_week') };
            case 'view_30days':
              return { icon: <VisibilityIcon sx={{ fontSize: 16 }} />, color: '#64b5f6', label: t('stats.cardTypes.view_30days') };
            case 'view_month':
              return { icon: <VisibilityIcon sx={{ fontSize: 16 }} />, color: '#90caf9', label: t('stats.cardTypes.view_month') };
            case 'read_today':
              return { icon: <MenuBookIcon sx={{ fontSize: 16 }} />, color: '#4CAF50', label: t('stats.cardTypes.read_today') };
            case 'read_week':
              return { icon: <MenuBookIcon sx={{ fontSize: 16 }} />, color: '#66bb6a', label: t('stats.cardTypes.read_week') };
            case 'read_30days':
              return { icon: <MenuBookIcon sx={{ fontSize: 16 }} />, color: '#81c784', label: t('stats.cardTypes.read_30days') };
            case 'read_month':
              return { icon: <MenuBookIcon sx={{ fontSize: 16 }} />, color: '#a5d6a7', label: t('stats.cardTypes.read_month') };
            case 'favorite_week':
              return { icon: <BookmarkIcon sx={{ fontSize: 16 }} />, color: '#FF9800', label: t('stats.cardTypes.favorite_week') };
            case 'favorite_30days':
              return { icon: <BookmarkIcon sx={{ fontSize: 16 }} />, color: '#ffa726', label: t('stats.cardTypes.favorite_30days') };
            case 'favorite_total':
              return { icon: <BookmarkIcon sx={{ fontSize: 16 }} />, color: '#ffb74d', label: t('stats.cardTypes.favorite_total') };
            case 'chat_week':
              return { icon: <ChatIcon sx={{ fontSize: 16 }} />, color: '#9C27B0', label: t('stats.cardTypes.chat_week') };
            case 'chat_30days':
              return { icon: <ChatIcon sx={{ fontSize: 16 }} />, color: '#ab47bc', label: t('stats.cardTypes.chat_30days') };
            case 'chat_total':
              return { icon: <ChatIcon sx={{ fontSize: 16 }} />, color: '#ba68c8', label: t('stats.cardTypes.chat_total') };
            // Legacy types (backward compatibility)
            case 'view':
              return { icon: <VisibilityIcon sx={{ fontSize: 16 }} />, color: '#2196f3', label: t('stats.cardTypes.view_today') };
            case 'read':
              return { icon: <MenuBookIcon sx={{ fontSize: 16 }} />, color: '#4CAF50', label: t('stats.cardTypes.read_today') };
            case 'favorite':
              return { icon: <BookmarkIcon sx={{ fontSize: 16 }} />, color: '#FF9800', label: t('stats.cardTypes.favorite_total') };
            case 'chat':
              return { icon: <ChatIcon sx={{ fontSize: 16 }} />, color: '#9C27B0', label: t('stats.cardTypes.chat_total') };
            default:
              return { icon: <VisibilityIcon sx={{ fontSize: 16 }} />, color: '#2196f3', label: t('stats.cardTypes.view_today') };
          }
        };

        return (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <MonthlyHeatmap data={fillMissingDaysInHeatmap(statsData?.heatmapData || [])} size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
              {sidebarCards.filter(c => c.enabled).map((card) => {
                const config = getSidebarCardConfig(card.type);
                return (
                  <Box key={card.id} sx={{ textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                      <Box sx={{ color: config.color }}>{config.icon}</Box>
                      <Typography variant="caption" color="text.secondary">{config.label}</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: config.color }}>
                      {getSidebarCardValue(card.type)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </>
        );

      case 'subscription':
        return (
          <>
            {/* Keywords row */}
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('subscription.keywords')} ({keywords.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                {keywords.length === 0 ? (
                  <Typography variant="body2" color="text.disabled">-</Typography>
                ) : [
                  ...keywords.slice(0, 3).map((kw) => (
                    <Chip key={kw.id} label={kw.keyword} size="small" />
                  )),
                  keywords.length > 3 ? (
                    <Chip key="more-keywords" label={`+${keywords.length - 3}`} size="small" variant="outlined" color="primary" />
                  ) : null
                ]}
              </Box>
            </Box>

            {/* Authors row */}
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('subscription.subscribedAuthors')} ({authors.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                {authors.length === 0 ? (
                  <Typography variant="body2" color="text.disabled">-</Typography>
                ) : [
                  ...authors.slice(0, 3).map((author) => (
                    <Chip key={author.id} label={author.authorName} size="small" variant="outlined" />
                  )),
                  authors.length > 3 ? (
                    <Chip key="more-authors" label={`+${authors.length - 3}`} size="small" variant="outlined" color="primary" />
                  ) : null
                ]}
              </Box>
            </Box>

            {/* Categories (Domains) row */}
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('subscription.subscribedCategories')} ({categories.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                {categories.length === 0 ? (
                  <Typography variant="body2" color="text.disabled">-</Typography>
                ) : [
                  ...categories.slice(0, 3).map((cat) => (
                    <Chip
                      key={cat.id}
                      label={cat.category}
                      size="small"
                      variant="outlined"
                    />
                  )),
                  categories.length > 3 ? (
                    <Chip key="more-categories" label={`+${categories.length - 3}`} size="small" variant="outlined" color="primary" />
                  ) : null
                ]}
              </Box>
            </Box>

            <IconButton
              onClick={() => setSubscriptionDialogOpen(true)}
              sx={{ mt: 1 }}
            >
              <TuneIcon />
              <Typography sx={{ ml: 1 }}>{t('rightToolbar.editSubscription')}</Typography>
            </IconButton>
          </>
        );

      default:
        return null;
    }
  };

  // Panel summary renderers
  const renderPanelSummary = (panelId: PanelId) => {
    switch (panelId) {
      case 'arxiv':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudDownloadIcon fontSize="small" sx={{ color: '#FF7043' }} />
            <Typography variant="subtitle2">{t('rightToolbar.arxivCrawler')}</Typography>
          </Box>
        );

      case 'daily':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NewspaperIcon fontSize="small" sx={{ color: '#C5E1A5' }} />
              <Typography variant="subtitle2">{t('dailyReport.recommendations')}</Typography>
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
        );

      case 'favorites':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BookmarkIcon fontSize="small" sx={{ color: '#BBDEFB' }} />
              <Typography variant="subtitle2">{t('rightToolbar.favorites')}</Typography>
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
        );

      case 'history':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon fontSize="small" sx={{ color: '#FFCDD2' }} />
              <Typography variant="subtitle2">{t('history.title')}</Typography>
            </Box>
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
        );

      case 'stats':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BarChartIcon fontSize="small" sx={{ color: '#4CAF50' }} />
              <Typography variant="subtitle2">{t('stats.title')}</Typography>
            </Box>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/stats');
              }}
            >
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </Box>
        );

      case 'subscription':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TuneIcon fontSize="small" sx={{ color: '#B39DDB' }} />
            <Typography variant="subtitle2">{t('subscription.title')}</Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ position: 'relative', display: 'flex', height: '100vh' }}>
      {/* Expanded Toolbar */}
      <Box
        sx={{
          width: open ? TOOLBAR_WIDTH : 0,
          flexShrink: 0,
          borderLeft: open ? 1 : 0,
          borderColor: 'divider',
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: `width ${TRANSITION_DURATION}ms ease-in-out`,
          scrollbarGutter: 'stable',
        }}
      >
        {/* Edit Mode Header */}
        {isEditMode && showContent && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1,
              py: 0.5,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
              {t('rightToolbar.editMode')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton
                size="small"
                onClick={() => handleExitEditMode(false)}
                sx={{ fontSize: '0.7rem' }}
              >
                <Typography variant="caption">{t('rightToolbar.cancel')}</Typography>
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleExitEditMode(true)}
                color="primary"
                sx={{ fontSize: '0.7rem' }}
              >
                <DoneIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="caption">{t('rightToolbar.done')}</Typography>
              </IconButton>
            </Box>
          </Box>
        )}

        {showContent && (
          <Box onContextMenu={handleContextMenu} sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={panelOrder} strategy={verticalListSortingStrategy}>
              {panelOrder.map((panelId) => (
                <SortablePanel
                  key={panelId}
                  id={panelId}
                  isExpanded={expandedPanels.includes(panelId)}
                  onToggle={() => handlePanelToggle(panelId)}
                  summaryContent={renderPanelSummary(panelId)}
                  isEditMode={isEditMode}
                  hidden={hiddenPanels.has(panelId)}
                >
                  {renderPanelContent(panelId)}
                </SortablePanel>
              ))}
            </SortableContext>
          </DndContext>
          </Box>
        )}

        <SubscriptionDialog
          open={subscriptionDialogOpen}
          onClose={() => setSubscriptionDialogOpen(false)}
        />
      </Box>

      {/* Collapsed Icon Bar - shown when toolbar is closed */}
      {!open && (
        <Box
          sx={{
            width: 48,
            flexShrink: 0,
            borderLeft: 1,
            borderColor: 'divider',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 1,
            gap: 0.5,
            bgcolor: 'background.paper',
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          {panelOrder
            .filter((panelId) => !hiddenPanels.has(panelId))
            .map((panelId) => {
              const config = PANEL_CONFIG[panelId];
              const handleClick = () => {
                if (config.route) {
                  navigate(config.route);
                } else {
                  setQuickPreviewPanel(panelId);
                }
              };
              return (
                <Tooltip key={panelId} title={t(config.labelKey)} placement="left" arrow>
                  <IconButton
                    size="small"
                    onClick={handleClick}
                    sx={{
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    {config.icon}
                  </IconButton>
                </Tooltip>
              );
            })}
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
      >
        {open && (
          <MenuItem onClick={handleEnterEditMode}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('rightToolbar.editLayout')}</ListItemText>
          </MenuItem>
        )}
        {open && <Divider />}
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5 }}>
          {open ? t('rightToolbar.showHidePanel') : t('rightToolbar.showHideIcon')}
        </Typography>
        {Object.entries(PANEL_CONFIG).map(([id, config]) => (
          <MenuItem
            key={id}
            onClick={() => handleTogglePanelVisibility(id as PanelId)}
            dense
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {config.icon}
            </ListItemIcon>
            <ListItemText
              primary={t(config.labelKey)}
              primaryTypographyProps={{ variant: 'body2' }}
            />
            {!hiddenPanels.has(id as PanelId) ? (
              <VisibilityIcon fontSize="small" sx={{ color: 'primary.main', ml: 'auto' }} />
            ) : (
              <VisibilityOffIcon fontSize="small" sx={{ color: 'text.disabled', ml: 'auto' }} />
            )}
          </MenuItem>
        ))}
      </Menu>

      {/* Abstract Dialog */}
      <AbstractDialog
        open={abstractDialogOpen}
        article={selectedArticle}
        isFavorited={selectedArticleFavorited}
        onClose={handleAbstractDialogClose}
        onFavoriteChange={handleFavoriteChange}
      />

      {/* Daily Recommendation Dialog */}
      <DailyRecommendationDialog
        open={recommendationDialogOpen}
        recommendationId={selectedRecommendationId}
        onClose={handleRecommendationDialogClose}
      />

      {/* Category Select Dialog */}
      <CategorySelectDialog
        open={categoryDialogOpen}
        selectedCategories={settings.crawlerCategories}
        onClose={() => setCategoryDialogOpen(false)}
        onSave={handleCategoriesChange}
      />

      {/* Quick Preview Dialog */}
      <Dialog
        open={quickPreviewPanel !== null}
        onClose={() => setQuickPreviewPanel(null)}
        maxWidth="sm"
        fullWidth
      >
        {quickPreviewPanel && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {PANEL_CONFIG[quickPreviewPanel].icon}
                <Typography variant="subtitle1">{t(PANEL_CONFIG[quickPreviewPanel].labelKey)}</Typography>
              </Box>
              <IconButton size="small" onClick={() => setQuickPreviewPanel(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {renderPanelContent(quickPreviewPanel)}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setQuickPreviewPanel(null)}>{t('rightToolbar.close')}</Button>
              <Button variant="contained" onClick={onToggle}>
                {t('rightToolbar.expandSidebar')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Toggle Button */}
      <IconButton
        onClick={onToggle}
        sx={{
          position: 'absolute',
          right: open ? TOOLBAR_WIDTH - 16 : 48 - 16,
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
          transition: `right ${TRANSITION_DURATION}ms ease-in-out`,
        }}
      >
        <ChevronLeftIcon
          fontSize="small"
          sx={{
            transition: 'transform 200ms ease-in-out',
            transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        />
      </IconButton>
    </Box>
  );
};
