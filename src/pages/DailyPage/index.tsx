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
import { useDailyStore } from '../../stores/useDailyStore';
import { DailyReportDialog } from '../../components/daily/DailyReportDialog';

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;

const DailyPage = () => {
  const navigate = useNavigate();
  const { reports, totalReports, loading, fetchReports } = useDailyStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [searchMonth, setSearchMonth] = useState<dayjs.Dayjs | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    const monthStr = searchMonth ? searchMonth.format('YYYY-MM') : undefined;
    fetchReports(page, pageSize, monthStr);
  }, [page, pageSize, searchMonth, fetchReports]);

  const totalPages = Math.ceil(totalReports / pageSize);

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

  const handleReportClick = (id: string) => {
    setSelectedReportId(id);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedReportId(null);
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
              Claw 日报
            </Typography>
            <Box sx={{ flex: 1 }} />
            <DatePicker
              label="选择月份"
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

          {/* Report List */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {loading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <Card key={i}>
                  <CardContent>
                    <Skeleton width="60%" />
                    <Skeleton width="80%" />
                    <Skeleton width="40%" />
                  </CardContent>
                </Card>
              ))
            ) : reports.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography color="text.secondary">暂无日报</Typography>
              </Box>
            ) : (
              reports.map((report) => (
                <Card
                  key={report.id}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                    },
                  }}
                  onClick={() => handleReportClick(report.id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {report.date}
                        </Typography>
                      </Box>
                      <Chip
                        icon={<ArticleIcon />}
                        label={`${report.articleCount} 篇`}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {report.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {report.summary}
                    </Typography>
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
              <InputLabel>每页显示</InputLabel>
              <Select
                value={pageSize}
                label="每页显示"
                onChange={handlePageSizeChange}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size} 条
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

        {/* Report Dialog */}
        <DailyReportDialog
          open={dialogOpen}
          reportId={selectedReportId}
          onClose={handleDialogClose}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default DailyPage;