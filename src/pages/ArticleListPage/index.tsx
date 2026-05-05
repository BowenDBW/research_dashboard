import { useState, useEffect, useCallback } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  FormControlLabel,
  Switch,
  Tooltip,
  Autocomplete,
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
import { useArticles, useSubscription } from '../../hooks';
import { ArticleCard } from '../../components/article/ArticleCard';

interface VenueRanking {
  id: number;
  venueId: number;
  rankingSource: string;
  rankingCategory: string | null;
}

interface VenueOption {
  name: string;
  abbreviation?: string;
  venueType?: string;
  rankings?: VenueRanking[];
}

const ArticleListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { articles, totalCount, loading, fetchArticles, searchVenues } = useArticles();
  const { categories, loadSubscriptions } = useSubscription();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSources, setLocalSources] = useState<string | null>(null);
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([]);
  const [venueSearchLoading, setVenueSearchLoading] = useState(false);
  const [venueInputValue, setVenueInputValue] = useState('');
  const [localDomains, setLocalDomains] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(null);
  const [showArxivOnly, setShowArxivOnly] = useState(false);
  const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);

  // Load subscribed categories on mount
  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // Get domain codes from subscribed categories
  const subscribedDomainCodes = categories.map(c => c.category);

  // Venue search handler
  const handleVenueSearch = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setVenueOptions([]);
      return;
    }
    setVenueSearchLoading(true);
    const results = await searchVenues(query, 20);
    setVenueOptions(results.map(v => ({
      name: v.name,
      abbreviation: v.abbreviation || undefined,
      venueType: v.venueType || undefined,
      rankings: v.rankings,
    })));
    setVenueSearchLoading(false);
  }, [searchVenues]);

  const loadArticles = useCallback(() => {
    fetchArticles({
      page,
      pageSize,
      query: searchQuery || null,
      startDate: startDate?.format('YYYY-MM-DD') || null,
      endDate: endDate?.format('YYYY-MM-DD') || null,
      sources: localSources ? [localSources] : null,
      domains: showArxivOnly && localDomains.length > 0 ? localDomains : null,
      subscribedOnly: showSubscribedOnly,
    });
  }, [page, pageSize, searchQuery, startDate, endDate, localSources, localDomains, showArxivOnly, showSubscribedOnly, fetchArticles]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const handleFilterChange = () => {
    loadArticles();
  };

  const handleDomainToggle = (domain: string) => {
    setLocalDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleArticleUpdated = useCallback(() => {
    loadArticles();
  }, [loadArticles]);

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
                        setLocalDomains([...subscribedDomainCodes]);
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
            <Tooltip title={t('articles.showSubscribedHint')} arrow>
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
                <Autocomplete
                  size="small"
                  options={venueOptions}
                  getOptionLabel={(option) => option.abbreviation ? `${option.abbreviation} (${option.name})` : option.name}
                  value={localSources ? (venueOptions.find(v => v.name === localSources || v.abbreviation === localSources) || { name: localSources }) : null}
                  onInputChange={(e, value) => {
                    setVenueInputValue(value);
                    handleVenueSearch(value);
                  }}
                  inputValue={venueInputValue}
                  onChange={(_, newValue) => setLocalSources(newValue ? (newValue.abbreviation || newValue.name) : null)}
                  loading={venueSearchLoading}
                  groupBy={(option) => option.venueType === 'journal' ? t('articles.journalGroup') : option.venueType === 'conference' ? t('articles.conferenceGroup') : t('articles.otherGroup')}
                  isOptionEqualToValue={(option, value) => option.name === value.name || option.abbreviation === value.name}
                  renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    return (
                      <li key={key} {...otherProps}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {option.abbreviation || option.name}
                            </Typography>
                            {option.abbreviation && (
                              <Typography variant="caption" color="text.secondary">
                                ({option.name})
                              </Typography>
                            )}
                          </Box>
                          {option.rankings && option.rankings.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {option.rankings.map((r) => (
                                <Chip
                                  key={r.id}
                                  label={`${r.rankingSource.toUpperCase()} ${r.rankingCategory || ''}`}
                                  size="small"
                                  color={
                                    r.rankingSource === 'ccf'
                                      ? r.rankingCategory === 'A' ? 'primary' : r.rankingCategory === 'B' ? 'secondary' : 'success'
                                      : r.rankingSource === 'jcr'
                                        ? r.rankingCategory === 'Q1' ? 'primary' : r.rankingCategory === 'Q2' ? 'secondary' : 'success'
                                        : 'default'
                                  }
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label={t('articles.conference')} placeholder={t('articles.conferencePlaceholder')} />
                  )}
                  noOptionsText={t('articles.typeToSearch')}
                  filterOptions={(x) => x}
                />
              </Box>
            </Box>

            {/* 领域筛选（仅当 arXiv 开关打开时显示） */}
            {showArxivOnly && subscribedDomainCodes.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('articles.domainsLabel')}:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {subscribedDomainCodes.map((domain) => (
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
          {/* Top Gradient overlay - outside scroll container */}
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

          <Container maxWidth="lg" sx={{ flex: 1, pt: 2, pb: 2, overflow: 'auto' }}>
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
                  <ArticleCard key={article.id} article={article} onArticleUpdated={handleArticleUpdated} />
                ))
              )}
            </Box>
          </Container>

          {/* Bottom Gradient overlay - outside scroll container */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 48,
              left: 0,
              right: 0,
              height: 32,
              background: (theme) => `linear-gradient(to top, ${theme.palette.background.paper}F2, ${theme.palette.background.paper}00)`,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* Pagination - Fixed at bottom */}
          <Paper sx={{ px: 3, py: 1, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Box sx={{ maxWidth: 'lg', mx: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FormControl size="small" sx={{ width: 100 }}>
                <InputLabel>{t('articles.perPage')}</InputLabel>
                <Select
                  value={pageSize}
                  label={t('articles.perPage')}
                  onChange={(e) => {
                    setPageSize(e.target.value as number);
                    setPage(1);
                  }}
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