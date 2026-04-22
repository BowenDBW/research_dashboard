import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Card,
  CardContent,
  Pagination,
  Chip,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  ArrowBack as ArrowBackIcon,
  CalendarToday as CalendarIcon,
  Article as ArticleIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useDailyStore } from '../../stores/useDailyStore';
import { DailyRecommendationDialog } from '../../components/daily/DailyRecommendationDialog';

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;

const DailyPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { recommendations, totalRecommendations, loading, fetchRecommendations } = useDailyStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [searchMonth, setSearchMonth] = useState<dayjs.Dayjs | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  useEffect(() => {
    const monthStr = searchMonth ? searchMonth.format('YYYY-MM') : undefined;
    fetchRecommendations(page, pageSize, monthStr);
  }, [page, pageSize, searchMonth, fetchRecommendations]);

  const totalPages = Math.ceil(totalRecommendations / pageSize);

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const handlePageSizeChange = (event: SelectChangeEvent<number>) => {
    setPageSize(event.target.value as number);
    setPage(1);
  };

  const handleMonthChange = (value: dayjs.Dayjs | null) => {
    setSearchMonth(value);
    setPage(1);
  };

  const handleRecommendationClick = (id: string) => {
    setSelectedRecommendationId(id);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedRecommendationId(null);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'background.paper' }}>
          <Toolbar>
            <IconButton onClick={() => navigate('/')}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 2 }}>
              {t('dailyReport.recommendations')}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <DatePicker
              label={t('dailyReport.selectMonth')}
              views={['year', 'month']}
              value={searchMonth}
              onChange={handleMonthChange}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { width: 150 },
                },
              }}
            />
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Container maxWidth="sm" sx={{ py: 2, flex: 1, overflow: 'auto', pb: 8 }}>

          {/* Recommendation List */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {loading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <Card key={i}>
                  <CardContent>
                    <Skeleton width="60%" />
                    <Skeleton width="40%" />
                  </CardContent>
                </Card>
              ))
            ) : recommendations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography color="text.secondary">{t('dailyReport.noRecommendationsShort')}</Typography>
              </Box>
            ) : (
              recommendations.map((rec) => (
                <Card
                  key={rec.id}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                    },
                  }}
                  onClick={() => handleRecommendationClick(rec.id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {rec.date}
                        </Typography>
                      </Box>
                      <Chip
                        icon={<ArticleIcon />}
                        label={t('dailyReport.articleCount', { count: rec.articleCount })}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        </Container>

        {/* Fixed Bottom Pagination */}
        {totalPages > 0 && (
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              bgcolor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider',
              py: 1,
              px: 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>{t('dailyReport.perPage')}</InputLabel>
              <Select
                value={pageSize}
                label={t('dailyReport.perPage')}
                onChange={handlePageSizeChange}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <MenuItem key={size} value={size}>
                    {t('dailyReport.articleCount', { count: size })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              shape="rounded"
            />
          </Box>
        )}

        {/* Recommendation Dialog */}
        <DailyRecommendationDialog
          open={dialogOpen}
          recommendationId={selectedRecommendationId}
          onClose={handleDialogClose}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default DailyPage;