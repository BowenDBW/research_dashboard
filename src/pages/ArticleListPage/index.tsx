import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Paper,
  Grid,
  TextField,
  Chip,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useArticleStore } from '../../stores/useArticleStore';
import { ArticleCard } from '../../components/article/ArticleCard';

const DOMAIN_OPTIONS = ['cs.LG', 'cs.AI', 'cs.CL', 'cs.CV', 'cs.NE', 'cs.RO', 'cs.SE', 'stat.ML'];

const ArticleListPage = () => {
  const navigate = useNavigate();
  const {
    articles,
    totalCount,
    page,
    pageSize,
    loading,
    filters,
    setFilters,
    fetchArticles,
    setPage,
    setPageSize,
  } = useArticleStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [localSources, setLocalSources] = useState<string[]>(filters.sources);
  const [localDomains, setLocalDomains] = useState<string[]>(filters.domains);
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(null);
  const [showArxivOnly, setShowArxivOnly] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleFilterChange = () => {
    setFilters({
      author: searchQuery,
      sources: localSources,
      domains: showArxivOnly ? localDomains : [],
      dateRange: [startDate?.toISOString() || null, endDate?.toISOString() || null],
    });
    fetchArticles();
  };

  const handleDomainToggle = (domain: string) => {
    setLocalDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

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
              文章列表
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Container maxWidth="lg" sx={{ flex: 1, py: 2, overflow: 'auto' }}>
          {/* Filter Bar */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              {/* Search */}
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="搜索标题、作者或摘要..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFilterChange()}
                  slotProps={{
                    input: {
                      startAdornment: <SearchIcon color="action" sx={{ mr: 1, fontSize: 20 }} />,
                    },
                  }}
                />
              </Grid>

              {/* Date Range */}
              <Grid size={{ xs: 6, md: 2 }}>
                <DatePicker
                  label="开始日期"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <DatePicker
                  label="结束日期"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>

              {/* Source (Conference/Journal) */}
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>会议/期刊</InputLabel>
                  <Select
                    multiple
                    value={localSources}
                    label="会议/期刊"
                    onChange={(e) => setLocalSources(e.target.value as string[])}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    <MenuItem value="NeurIPS">NeurIPS</MenuItem>
                    <MenuItem value="ICML">ICML</MenuItem>
                    <MenuItem value="ICLR">ICLR</MenuItem>
                    <MenuItem value="CVPR">CVPR</MenuItem>
                    <MenuItem value="ACL">ACL</MenuItem>
                    <MenuItem value="EMNLP">EMNLP</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* ArXiv Toggle */}
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showArxivOnly}
                        onChange={(e) => {
                          setShowArxivOnly(e.target.checked);
                          if (!e.target.checked) {
                            setLocalDomains([]);
                          }
                        }}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">显示 arXiv 文章</Typography>}
                  />
                </Box>
              </Grid>

              {/* Domain Filter - only show when arXiv toggle is on */}
              {showArxivOnly && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    领域筛选
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {DOMAIN_OPTIONS.map((domain) => (
                      <Chip
                        key={domain}
                        label={domain}
                        size="small"
                        onClick={() => handleDomainToggle(domain)}
                        color={localDomains.includes(domain) ? 'primary' : 'default'}
                        variant={localDomains.includes(domain) ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* Article List */}
          <Box sx={{ mb: 2 }}>
            {loading ? (
              <>
                <Skeleton height={80} />
                <Skeleton height={80} />
                <Skeleton height={80} />
              </>
            ) : articles.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">没有找到符合条件的文章</Typography>
              </Box>
            ) : (
              articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))
            )}
          </Box>

          {/* Pagination */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
            <FormControl size="small" sx={{ width: 120 }}>
              <InputLabel>每页条数</InputLabel>
              <Select
                value={pageSize}
                label="每页条数"
                onChange={(e) => setPageSize(e.target.value as number)}
              >
                <MenuItem value={10}>10 条</MenuItem>
                <MenuItem value={20}>20 条</MenuItem>
                <MenuItem value={50}>50 条</MenuItem>
              </Select>
            </FormControl>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              color="primary"
            />
          </Box>
        </Container>
      </Box>
    </LocalizationProvider>
  );
};

export default ArticleListPage;