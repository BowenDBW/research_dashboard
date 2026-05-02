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
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  FormControl,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Today as TodayIcon,
  DateRange as DateRangeIcon,
  Bookmark as BookmarkIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useStats } from '../../hooks';
import { MonthlyHeatmap, WeeklyHourHeatmap, DomainChart, KeywordCloud, StatsCard } from '../../components/stats';

type DateMode = 'last30' | 'month';

const StatsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { statsData, fetchStats } = useStats();

  const [dateMode, setDateMode] = useState<DateMode>('last30');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  // Fetch stats data on mount and when date changes
  useEffect(() => {
    let startDate: string;
    let endDate: string;

    if (dateMode === 'last30') {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
    } else {
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0);
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
    }

    fetchStats(startDate, endDate);
  }, [dateMode, selectedYear, selectedMonth, fetchStats]);

  const handleDateModeChange = (_: React.MouseEvent<HTMLElement>, newMode: DateMode | null) => {
    if (newMode) {
      setDateMode(newMode);
    }
  };

  // Generate year options (current year and past 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const monthOptions = [
    { value: 0, label: t('stats.months.jan') },
    { value: 1, label: t('stats.months.feb') },
    { value: 2, label: t('stats.months.mar') },
    { value: 3, label: t('stats.months.apr') },
    { value: 4, label: t('stats.months.may') },
    { value: 5, label: t('stats.months.jun') },
    { value: 6, label: t('stats.months.jul') },
    { value: 7, label: t('stats.months.aug') },
    { value: 8, label: t('stats.months.sep') },
    { value: 9, label: t('stats.months.oct') },
    { value: 10, label: t('stats.months.nov') },
    { value: 11, label: t('stats.months.dec') },
  ];

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
          {/* Date Selector in Header */}
          <ToggleButtonGroup
            value={dateMode}
            exclusive
            onChange={handleDateModeChange}
            size="small"
          >
            <ToggleButton value="last30" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>
              {t('stats.last30Days')}
            </ToggleButton>
            <ToggleButton value="month" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>
              {t('stats.selectByMonth')}
            </ToggleButton>
          </ToggleButtonGroup>

          {dateMode === 'month' && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <FormControl size="small" sx={{ minWidth: 90 }}>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value as number)}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {yearOptions.map((year) => (
                    <MenuItem key={year} value={year} sx={{ fontSize: '0.75rem' }}>
                      {year}{t('stats.yearSuffix')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value as number)}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {monthOptions.map((month) => (
                    <MenuItem key={month.value} value={month.value} sx={{ fontSize: '0.75rem' }}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 2, overflow: 'auto' }}>
        <Stack spacing={2}>
          {/* Stats Cards - always single row, evenly distributed */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
            <StatsCard
              icon={<TodayIcon />}
              label={t('stats.todayReading')}
              value={statsData?.readingStats?.todayCount ?? 0}
              unit={t('stats.articles')}
              color="#2196f3"
            />
            <StatsCard
              icon={<DateRangeIcon />}
              label={t('stats.monthReading', { month: dateMode === 'last30' ? t('stats.thisMonth') : monthOptions[selectedMonth].label })}
              value={statsData?.readingStats?.monthCount ?? 0}
              unit={t('stats.articles')}
              color="#4CAF50"
            />
            <StatsCard
              icon={<BookmarkIcon />}
              label={t('stats.favoritesCount')}
              value={statsData?.readingStats?.totalFavorites ?? 0}
              unit={t('stats.articles')}
              color="#FF9800"
            />
            <StatsCard
              icon={<ChatIcon />}
              label={t('stats.chatCount')}
              value={statsData?.readingStats?.totalChats ?? 0}
              unit={t('stats.times')}
              color="#9C27B0"
            />
          </Box>

          {/* Monthly Heatmap & Domain Distribution */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Paper sx={{ p: 2, flex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                {t('stats.monthlyHeatmap')}
              </Typography>
              <MonthlyHeatmap data={statsData?.heatmapData ?? []} size="medium" />
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
            <WeeklyHourHeatmap data={statsData?.dailyHourData ?? []} />
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
    </Box>
  );
};

export default StatsPage;
