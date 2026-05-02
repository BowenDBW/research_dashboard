import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Divider,
  Link,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Article as ArticleIcon,
  OpenInNew as OpenInNewIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { getAllCategories } from '../../constants/academicCategories';

// Backend response types
interface ArxivFetchResult {
  title: string;
  authors: string[];
  abstract_text: string | null;
  categories: string[];
  publication_date: string | null;
  preprint_number: string;
  publication_link: string | null;
  pdf_link: string | null;
}

interface VenueRanking {
  id: number;
  venue_id: number;
  rankingSource: string;
  rankingCategory: string | null;
  ranking_year: number | null;
  category_detail: string | null;
}

interface VenueSearchResult {
  venue_id: number;
  name: string;
  abbreviation: string | null;
  venue_type: string | null;
  issn: string | null;
  eissn: string | null;
  publisher: string | null;
  rankings: VenueRanking[];
}

interface ManualAddResult {
  success: boolean;
  article_id: number | null;
  message: string;
  duplicate: boolean;
}

interface ManualAddDialogProps {
  open: boolean;
  onClose: () => void;
}

// Category option type
interface CategoryOption {
  code: string;
  name: string;
  parent: string;
}

export const ManualAddDialog = ({ open, onClose }: ManualAddDialogProps) => {
  const { t } = useTranslation();

  // All categories from predefined list
  const allCategories = useMemo(() => getAllCategories(), []);

  // Duplicate check state
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [existingArticleId, setExistingArticleId] = useState<number | null>(null);

  // State
  const [arxivNumber, setArxivNumber] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [arxivData, setArxivData] = useState<ArxivFetchResult | null>(null);

  // Manual fields (can be overridden by arxiv fetch)
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState<string[]>([]);
  const [abstract, setAbstract] = useState('');
  const [publicationDate, setPublicationDate] = useState<dayjs.Dayjs | null>(null);
  const [publicationLink, setPublicationLink] = useState('');
  const [pdfLink, setPdfLink] = useState('');
  const [pdfFilePath, setPdfFilePath] = useState('');

  // Venue state
  const [venueInputName, setVenueInputName] = useState('');
  const [venueOptions, setVenueOptions] = useState<VenueSearchResult[]>([]);
  const [matchedVenue, setMatchedVenue] = useState<VenueSearchResult | null>(null);
  const [searchingVenue, setSearchingVenue] = useState(false);

  // Venue publication link (separate from arxiv link)
  const [venuePublicationLink, setVenuePublicationLink] = useState('');

  // Manual venue info (for creating new venue)
  const [manualVenueAbbreviation, setManualVenueAbbreviation] = useState('');
  const [manualVenueType, setManualVenueType] = useState<'journal' | 'conference' | ''>('');
  const [manualVenueIssn, setManualVenueIssn] = useState('');
  const [manualVenuePublisher, setManualVenuePublisher] = useState('');
  const [publisherOptions, setPublisherOptions] = useState<string[]>([]);

  // Categories
  const [selectedCategories, setSelectedCategories] = useState<CategoryOption[]>([]);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<ManualAddResult | null>(null);

  // Computed: is form locked (arxiv data fetched)?
  const isLocked = arxivData !== null;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setArxivNumber('');
      setFetching(false);
      setFetchError(null);
      setArxivData(null);
      setTitle('');
      setAuthors([]);
      setAbstract('');
      setPublicationDate(null);
      setPublicationLink('');
      setPdfLink('');
      setPdfFilePath('');
      setVenueInputName('');
      setVenueOptions([]);
      setMatchedVenue(null);
      setSearchingVenue(false);
      setVenuePublicationLink('');
      setManualVenueAbbreviation('');
      setManualVenueType('');
      setManualVenueIssn('');
      setManualVenuePublisher('');
      setPublisherOptions([]);
      setSelectedCategories([]);
      setSubmitting(false);
      setSubmitResult(null);
      setDuplicateChecking(false);
      setExistingArticleId(null);
    }
  }, [open]);

  // Check for duplicates when title changes
  useEffect(() => {
    if (!title.trim() || title.length < 5) {
      setExistingArticleId(null);
      return;
    }

    const timer = setTimeout(async () => {
      setDuplicateChecking(true);
      try {
        const existingId = await invoke<number | null>('papers_check_exists', {
          title: title.trim(),
          preprintNumber: arxivNumber.trim() || null,
        });
        setExistingArticleId(existingId);
      } catch (error) {
        console.error('Failed to check duplicates:', error);
      } finally {
        setDuplicateChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [title, arxivNumber]);

  // Fetch from arxiv
  const handleFetchArxiv = async () => {
    if (!arxivNumber.trim()) return;

    setFetching(true);
    setFetchError(null);
    setArxivData(null);
    setSubmitResult(null);

    try {
      const result = await invoke<ArxivFetchResult>('papers_fetch_arxiv', {
        preprintNumber: arxivNumber.trim(),
      });

      setArxivData(result);
      setTitle(result.title);
      setAuthors(result.authors);
      setAbstract(result.abstract_text || '');
      setPublicationDate(result.publication_date ? dayjs(result.publication_date) : null);
      setPublicationLink(result.publication_link || '');
      setVenuePublicationLink(result.publication_link || ''); // 同步设置发表信息页网址
      setPdfLink(result.pdf_link || '');

      // Map categories to predefined options
      const matchedCategories = result.categories
        .map(code => allCategories.find(c => c.code === code))
        .filter((c): c is CategoryOption => c !== undefined);
      setSelectedCategories(matchedCategories);
    } catch (error) {
      const errorMsg = String(error);
      if (errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('请求失败') || errorMsg.includes('HTTP')) {
        setFetchError(t('manualAdd.fetchNetworkError'));
      } else {
        setFetchError(errorMsg);
      }
    } finally {
      setFetching(false);
    }
  };

  // Search venues
  const handleSearchVenue = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setVenueOptions([]);
      return;
    }

    setSearchingVenue(true);
    try {
      const results = await invoke<VenueSearchResult[]>('papers_search_venue', {
        query: query.trim(),
        limit: 20,
      });
      setVenueOptions(results);
    } catch (error) {
      console.error('Failed to search venues:', error);
      setVenueOptions([]);
    } finally {
      setSearchingVenue(false);
    }
  };

  // Debounced venue search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (venueInputName) {
        handleSearchVenue(venueInputName);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [venueInputName]);

  // Search publishers
  const handleSearchPublishers = async (query: string) => {
    if (!query.trim() || query.length < 1) {
      setPublisherOptions([]);
      return;
    }

    try {
      const results = await invoke<string[]>('papers_search_publisher', {
        query: query.trim(),
        limit: 10,
      });
      setPublisherOptions(results);
    } catch (error) {
      console.error('Failed to search publishers:', error);
      setPublisherOptions([]);
    }
  };

  // Debounced publisher search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (manualVenuePublisher && !matchedVenue) {
        handleSearchPublishers(manualVenuePublisher);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [manualVenuePublisher, matchedVenue]);

  // Select PDF file
  const handleSelectPdf = async () => {
    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (selected) {
        setPdfFilePath(selected as string);
        setPdfLink('');
      }
    } catch (error) {
      console.error('Failed to select PDF file:', error);
    }
  };

  // Submit
  const handleSubmit = async () => {
    const missingFields: string[] = [];
    if (!title.trim()) missingFields.push('标题');
    if (authors.length === 0) missingFields.push('作者');
    if (!publicationLink.trim()) missingFields.push('文章信息页网址');
    if (!pdfLink.trim() && !pdfFilePath.trim()) missingFields.push('PDF链接或文件');
    if (selectedCategories.length === 0) missingFields.push('领域分类');

    if (missingFields.length > 0) {
      setSubmitResult({
        success: false,
        article_id: null,
        message: `请填写必填项: ${missingFields.join('、')}`,
        duplicate: false,
      });
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    // Determine venue
    let venueName: string | null = null;
    let venueId: number | null = null;
    let venueAbbreviation: string | null = null;
    let venueType: string | null = null;
    let venueIssn: string | null = null;
    let venuePublisher: string | null = null;
    let venuePubLink: string | null = null;

    if (matchedVenue) {
      venueId = matchedVenue.venue_id;
      venueName = matchedVenue.name;
    } else if (venueInputName.trim()) {
      venueName = venueInputName.trim();
      venueAbbreviation = manualVenueAbbreviation.trim() || null;
      venueType = manualVenueType || null;
      venueIssn = manualVenueIssn.trim() || null;
      venuePublisher = manualVenuePublisher.trim() || null;
      venuePubLink = venuePublicationLink.trim() || null;
    }

    try {
      const result = await invoke<ManualAddResult>('papers_add_manual', {
        request: {
          arxiv_number: arxivNumber.trim() || null,
          title: title.trim(),
          authors: authors.length > 0 ? authors : null,
          publication_date: publicationDate ? publicationDate.format('YYYY-MM-DD') : null,
          abstract_text: abstract.trim() || null,
          venue_name: venueName,
          venue_abbreviation: venueAbbreviation,
          venue_type: venueType,
          venue_issn: venueIssn,
          venue_publisher: venuePublisher,
          venue_id: venueId,
          venue_publication_link: venuePubLink,
          publication_link: publicationLink.trim() || null,
          pdf_link: pdfLink.trim() || null,
          pdf_file: pdfFilePath.trim() || null,
          categories: selectedCategories.length > 0 ? selectedCategories.map(c => c.code) : null,
        },
        arxivData: arxivData,
      });

      setSubmitResult(result);

      if (result.success) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      setSubmitResult({
        success: false,
        article_id: null,
        message: String(error),
        duplicate: false,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Format ranking display
  const formatRankingChip = (ranking: VenueRanking) => {
    const source = ranking.rankingSource.toUpperCase();
    const category = ranking.rankingCategory || '';
    return `${source} ${category}`;
  };

  // Get ranking color
  const getRankingColor = (source: string, category: string | null): 'primary' | 'secondary' | 'success' | 'warning' | 'default' => {
    if (source === 'ccf') {
      if (category === 'A') return 'primary';
      if (category === 'B') return 'secondary';
      if (category === 'C') return 'success';
    }
    if (source === 'jcr') {
      if (category === 'Q1') return 'primary';
      if (category === 'Q2') return 'secondary';
      return 'success';
    }
    return 'default';
  };

  // Group rankings by source
  const groupRankings = (rankings: VenueRanking[]) => {
    const groups: Record<string, VenueRanking[]> = {};
    for (const r of rankings) {
      if (!groups[r.rankingSource]) {
        groups[r.rankingSource] = [];
      }
      groups[r.rankingSource].push(r);
    }
    return groups;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ArticleIcon color="primary" />
            <Typography variant="h6">{t('manualAdd.title')}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Duplicate Error */}
        {existingArticleId && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t('manualAdd.duplicateFound')}
            </Typography>
          </Alert>
        )}

        {/* Section 1: Article Basic Info */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t('manualAdd.articleInfo')}
            </Typography>
            {/* Import from arXiv - aligned to the right */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                placeholder={t('manualAdd.arxivPlaceholder')}
                value={arxivNumber}
                onChange={(e) => setArxivNumber(e.target.value)}
                size="small"
                sx={{ width: 300 }}
                disabled={fetching}
                slotProps={{
                  input: {
                    endAdornment: arxivNumber.trim() ? (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setArxivNumber('');
                          setArxivData(null);
                          setTitle('');
                          setAuthors([]);
                          setAbstract('');
                          setPublicationDate(null);
                          setPublicationLink('');
                          setVenuePublicationLink('');
                          setPdfLink('');
                          setPdfFilePath('');
                          setSelectedCategories([]);
                        }}
                        sx={{ mr: -1 }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null,
                  },
                }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={fetching ? <CircularProgress size={14} /> : <SearchIcon />}
                onClick={handleFetchArxiv}
                disabled={!arxivNumber.trim() || fetching || isLocked}
              >
                {t('manualAdd.import')}
              </Button>
            </Box>
          </Box>

          {fetchError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {fetchError}
            </Alert>
          )}
          {arxivData && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {t('manualAdd.fetchSuccess')}
            </Alert>
          )}

          {/* Arxiv Links */}
          {arxivData && (
            <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
              {arxivData.publication_link && (
                <Link
                  href={arxivData.publication_link}
                  target="_blank"
                  rel="noopener"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  {t('manualAdd.absPage')} <OpenInNewIcon fontSize="small" />
                </Link>
              )}
              {arxivData.pdf_link && (
                <Link
                  href={arxivData.pdf_link}
                  target="_blank"
                  rel="noopener"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  {t('manualAdd.pdfPage')} <OpenInNewIcon fontSize="small" />
                </Link>
              )}
            </Box>
          )}

          {/* Title */}
          <TextField
            fullWidth
            label={t('manualAdd.titleLabel')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            size="small"
            sx={{ mb: 2 }}
            disabled={isLocked}
            slotProps={{
              input: {
                endAdornment: duplicateChecking ? <CircularProgress size={16} /> : null,
              },
            }}
          />

          {/* Authors */}
          <Box sx={{ mb: 2 }}>
            <Autocomplete<string, true, false, true>
              multiple
              freeSolo
              options={[]}
              value={authors}
              onChange={(_, newValue) => setAuthors(newValue)}
              disabled={isLocked}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('manualAdd.authorsLabel')}
                  placeholder={authors.length === 0 ? t('manualAdd.authorsPlaceholder') : ''}
                  size="small"
                />
              )}
            />
          </Box>

          {/* Abstract */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label={t('manualAdd.abstractLabel')}
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            disabled={isLocked}
          />

          {/* Publication Date and Article Info URL */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label={t('manualAdd.dateLabel')}
                value={publicationDate}
                onChange={(newValue) => setPublicationDate(newValue)}
                disabled={isLocked}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
            <TextField
              fullWidth
              label={t('manualAdd.absPageLabel')}
              value={publicationLink}
              onChange={(e) => {
                const newValue = e.target.value;
                setPublicationLink(newValue);
                setVenuePublicationLink(newValue);
              }}
              size="small"
              disabled={isLocked}
              required
              error={!publicationLink.trim() && submitResult?.success === false}
              helperText={isLocked ? t('manualAdd.arxivSourceHint') : ''}
            />
          </Box>

          {/* PDF - Link or Upload */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('manualAdd.pdfHint')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              label={t('manualAdd.pdfLinkLabel')}
              value={pdfLink}
              onChange={(e) => {
                setPdfLink(e.target.value);
                if (e.target.value.trim().length > 0) {
                  setPdfFilePath('');
                }
              }}
              size="small"
              disabled={isLocked || pdfFilePath.trim().length > 0}
              error={!pdfLink.trim() && !pdfFilePath.trim() && submitResult?.success === false}
            />
            <TextField
              fullWidth
              label={t('manualAdd.pdfUploadLabel')}
              value={pdfFilePath}
              onChange={(e) => setPdfFilePath(e.target.value)}
              size="small"
              disabled={isLocked || pdfLink.trim().length > 0}
              placeholder={t('manualAdd.localFilePath')}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadFileIcon />}
              disabled={isLocked || pdfLink.trim().length > 0}
              sx={{ minWidth: 100 }}
              onClick={handleSelectPdf}
            >
              {t('manualAdd.selectFile')}
            </Button>
          </Box>

          {/* Categories */}
          <Box sx={{ mb: 2 }}>
            <Autocomplete<CategoryOption, true, false, false>
              multiple
              options={allCategories}
              value={selectedCategories}
              onChange={(_, newValue) => setSelectedCategories(newValue)}
              getOptionLabel={(option) => `${option.code} - ${option.name}`}
              groupBy={(option) => option.parent}
              disabled={isLocked}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('manualAdd.categoriesLabel')}
                  placeholder={t('manualAdd.categoryPlaceholder')}
                  size="small"
                />
              )}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                return (
                  <li key={key} {...otherProps}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {option.code}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.name}
                      </Typography>
                    </Box>
                  </li>
                );
              }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Section 2: Publication Info */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
            {t('manualAdd.venueSection')}
          </Typography>

          {/* Venue name input with autocomplete */}
          <Autocomplete<VenueSearchResult, false, false, true>
            freeSolo
            value={matchedVenue}
            onChange={(_, newValue) => {
              if (typeof newValue === 'string') {
                setMatchedVenue(null);
                setVenueInputName(newValue);
              } else {
                setMatchedVenue(newValue);
                if (newValue) {
                  setVenueInputName(newValue.name);
                }
              }
            }}
            inputValue={venueInputName}
            onInputChange={(_, newInputValue) => {
              setVenueInputName(newInputValue);
              if (matchedVenue && newInputValue !== matchedVenue.name) {
                setMatchedVenue(null);
              }
            }}
            options={venueOptions}
            getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
            loading={searchingVenue}
            filterOptions={(x) => x}
            isOptionEqualToValue={(option, value) => {
              if (typeof value === 'string') return false;
              return option.venue_id === value.venue_id;
            }}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              const rankingsBySource = groupRankings(option.rankings);
              return (
                <li key={key} {...otherProps}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{option.name}</Typography>
                      {option.abbreviation && (
                        <Typography variant="caption" color="text.secondary">
                          ({option.abbreviation})
                        </Typography>
                      )}
                      {option.venue_type && (
                        <Chip
                          label={option.venue_type === 'journal' ? t('manualAdd.journal') : t('manualAdd.conference')}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    {Object.keys(rankingsBySource).length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {Object.entries(rankingsBySource).map(([source, rankings]) => (
                          rankings.map((r) => (
                            <Chip
                              key={`${r.id}`}
                              label={formatRankingChip(r)}
                              size="small"
                              color={getRankingColor(source, r.rankingCategory)}
                            />
                          ))
                        ))}
                      </Box>
                    )}
                    {(option.issn || option.publisher) && (
                      <Typography variant="caption" color="text.secondary">
                        {option.publisher && `${option.publisher}`}
                        {option.issn && ` · ISSN: ${option.issn}`}
                      </Typography>
                    )}
                  </Box>
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('manualAdd.venueNameLabel')}
                placeholder={t('manualAdd.venuePlaceholder')}
                size="small"
              />
            )}
          />

          {/* Creating new venue hint */}
          {(!matchedVenue && venueInputName.trim().length > 0) && (
            <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
              {t('manualAdd.creatingVenue')}: <strong>{venueInputName}</strong>
            </Alert>
          )}

          <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Venue publication link - always editable */}
              <TextField
                label={t('manualAdd.venueAbsPageLabel')}
                value={venuePublicationLink}
                onChange={(e) => {
                const newValue = e.target.value;
                setVenuePublicationLink(newValue);
                setPublicationLink(newValue);
              }}
                size="small"
                fullWidth
                placeholder={t('manualAdd.venueAbsPagePlaceholder')}
                helperText={t('manualAdd.venueAbsPageHint')}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label={t('manualAdd.abbreviation')}
                  value={matchedVenue?.abbreviation || manualVenueAbbreviation}
                  onChange={(e) => setManualVenueAbbreviation(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!venueInputName.trim() || matchedVenue !== null}
                  placeholder={matchedVenue ? '' : t('manualAdd.abbreviationPlaceholder')}
                />
                <FormControl size="small" fullWidth disabled={!venueInputName.trim() || matchedVenue !== null}>
                  <InputLabel>{t('manualAdd.venueType')}</InputLabel>
                  <Select
                    value={matchedVenue?.venue_type || manualVenueType}
                    label={t('manualAdd.venueType')}
                    onChange={(e) => setManualVenueType(e.target.value as 'journal' | 'conference' | '')}
                  >
                    <MenuItem value="journal">{t('manualAdd.journal')}</MenuItem>
                    <MenuItem value="conference">{t('manualAdd.conference')}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label={t('manualAdd.issn')}
                  value={matchedVenue?.issn || manualVenueIssn}
                  onChange={(e) => setManualVenueIssn(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!venueInputName.trim() || matchedVenue !== null}
                  placeholder={matchedVenue ? '' : t('manualAdd.issnPlaceholder')}
                />
                <Autocomplete<string, false, false, true>
                  freeSolo
                  fullWidth
                  size="small"
                  value={matchedVenue?.publisher || manualVenuePublisher}
                  inputValue={matchedVenue?.publisher || manualVenuePublisher}
                  onInputChange={(_, newInputValue) => {
                    if (!matchedVenue) {
                      setManualVenuePublisher(newInputValue);
                    }
                  }}
                  onChange={(_, newValue) => {
                    if (!matchedVenue && typeof newValue === 'string') {
                      setManualVenuePublisher(newValue);
                    }
                  }}
                  options={publisherOptions}
                  disabled={!venueInputName.trim() || matchedVenue !== null}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('manualAdd.publisher')}
                    />
                  )}
                />
              </Box>
              {matchedVenue && matchedVenue.rankings.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    {t('manualAdd.rankingInfo')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {Object.entries(groupRankings(matchedVenue.rankings)).map(([source, rankings]) => (
                      rankings.map((r) => (
                        <Chip
                          key={`${r.id}`}
                          label={formatRankingChip(r)}
                          size="small"
                          color={getRankingColor(source, r.rankingCategory)}
                        />
                      ))
                    ))}
                  </Box>
                </Box>
              )}
              {!matchedVenue && venueInputName.trim().length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {t('manualAdd.newVenueNote')}
                </Typography>
              )}
            </Box>
          </Paper>

          {/* Default arXiv hint */}
          {!venueInputName.trim() && isLocked && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {t('manualAdd.arxivVenueHint')}
            </Typography>
          )}
        </Box>

        {/* Submit Result */}
        {submitResult && (
          <Alert severity={submitResult.success ? 'success' : submitResult.duplicate ? 'warning' : 'error'} sx={{ mt: 2 }}>
            {submitResult.message}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!title.trim() || submitting || existingArticleId !== null}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
        >
          {t('manualAdd.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};