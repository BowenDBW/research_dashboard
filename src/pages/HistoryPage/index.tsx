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
  Collapse,
  Pagination,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
} from '@mui/material';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  Description as DescriptionIcon,
  OpenInNew as OpenInNewIcon,
  Bookmark as BookmarkIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { ArticleActions } from '../../components/article/ArticleActions';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { records, setFilters } = useHistoryStore();
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(dayjs().subtract(7, 'day'));
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const handleActionChange = (
    _: React.MouseEvent<HTMLElement>,
    newActions: string[]
  ) => {
    setSelectedActions(newActions);
    setFilters({ actions: newActions });
  };

  const handleToggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'view_abstract':
        return <DescriptionIcon />;
      case 'view_source':
        return <OpenInNewIcon />;
      case 'favorite':
        return <BookmarkIcon />;
      case 'download':
        return <DownloadIcon />;
      default:
        return <DescriptionIcon />;
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
              阅读历史
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Filter Bar */}
        <Container maxWidth="lg" sx={{ py: 2 }}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <MuiDatePicker
                label="开始日期"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{ textField: { size: 'small' } }}
              />
              <MuiDatePicker
                label="结束日期"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{ textField: { size: 'small' } }}
              />
              <Typography variant="body2" color="text.secondary">
                操作类型：
              </Typography>
              <ToggleButtonGroup
                value={selectedActions}
                onChange={handleActionChange}
                size="small"
                exclusive={false}
              >
                <ToggleButton value="view_abstract">摘要</ToggleButton>
                <ToggleButton value="view_source">链接</ToggleButton>
                <ToggleButton value="favorite">收藏</ToggleButton>
                <ToggleButton value="download">下载</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Paper>
        </Container>

        {/* Timeline */}
        <Container maxWidth="lg" sx={{ flex: 1, py: 2, overflow: 'auto' }}>
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
                        mb: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleToggleExpand(record.id)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {record.article.title}
                        </Typography>
                        <Chip
                          label={getActionLabel(record.action)}
                          size="small"
                          icon={getActionIcon(record.action)}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(record.timestamp).toLocaleTimeString()}
                        </Typography>
                        <IconButton size="small">
                          <ExpandMoreIcon
                            sx={{
                              transform: expandedItems[record.id]
                                ? 'rotate(180deg)'
                                : 'none',
                            }}
                          />
                        </IconButton>
                      </Box>
                      <Collapse in={expandedItems[record.id]}>
                        <Box sx={{ mt: 1, pl: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            作者: {record.article.authors.join(', ')}
                          </Typography>
                          <Chip label={record.article.source} size="small" sx={{ mr: 1 }} />
                          <ArticleActions article={record.article} compact />
                        </Box>
                      </Collapse>
                    </Box>
                  ))}
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>

          {records.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">暂无阅读历史记录</Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Pagination count={1} color="primary" />
          </Box>
        </Container>
      </Box>
    </LocalizationProvider>
  );
};

export default HistoryPage;