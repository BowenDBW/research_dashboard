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
  Tooltip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useArticleStore } from '../../stores/useArticleStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { ArticleCard } from '../../components/article/ArticleCard';

const ArticleListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { settings } = useSettingsStore();
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
  const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);
  const [prevShowArxivOnly, setPrevShowArxivOnly] = useState(false);

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
          <Toolbar sx={{ gap: 1.5, minHeight: 56 }}>
            <IconButton onClick={() => navigate('/')} size="small">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" noWrap>
              {t('articles.title')}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={t('articles.showArxiv')} arrow>
              <FormControlLabel
                control={
                  <Switch
                    checked={showArxivOnly}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setShowArxivOnly(checked);
                      if (checked) {
                        // 打开时默认全选已配置的 crawler categories
                        setLocalDomains([...settings.crawlerCategories]);
                      } else {
                        setLocalDomains([]);
                      }
                    }}
                    size="small"
                  />
                }
                label={<Typography variant="body2" noWrap>{t('articles.arxiv')}</Typography>}
                sx={{ mr: 0.5 }}
              />
            </Tooltip>
            <Tooltip title={t('articles.showSubscribed')} arrow>
              <FormControlLabel
                control={
                  <Switch
                    checked={showSubscribedOnly}
                    onChange={(e) => setShowSubscribedOnly(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography variant="body2" noWrap>{t('articles.subscribed')}</Typography>}
                sx={{ mr: 1 }}
              />
            </Tooltip>
            <TextField
              size="small"
              placeholder={t('articles.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFilterChange()}
              sx={{ minWidth: 150, flex: '0 1 250px' }}
              slotProps={{
                input: {
                  startAdornment: <SearchIcon color="action" sx={{ mr: 1, fontSize: 18 }} />,
                },
              }}
            />
          </Toolbar>
        </AppBar>

        {/* Fixed Filter Bar */}
        <Paper sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0, bgcolor: 'background.paper', zIndex: 2, borderRadius: 0 }}>
          <Box sx={{ maxWidth: 'lg', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* 第一行：开始日期 | 结束日期 | 会议/期刊 */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box sx={{ width: '25%' }}>
                <DatePicker
                  label={t('articles.startDate')}
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Box>
              <Box sx={{ width: '25%' }}>
                <DatePicker
                  label={t('articles.endDate')}
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Box>
              <Box sx={{ width: '50%' }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>{t('articles.conference')}</InputLabel>
                  <Select
                    multiple
                    value={localSources}
                    label={t('articles.conference')}
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
              </Box>
            </Box>

            {/* 领域筛选（仅当 arXiv 开关打开时显示） */}
            {showArxivOnly && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('articles.domainsLabel')}:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {settings.crawlerCategories.map((domain) => (
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
              </Box>
            )}
          </Box>
        </Paper>

        {/* Content - Scrollable Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <Container maxWidth="lg" sx={{ flex: 1, pt: 2, pb: 2, overflow: 'auto', position: 'relative' }}>
            {/* Top Gradient overlay - 文章滑动时渐变消失 */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 32,
                background: (theme) => `linear-gradient(to bottom, ${theme.palette.background.paper}F2, ${theme.palette.background.paper}00)`,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />

            {/* Bottom Gradient overlay - 文章滑动到底部时渐变消失 */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 32,
                background: (theme) => `linear-gradient(to top, ${theme.palette.background.paper}F2, ${theme.palette.background.paper}00)`,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />

            {/* Article List */}
            <Box>
              {loading ? (
                <>
                  <Skeleton height={80} />
                  <Skeleton height={80} />
                  <Skeleton height={80} />
                </>
              ) : articles.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">{t('articles.noResults')}</Typography>
                </Box>
              ) : (
                articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))
              )}
            </Box>
          </Container>

          {/* Pagination - Fixed at bottom */}
          <Paper sx={{ px: 3, py: 1, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Box sx={{ maxWidth: 'lg', mx: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FormControl size="small" sx={{ width: 100 }}>
                <InputLabel>{t('articles.perPage')}</InputLabel>
                <Select
                  value={pageSize}
                  label={t('articles.perPage')}
                  onChange={(e) => setPageSize(e.target.value as number)}
                >
                  <MenuItem value={5}>{t('articles.itemsPerPage', { count: 5 })}</MenuItem>
                  <MenuItem value={10}>{t('articles.itemsPerPage', { count: 10 })}</MenuItem>
                  <MenuItem value={20}>{t('articles.itemsPerPage', { count: 20 })}</MenuItem>
                  <MenuItem value={50}>{t('articles.itemsPerPage', { count: 50 })}</MenuItem>
                </Select>
              </FormControl>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
                size="small"
              />
            </Box>
          </Paper>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default ArticleListPage;