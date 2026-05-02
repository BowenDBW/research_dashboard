import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Tooltip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Collapse,
  Snackbar,
  Alert,
  Chip,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Download as DownloadIcon,
  AutoAwesome as AutoAwesomeIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Folder as FolderIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Article, FavoriteItem, VenueRanking } from '../../types';
import { useFavorites } from '../../hooks';
import { useChat } from '../../hooks';
import { useHistory } from '../../hooks';
import { PdfViewerDialog } from './PdfViewerDialog';
import { openExternalUrl } from '../../utils/url';

interface FolderItem {
  id: string | null;
  name: string;
  children?: FolderItem[];
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

interface AbstractDialogProps {
  open: boolean;
  article: Article | null;
  isFavorited?: boolean;
  onClose: () => void;
  onFavoriteChange?: (isFavorited: boolean) => void;
  onArticleDeleted?: () => void;
  hideActions?: boolean;
}

export const AbstractDialog = ({
  open,
  article,
  isFavorited = false,
  onClose,
  onFavoriteChange,
  onArticleDeleted,
  hideActions = false,
}: AbstractDialogProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { logAction, deleteRecentAction } = useHistory();

  // 本地收藏状态，同步props
  const [localFavorited, setLocalFavorited] = useState(isFavorited);
  useEffect(() => {
    setLocalFavorited(isFavorited);
  }, [isFavorited]);

  // 记录打开摘要页面
  useEffect(() => {
    if (open && article) {
      logAction(article.id, 'view_abstract');
    }
  }, [open, article?.id, logAction]);

  const [selectFolderDialogOpen, setSelectFolderDialogOpen] = useState(false);
  const [unfavoriteConfirmOpen, setUnfavoriteConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  // Venue edit state
  const [editInfoDialogOpen, setEditInfoDialogOpen] = useState(false);
  const [venueInputName, setVenueInputName] = useState('');
  const [venueOptions, setVenueOptions] = useState<VenueSearchResult[]>([]);
  const [matchedVenue, setMatchedVenue] = useState<VenueSearchResult | null>(null);
  const [searchingVenue, setSearchingVenue] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  // Arxiv补录状态
  const [arxivInput, setArxivInput] = useState('');
  const [importingArxiv, setImportingArxiv] = useState(false);

  // Publication link编辑状态
  const [publicationLinkInput, setPublicationLinkInput] = useState('');

  // Manual venue info (for creating new venue)
  const [manualVenueAbbreviation, setManualVenueAbbreviation] = useState('');
  const [manualVenueType, setManualVenueType] = useState<'journal' | 'conference' | ''>('');
  const [manualVenueIssn, setManualVenueIssn] = useState('');
  const [manualVenuePublisher, setManualVenuePublisher] = useState('');
  const [publisherOptions, setPublisherOptions] = useState<string[]>([]);

  const { items, createFolder, addFavorite, removeFavorite } = useFavorites();
  const { createSession } = useChat();

  // 获取所有文件夹
  useEffect(() => {
    const buildFolderTree = (folderItems: FavoriteItem[], parentId: string | null = null): FolderItem[] => {
      return folderItems
        .filter(item => item.type === 'folder' && item.parentId === parentId)
        .map(item => ({
          id: item.id,
          name: item.name,
          children: item.children ? buildFolderTree(item.children, item.id) : [],
        }));
    };
    setFolders(buildFolderTree(items));
  }, [items]);

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
      if (venueInputName && editInfoDialogOpen) {
        handleSearchVenue(venueInputName);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [venueInputName, editInfoDialogOpen]);

  // Search publishers
  const handleSearchPublishers = async (query: string) => {
    if (!query.trim()) {
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
      if (manualVenuePublisher && !matchedVenue && editInfoDialogOpen) {
        handleSearchPublishers(manualVenuePublisher);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [manualVenuePublisher, matchedVenue, editInfoDialogOpen]);

  if (!article) return null;

  const handleSource = () => {
    if (!article) return;
    // 如果刚打开摘要页面，删除view_abstract记录
    deleteRecentAction(article.id, 'view_abstract');
    logAction(article.id, 'view_source');

    const hasVenueInfo = article.venueId && article.venueId > 0;
    if (hasVenueInfo && article.url) {
      openExternalUrl(article.url);
    } else if (!hasVenueInfo && article.preprintNumber) {
      openExternalUrl(`https://arxiv.org/abs/${article.preprintNumber}`);
    }
  };

  const handlePreviewPdf = () => {
    if (!article) return;
    // 如果刚打开摘要页面，删除view_abstract记录
    deleteRecentAction(article.id, 'view_abstract');
    logAction(article.id, 'download');
    setPdfViewerOpen(true);
  };

  const handleAskAI = () => {
    createSession('chapter_summary', { articleId: article.id, articleTitle: article.title });
    navigate('/');
    onClose();
  };

  const handleFavoriteClick = () => {
    if (localFavorited) {
      setUnfavoriteConfirmOpen(true);
    } else {
      setSelectFolderDialogOpen(true);
    }
  };

  const handleSelectFolder = async (folderId: string | null) => {
    if (!article) return;
    // 如果刚打开摘要页面，删除view_abstract记录
    deleteRecentAction(article.id, 'view_abstract');
    logAction(article.id, 'favorite');

    await addFavorite(article, folderId);
    setLocalFavorited(true);
    onFavoriteChange?.(true);
    setSnackbarMessage(t('article.addToFavorites'));
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
    setSelectFolderDialogOpen(false);
  };

  const handleConfirmUnfavorite = async () => {
    if (!article) return;
    try {
      await removeFavorite(article.id);
      setLocalFavorited(false);
      onFavoriteChange?.(false);
      setSnackbarMessage(t('article.removedFromFavorites'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setUnfavoriteConfirmOpen(false);
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      setSnackbarMessage(t('common.error'));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleCreateNewFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName);
      setNewFolderName('');
      setShowNewFolderInput(false);
    }
  };

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const renderFolderTree = (folders: FolderItem[], depth = 0) => {
    return folders.map(folder => (
      <Box key={folder.id}>
        <ListItemButton
          sx={{ pl: 2 + depth * 2 }}
          onClick={() => handleSelectFolder(folder.id)}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <FolderIcon sx={{ color: '#FFA726' }} />
          </ListItemIcon>
          <ListItemText primary={folder.name} />
          {folder.children && folder.children.length > 0 && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolderExpand(folder.id!);
              }}
              sx={{ p: 0.5 }}
            >
              {expandedFolders.has(folder.id!) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          )}
        </ListItemButton>
        {folder.children && folder.children.length > 0 && (
          <Collapse in={expandedFolders.has(folder.id!)}>
            {renderFolderTree(folder.children, depth + 1)}
          </Collapse>
        )}
      </Box>
    ));
  };

  // 编辑信息对话框打开
  const handleOpenEditInfo = () => {
    // 初始化venue状态
    if (hasVenueInfo && article.venueName) {
      setVenueInputName(article.venueName);
    } else {
      setVenueInputName('');
    }
    setMatchedVenue(null);
    setVenueOptions([]);
    setManualVenueAbbreviation(article.venueAbbreviation || '');
    setManualVenueType((article.venueType as 'journal' | 'conference') || '');
    setManualVenueIssn('');
    setManualVenuePublisher('');
    // 初始化arxiv状态
    setArxivInput(article.preprintNumber || '');
    // 初始化publication link状态
    setPublicationLinkInput(article.url || '');
    setEditInfoDialogOpen(true);
  };

  // 导入arxiv信息（覆盖文章基本信息）
  const handleImportArxiv = async () => {
    if (!arxivInput.trim()) return;
    setImportingArxiv(true);
    try {
      // 调用后端导入arxiv信息，覆盖文章基本信息
      await invoke('papers_import_arxiv_info', {
        articleId: parseInt(article.id),
        arxivId: arxivInput.trim(),
      });
      setSnackbarMessage(t('article.arxivImportSuccess'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      // 刷新文章信息需要外部处理，这里暂时关闭对话框
      setEditInfoDialogOpen(false);
    } catch (error) {
      console.error('Failed to import arxiv:', error);
      setSnackbarMessage(t('article.arxivImportFailed'));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setImportingArxiv(false);
    }
  };

  // 保存编辑信息
  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      // 1. 保存venue信息
      if (matchedVenue) {
        await invoke('papers_update_venue', {
          articleId: parseInt(article.id),
          venueId: matchedVenue.venue_id,
        });
      } else if (venueInputName.trim()) {
        const result = await invoke<{ venue_id: number }>('papers_create_venue_full', {
          name: venueInputName.trim(),
          abbreviation: manualVenueAbbreviation.trim() || null,
          venueType: manualVenueType || null,
          issn: manualVenueIssn.trim() || null,
          publisher: manualVenuePublisher.trim() || null,
        });
        await invoke('papers_update_venue', {
          articleId: parseInt(article.id),
          venueId: result.venue_id,
        });
      } else if (!venueInputName.trim() && hasVenueInfo) {
        // 清空venue信息
        await invoke('papers_update_venue', {
          articleId: parseInt(article.id),
          venueId: null,
        });
      }

      // 2. 保存publication link
      if (publicationLinkInput.trim() !== article.url) {
        await invoke('papers_update_publication_link', {
          articleId: parseInt(article.id),
          publicationLink: publicationLinkInput.trim() || null,
        });
      }

      setSnackbarMessage(t('article.editInfo') + ' - ' + t('common.success'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setEditInfoDialogOpen(false);
    } catch (error) {
      console.error('Failed to save info:', error);
      setSnackbarMessage(t('article.editInfo') + ' - ' + t('common.error'));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setSavingInfo(false);
    }
  };

  // Delete handlers
  const handleDeleteArticle = async () => {
    try {
      await invoke('papers_delete', {
        articleId: parseInt(article.id),
      });
      setSnackbarMessage(t('article.deleteSuccess'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setDeleteConfirmOpen(false);
      onArticleDeleted?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete article:', error);
      setSnackbarMessage(t('article.deleteFailed'));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
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

  // Check if article has venue info (venue_id > 0)
  const hasVenueInfo = article.venueId && article.venueId > 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { maxHeight: '85vh' } }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, pr: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {article.title}
              </Typography>
              <Tooltip title={t('article.aiSummary')} arrow>
                <IconButton size="small" onClick={handleAskAI} color="secondary" sx={{ p: 0.5 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, ml: 0.5 }}>{t('article.askAI')}</Typography>
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ position: 'relative' }}>
          {/* 编辑信息按钮 - 右上角 */}
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={handleOpenEditInfo}
            sx={{ position: 'absolute', right: 16, top: 16 }}
          >
            {t('article.editInfo')}
          </Button>

          <Typography variant="subtitle2" gutterBottom>
            {t('article.authors')}: {article.authors.join(', ')}
          </Typography>
          {/* Meta info row - venue info or arXiv */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            {/* Source chip - clickable if has url */}
            <Chip
              label={article.source}
              size="small"
              onClick={article.url ? handleSource : undefined}
              icon={article.url ? <OpenInNewIcon sx={{ fontSize: 14 }} /> : undefined}
              sx={{ cursor: article.url ? 'pointer' : 'default' }}
            />
            {/* Venue type */}
            {hasVenueInfo && article.venueType && (
              <Chip
                label={article.venueType === 'journal' ? t('article.journal') : t('article.conference')}
                size="small"
                variant="outlined"
              />
            )}
            {/* Rankings */}
            {hasVenueInfo && article.rankings && article.rankings.map((r) => (
              <Chip
                key={r.id}
                label={formatRankingChip(r)}
                size="small"
                color={getRankingColor(r.rankingSource, r.rankingCategory)}
              />
            ))}
            {/* Publish date */}
            <Typography variant="body2" color="text.secondary">
              {t('article.publishedDate')}: {article.publishDate}
            </Typography>
          </Box>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            {t('article.abstract')}
          </Typography>
          <Typography variant="body1">{article.abstract}</Typography>
        </DialogContent>
        {!hideActions && (
          <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={localFavorited ? t('article.unfavoriteTooltip') : t('article.favoriteTooltip')}>
                <IconButton onClick={handleFavoriteClick} color={localFavorited ? 'primary' : 'default'}>
                  {localFavorited ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title={t('article.deleteArticle')}>
                <IconButton onClick={() => setDeleteConfirmOpen(true)} color="error">
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<OpenInNewIcon />} onClick={handleSource}>
                {t('article.sourceButton')}
              </Button>
              <Button startIcon={<DownloadIcon />} onClick={handlePreviewPdf}>
                {t('article.previewPdf')}
              </Button>
            </Box>
          </DialogActions>
        )}
      </Dialog>

      {/* Select Folder Dialog */}
      <Dialog open={selectFolderDialogOpen} onClose={() => setSelectFolderDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('article.selectFolder')}</DialogTitle>
        <DialogContent>
          <List sx={{ pt: 1 }}>
            <ListItemButton onClick={() => handleSelectFolder(null)}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <FolderIcon sx={{ color: '#FFA726' }} />
              </ListItemIcon>
              <ListItemText primary={t('article.rootFolder')} />
            </ListItemButton>
            {renderFolderTree(folders)}
          </List>

          {/* 新建文件夹 */}
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            {!showNewFolderInput ? (
              <Button startIcon={<FolderIcon />} onClick={() => setShowNewFolderInput(true)}>
                {t('article.newFolder')}
              </Button>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder={t('article.folderName')}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  fullWidth
                />
                <Button variant="contained" onClick={handleCreateNewFolder}>
                  {t('article.create')}
                </Button>
                <Button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}>
                  {t('common.cancel')}
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectFolderDialogOpen(false)}>{t('common.cancel')}</Button>
        </DialogActions>
      </Dialog>

      {/* Unfavorite Confirm Dialog */}
      <Dialog open={unfavoriteConfirmOpen} onClose={() => setUnfavoriteConfirmOpen(false)}>
        <DialogTitle>{t('article.confirmUnfavoriteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('article.confirmUnfavorite')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnfavoriteConfirmOpen(false)}>{t('common.back')}</Button>
          <Button variant="contained" color="error" onClick={handleConfirmUnfavorite}>
            {t('article.unfavorite')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>{t('article.confirmDeleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('article.confirmDelete')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>{t('common.back')}</Button>
          <Button variant="contained" color="error" onClick={handleDeleteArticle}>
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Info Dialog */}
      <Dialog open={editInfoDialogOpen} onClose={() => setEditInfoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('article.editInfo')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Arxiv补录section - 只有当没有preprintNumber时显示 */}
            {!article.preprintNumber && (
              <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('article.arxivSection')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    placeholder={t('article.arxivPlaceholder')}
                    value={arxivInput}
                    onChange={(e) => setArxivInput(e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleImportArxiv}
                    disabled={!arxivInput.trim() || importingArxiv}
                    startIcon={importingArxiv ? <CircularProgress size={16} /> : undefined}
                  >
                    {t('article.import')}
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {t('article.arxivImportNote')}
                </Typography>
              </Box>
            )}

            {/* Publication link编辑 - 永远可以改 */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                size="small"
                label={t('article.publicationLink')}
                value={publicationLinkInput}
                onChange={(e) => setPublicationLinkInput(e.target.value)}
                placeholder={t('article.publicationLinkPlaceholder')}
              />
            </Box>

            {/* Venue编辑section */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('article.venueSection')}
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
                            label={option.venue_type === 'journal' ? t('article.journal') : t('article.conference')}
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
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('article.venueName')}
                  placeholder={t('manualAdd.venuePlaceholder')}
                  size="small"
                />
              )}
            />

            {/* Venue info section - show when entering new venue name */}
            {venueInputName.trim().length > 0 && !matchedVenue && (
              <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
                {t('manualAdd.creatingVenue')}: <strong>{venueInputName}</strong>
              </Alert>
            )}

            <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditInfoDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSaveInfo}
            disabled={savingInfo}
            startIcon={savingInfo ? <CircularProgress size={16} /> : undefined}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* PDF Viewer Dialog */}
      <PdfViewerDialog
        open={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        pdfUrl={article.pdfUrl}
        pdfPath={article.pdfPath}
        title={article.title}
      />
    </>
  );
};