import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import {
  ArrowBack as ArrowBackIcon,
  Visibility as VisibilityIcon,
  MenuBook as MenuBookIcon,
  Bookmark as BookmarkIcon,
  Chat as ChatIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
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
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { useStatsStore } from '../../stores';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { MonthlyHeatmap, WeeklyHourHeatmap, DomainChart, KeywordCloud, StatsCard } from '../../components/stats';
import { StatsCardItem, StatsCardType, HeatmapCell } from '../../types';
import { DailyHourData } from '../../types/stats';

// Card type configuration with icon, color, and label
const CARD_CONFIG: Record<StatsCardType, { icon: React.ReactNode; color: string; labelKey: string }> = {
  view_today: { icon: <VisibilityIcon />, color: '#2196f3', labelKey: 'stats.cardTypes.view_today' },
  view_week: { icon: <VisibilityIcon />, color: '#42a5f5', labelKey: 'stats.cardTypes.view_week' },
  view_30days: { icon: <VisibilityIcon />, color: '#64b5f6', labelKey: 'stats.cardTypes.view_30days' },
  view_month: { icon: <VisibilityIcon />, color: '#90caf9', labelKey: 'stats.cardTypes.view_month' },
  read_today: { icon: <MenuBookIcon />, color: '#4CAF50', labelKey: 'stats.cardTypes.read_today' },
  read_week: { icon: <MenuBookIcon />, color: '#66bb6a', labelKey: 'stats.cardTypes.read_week' },
  read_30days: { icon: <MenuBookIcon />, color: '#81c784', labelKey: 'stats.cardTypes.read_30days' },
  read_month: { icon: <MenuBookIcon />, color: '#a5d6a7', labelKey: 'stats.cardTypes.read_month' },
  favorite_week: { icon: <BookmarkIcon />, color: '#FF9800', labelKey: 'stats.cardTypes.favorite_week' },
  favorite_30days: { icon: <BookmarkIcon />, color: '#ffa726', labelKey: 'stats.cardTypes.favorite_30days' },
  favorite_total: { icon: <BookmarkIcon />, color: '#ffb74d', labelKey: 'stats.cardTypes.favorite_total' },
  chat_week: { icon: <ChatIcon />, color: '#9C27B0', labelKey: 'stats.cardTypes.chat_week' },
  chat_30days: { icon: <ChatIcon />, color: '#ab47bc', labelKey: 'stats.cardTypes.chat_30days' },
  chat_total: { icon: <ChatIcon />, color: '#ba68c8', labelKey: 'stats.cardTypes.chat_total' },
};

// All available card types grouped by category
const CARD_CATEGORIES = [
  {
    category: 'views',
    types: ['view_today', 'view_week', 'view_30days', 'view_month'] as StatsCardType[],
  },
  {
    category: 'reads',
    types: ['read_today', 'read_week', 'read_30days', 'read_month'] as StatsCardType[],
  },
  {
    category: 'favorites',
    types: ['favorite_week', 'favorite_30days', 'favorite_total'] as StatsCardType[],
  },
  {
    category: 'chats',
    types: ['chat_week', 'chat_30days', 'chat_total'] as StatsCardType[],
  },
];

// Sortable Stats Card Component
interface SortableStatsCardProps {
  id: string;
  cardType: StatsCardType;
  value: number;
  unit: string;
  isEditMode: boolean;
  onRemove: (id: string) => void;
}

const SortableStatsCard = ({ id, cardType, value, unit, isEditMode, onRemove }: SortableStatsCardProps) => {
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
  };

  // Fallback for old card types (backward compatibility)
  const getFallbackConfig = (type: string) => {
    // Map old types to new types
    const legacyMap: Record<string, StatsCardType> = {
      'view': 'view_today',
      'read': 'read_today',
      'favorite': 'favorite_total',
      'chat': 'chat_total',
    };
    const mappedType = legacyMap[type] || 'view_today';
    return CARD_CONFIG[mappedType];
  };

  const config = CARD_CONFIG[cardType] || getFallbackConfig(cardType);

  return (
    <Box ref={setNodeRef} style={style} sx={{ position: 'relative' }}>
      {/* Drag handle - shown in edit mode */}
      {isEditMode && (
        <Box
          {...attributes}
          {...listeners}
          sx={{
            position: 'absolute',
            top: 4,
            left: 4,
            zIndex: 10,
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 1,
            bgcolor: 'background.paper',
            boxShadow: 1,
            color: 'text.secondary',
            transition: 'all 0.2s',
            '&:hover': {
              color: 'primary.main',
              bgcolor: 'action.hover',
            },
            '&:active': {
              cursor: 'grabbing',
            },
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
      )}
      {/* Remove button */}
      {isEditMode && (
        <IconButton
          size="small"
          onClick={() => onRemove(id)}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 20,
            bgcolor: 'background.paper',
            boxShadow: 1,
            '&:hover': {
              bgcolor: 'error.light',
              color: 'error.contrastText',
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
      <StatsCard
        icon={config.icon}
        label={config.labelKey}
        value={value}
        unit={unit}
        color={config.color}
      />
    </Box>
  );
};

const StatsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { statsData, fetchStats } = useStatsStore();
  const { settings, updateStatsCardConfig } = useSettingsStore();

  const [isEditMode, setIsEditMode] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [sidebarEditDialogOpen, setSidebarEditDialogOpen] = useState(false);

  // Time range selection state
  const [timeRangeMode, setTimeRangeMode] = useState<'last30days' | 'monthly'>('last30days');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Get cards from settings
  const cards: StatsCardItem[] = settings.statsCardConfig?.cards || [
    { id: 'view-today-1', type: 'view_today', enabled: true },
    { id: 'read-today-1', type: 'read_today', enabled: true },
    { id: 'view-week-1', type: 'view_week', enabled: true },
    { id: 'read-week-1', type: 'read_week', enabled: true },
  ];

  const sidebarCards: StatsCardItem[] = settings.statsCardConfig?.sidebarCards || [
    { id: 'sidebar-view-today-1', type: 'view_today', enabled: true },
    { id: 'sidebar-favorite-total-1', type: 'favorite_total', enabled: true },
  ];

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch stats data based on time range selection
  useEffect(() => {
    const now = new Date();
    let startDate: string;
    let endDate: string;

    if (timeRangeMode === 'last30days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = start.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    } else {
      // Monthly mode - get the full selected month
      const [year, month] = selectedMonth.split('-');
      const monthInt = parseInt(month, 10);
      const yearInt = parseInt(year, 10);
      // First day of the month
      startDate = `${year}-${month}-01`;
      // Last day of the month (or today if it's the current month)
      const lastDay = new Date(yearInt, monthInt, 0).getDate();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const actualLastDay = (yearInt === currentYear && monthInt === currentMonth) ? now.getDate() : lastDay;
      endDate = `${year}-${month}-${String(actualLastDay).padStart(2, '0')}`;
    }

    fetchStats(startDate, endDate);
  }, [fetchStats, timeRangeMode, selectedMonth]);

  // Fill missing days in heatmap data based on time range mode
  // ALWAYS show complete days: 30 days for last30days mode, full month (28-31) for monthly mode
  const fillHeatmapData = (data: HeatmapCell[]): HeatmapCell[] => {
    const now = new Date();
    const dataMap = new Map(data.map(d => [d.date, d]));
    const filledData: HeatmapCell[] = [];

    if (timeRangeMode === 'last30days') {
      // Fill last 30 days, rightmost is today
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        const existingData = dataMap.get(dateStr);
        filledData.push(existingData || { date: dateStr, count: 0, level: 0 });
      }
    } else {
      // Fill FULL month (all days, including future days as count=0)
      const [year, month] = selectedMonth.split('-');
      const yearInt = parseInt(year, 10);
      const monthInt = parseInt(month, 10);
      const totalDaysInMonth = new Date(yearInt, monthInt, 0).getDate();

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
        const existingData = dataMap.get(dateStr);
        filledData.push(existingData || { date: dateStr, count: 0, level: 0 });
      }
    }

    return filledData;
  };

  // Fill missing days in daily hour data for weekly hour heatmap
  // ALWAYS show complete days: 30 days for last30days mode, full month for monthly mode
  const fillDailyHourData = (data: DailyHourData[]): DailyHourData[] => {
    const now = new Date();
    const dataMap = new Map(data.map(d => [`${d.date}-${d.hour}`, d]));
    const filledData: DailyHourData[] = [];

    if (timeRangeMode === 'last30days') {
      // Fill last 30 days
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        // Add 24 hours for each day
        for (let hour = 0; hour < 24; hour++) {
          const key = `${dateStr}-${hour}`;
          const existingData = dataMap.get(key);
          filledData.push(existingData || { date: dateStr, hour, count: 0 });
        }
      }
    } else {
      // Fill FULL month
      const [year, month] = selectedMonth.split('-');
      const yearInt = parseInt(year, 10);
      const monthInt = parseInt(month, 10);
      const totalDaysInMonth = new Date(yearInt, monthInt, 0).getDate();

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
        // Add 24 hours for each day
        for (let hour = 0; hour < 24; hour++) {
          const key = `${dateStr}-${hour}`;
          const existingData = dataMap.get(key);
          filledData.push(existingData || { date: dateStr, hour, count: 0 });
        }
      }
    }

    return filledData;
  };

  // Get value for card type (with backward compatibility for legacy types)
  const getCardValue = (cardType: string): number => {
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

  // Get unit for card type (with backward compatibility)
  const getCardUnit = (cardType: string): string => {
    if (cardType.startsWith('chat') || cardType === 'chat') {
      return t('stats.times');
    }
    return t('stats.articles');
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const newCards = arrayMove(
        cards.filter(c => c.enabled),
        cards.findIndex(c => c.id === active.id),
        cards.findIndex(c => c.id === over.id)
      );
      updateStatsCardConfig({
        cards: newCards,
        sidebarCards,
      });
    }
  };

  // Handle remove card
  const handleRemoveCard = (id: string) => {
    const newCards = cards.filter(c => c.id !== id);
    updateStatsCardConfig({
      cards: newCards,
      sidebarCards,
    });
  };

  // Handle add card
  const handleAddCard = (type: StatsCardType) => {
    if (cards.length >= 8) return;
    const newCard: StatsCardItem = {
      id: `${type}-${Date.now()}`,
      type,
      enabled: true,
    };
    updateStatsCardConfig({
      cards: [...cards, newCard],
      sidebarCards,
    });
    setAddDialogOpen(false);
  };

  // Handle sidebar card toggle
  const handleSidebarCardToggle = (type: StatsCardType) => {
    // Check if this type is enabled, with backward compatibility for legacy types
    const existingCard = sidebarCards.find(c => {
      const cardType = c.type as string;
      if (cardType === type) return true;
      // Legacy type mapping
      if (cardType === 'view' && type === 'view_today') return true;
      if (cardType === 'read' && type === 'read_today') return true;
      if (cardType === 'favorite' && type === 'favorite_total') return true;
      if (cardType === 'chat' && type === 'chat_total') return true;
      return false;
    });

    if (existingCard) {
      // Remove if exists
      const newSidebarCards = sidebarCards.filter(c => c.id !== existingCard.id);
      updateStatsCardConfig({
        cards,
        sidebarCards: newSidebarCards,
      });
    } else {
      // Add if not exists (max 2)
      if (sidebarCards.length >= 2) return;
      const newSidebarCards = [...sidebarCards, { id: `sidebar-${type}-${Date.now()}`, type, enabled: true }];
      updateStatsCardConfig({
        cards,
        sidebarCards: newSidebarCards,
      });
    }
  };

  // Available card types for adding (not already in cards)
  const availableCardTypes = CARD_CATEGORIES.flatMap(cat => cat.types).filter(
    type => !cards.some(c => c.type === type)
  );

  const enabledCards = cards.filter(c => c.enabled);

  // Fixed 4 columns layout (4x1 or 4x2 grid)
  const gridColumns = 4;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'background.paper' }}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton onClick={() => navigate('/')} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6">
            {t('stats.title')}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {/* Time Range Selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToggleButtonGroup
              value={timeRangeMode}
              exclusive
              onChange={(_, newValue) => {
                if (newValue) setTimeRangeMode(newValue);
              }}
              size="small"
            >
              <ToggleButton value="last30days" sx={{ py: 0.25, fontSize: '0.75rem' }}>
                {t('stats.last30Days')}
              </ToggleButton>
              <ToggleButton value="monthly" sx={{ py: 0.25, fontSize: '0.75rem' }}>
                {t('stats.selectByMonth')}
              </ToggleButton>
            </ToggleButtonGroup>
            {timeRangeMode === 'monthly' && (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  views={['month', 'year']}
                  value={dayjs(selectedMonth)}
                  onChange={(newValue) => {
                    if (newValue) {
                      setSelectedMonth(newValue.format('YYYY-MM'));
                    }
                  }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: 140 },
                    },
                  }}
                />
              </LocalizationProvider>
            )}
          </Box>

          {/* Edit Mode Toggle */}
          <Button
            size="small"
            startIcon={isEditMode ? <CloseIcon /> : <EditIcon />}
            onClick={() => setIsEditMode(!isEditMode)}
            color={isEditMode ? 'primary' : 'inherit'}
          >
            {isEditMode ? t('common.close') : t('stats.editCards')}
          </Button>

          {/* Sidebar Edit Button */}
          <Button
            size="small"
            onClick={() => setSidebarEditDialogOpen(true)}
          >
            {t('stats.sidebarCards')}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 2, overflow: 'auto' }}>
        <Stack spacing={2}>
          {/* Stats Cards - DnD enabled, 4x2 grid */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={enabledCards.map(c => c.id)} strategy={rectSortingStrategy}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                  gap: 2,
                }}
              >
                {enabledCards.map((card) => (
                  <SortableStatsCard
                    key={card.id}
                    id={card.id}
                    cardType={card.type}
                    value={getCardValue(card.type)}
                    unit={getCardUnit(card.type)}
                    isEditMode={isEditMode}
                    onRemove={handleRemoveCard}
                  />
                ))}
              </Box>
            </SortableContext>
          </DndContext>

          {/* Add Card Button in Edit Mode */}
          {isEditMode && cards.length < 8 && availableCardTypes.length > 0 && (
            <Button
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('stats.addCard')} ({t('stats.maxCards')})
            </Button>
          )}

          {/* Monthly Heatmap & Domain Distribution */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Paper sx={{ p: 2, flex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                {t('stats.monthlyHeatmap')}
              </Typography>
              <MonthlyHeatmap data={fillHeatmapData(statsData?.heatmapData ?? [])} size="medium" />
            </Paper>
            <Paper sx={{ p: 2, flex: 6, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                {t('stats.domainDistribution')}
              </Typography>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DomainChart data={statsData?.domainDistribution ?? []} />
              </Box>
            </Paper>
          </Box>

          {/* Weekly Hour Heatmap */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, alignSelf: 'flex-start' }}>
              {t('stats.readingTimeDistribution')}
            </Typography>
            <WeeklyHourHeatmap data={fillDailyHourData(statsData?.dailyHourData ?? [])} />
          </Paper>

          {/* Keyword Cloud */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              {t('stats.keywordCloud')}
            </Typography>
            <KeywordCloud data={statsData?.keywords ?? []} width={600} height={250} />
          </Paper>
        </Stack>
      </Container>

      {/* Add Card Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('stats.addCard')} ({t('stats.maxCards')})</DialogTitle>
        <DialogContent>
          {CARD_CATEGORIES.map((category, idx) => (
            <Box key={category.category}>
              {idx > 0 && <Divider sx={{ my: 1 }} />}
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t(`stats.categories.${category.category}`)}
              </Typography>
              <List dense>
                {category.types.map((type) => {
                  const config = CARD_CONFIG[type];
                  const isAdded = cards.some(c => c.type === type);
                  const canAdd = cards.length < 8;
                  return (
                    <ListItem
                      key={type}
                      onClick={() => !isAdded && canAdd && handleAddCard(type)}
                      sx={{
                        cursor: isAdded ? 'default' : 'pointer',
                        opacity: isAdded ? 0.5 : 1,
                      }}
                    >
                      <ListItemIcon>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            bgcolor: `${config.color}15`,
                            color: config.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {config.icon}
                        </Box>
                      </ListItemIcon>
                      <ListItemText primary={t(config.labelKey)} />
                      {isAdded && (
                        <Typography variant="caption" color="text.secondary">
                          {t('stats.alreadyAdded')}
                        </Typography>
                      )}
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>{t('common.cancel')}</Button>
        </DialogActions>
      </Dialog>

      {/* Sidebar Cards Edit Dialog */}
      <Dialog open={sidebarEditDialogOpen} onClose={() => setSidebarEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('stats.sidebarCards')} ({t('stats.maxSidebarCards')})</DialogTitle>
        <DialogContent>
          {CARD_CATEGORIES.map((category, idx) => (
            <Box key={category.category}>
              {idx > 0 && <Divider sx={{ my: 1 }} />}
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t(`stats.categories.${category.category}`)}
              </Typography>
              <List dense>
                {category.types.map((type) => {
                  const config = CARD_CONFIG[type];
                  // Check if this type is enabled, with backward compatibility for legacy types
                  const isEnabled = sidebarCards.some(c => {
                    const cardType = c.type as string;
                    if (cardType === type) return true;
                    // Legacy type mapping
                    if (cardType === 'view' && type === 'view_today') return true;
                    if (cardType === 'read' && type === 'read_today') return true;
                    if (cardType === 'favorite' && type === 'favorite_total') return true;
                    if (cardType === 'chat' && type === 'chat_total') return true;
                    return false;
                  });
                  const canAdd = sidebarCards.length < 2;
                  const canToggle = isEnabled || canAdd;
                  return (
                    <ListItem
                      key={type}
                      onClick={() => canToggle && handleSidebarCardToggle(type)}
                      sx={{ cursor: canToggle ? 'pointer' : 'default', opacity: canToggle ? 1 : 0.5 }}
                    >
                      <ListItemIcon>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            bgcolor: `${config.color}15`,
                            color: config.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {config.icon}
                        </Box>
                      </ListItemIcon>
                      <ListItemText primary={t(config.labelKey)} />
                      <Checkbox
                        edge="end"
                        checked={isEnabled}
                        disabled={!canToggle}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canToggle) handleSidebarCardToggle(type);
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSidebarEditDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StatsPage;