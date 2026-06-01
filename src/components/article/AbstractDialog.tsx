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
  Snackbar,
  Alert,
  Chip,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Download as DownloadIcon,
  AutoAwesome as AutoAwesomeIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Folder as FolderIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpwardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Article, VenueRanking } from '../../types';
import { useFavoritesStore } from '../../stores';
import { useChat } from '../../stores';
import { useHistoryStore } from '../../stores';
import { PdfViewerDialog } from './PdfViewerDialog';
import { openExternalUrl } from '../../utils/url';

interface VenueSearchResult {
  venueId: number;
  name: string;
  abbreviation: string | null;
  venueType: string | null;
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
  onArticleUpdated?: (article: Article) => void;
  hideActions?: boolean;
}

export const AbstractDialog = ({
  open,
  article,
  isFavorited = false,
  onClose,
  onFavoriteChange,
  onArticleDeleted,
  onArticleUpdated,
  hideActions = false,
}: AbstractDialogProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { logAction, deleteRecentAction } = useHistoryStore();

  // 本地收藏状态，同步props
  const [localFavorited, setLocalFavorited] = useState(isFavorited);
  useEffect(() => {
    setLocalFavorited(isFavorited);
  }, [isFavorited]);

  // 本地article状态，用于即时显示更新
  const [localArticle, setLocalArticle] = useState<Article | null>(null);
  useEffect(() => {
    setLocalArticle(article);
  }, [article]);

  // 记录打开摘要页面
  useEffect(() => {
    if (open && localArticle) {
      logAction(localArticle.id, 'view_abstract');
    }
  }, [open, localArticle?.id, logAction]);

  const [selectFolderDialogOpen, setSelectFolderDialogOpen] = useState(false);
  const [unfavoriteConfirmOpen, setUnfavoriteConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: t('article.rootFolder') }]);
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

  const { items, createFolder, addFavorite, removeFavorite, navigateToFolder } = useFavoritesStore();
  const { createSession } = useChat();

  // 获取当前文件夹下的子文件夹
  const currentSubFolders = items
    .filter(item => item.type === 'folder' && item.parentId === currentFolderId)
    .map(item => ({ id: item.id, name: item.name }));

  // Search venues
  const handleSearchVenue = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setVenueOptions([]);
      return;
    }

    setSearchingVenue(true);
    try {
      const results = await invoke<VenueSearchResult[]>('papers_search_venue', {
        name: query.trim(),
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

  if (!localArticle) return null;

  const handleSource = () => {
    if (!localArticle) return;
    // 如果刚打开摘要页面，删除view_abstract记录
    deleteRecentAction(localArticle.id, 'view_abstract');
    logAction(localArticle.id, 'view_source');

    const hasVenueInfo = localArticle.venueId && localArticle.venueId > 0;
    if (hasVenueInfo && localArticle.url) {
      openExternalUrl(localArticle.url);
    } else if (!hasVenueInfo && localArticle.preprintNumber) {
      openExternalUrl(`https://arxiv.org/abs/${localArticle.preprintNumber}`);
    }
  };

  const handlePreviewPdf = () => {
    if (!localArticle) return;
    // 如果刚打开摘要页面，删除view_abstract记录
    deleteRecentAction(localArticle.id, 'view_abstract');
    logAction(localArticle.id, 'download');
    setPdfViewerOpen(true);
  };

  const handleAskAI = () => {
    createSession('chapter_summary', { articleId: localArticle!.id, articleTitle: localArticle!.title });
    navigate('/');
    onClose();
  };

  const handleFavoriteClick = () => {
    if (localFavorited) {
      setUnfavoriteConfirmOpen(true);
    } else {
      // Reset to root folder when opening dialog
      setCurrentFolderId(null);
      setFolderPath([{ id: null, name: t('article.rootFolder') }]);
      navigateToFolder(null);
      setSelectFolderDialogOpen(true);
    }
  };

  const handleSelectFolder = () => {
    if (!localArticle) return;
    // 如果刚打开摘要页面，删除view_abstract记录
    deleteRecentAction(localArticle.id, 'view_abstract');
    logAction(localArticle.id, 'favorite');

    addFavorite(localArticle, currentFolderId);
    setLocalFavorited(true);
    onFavoriteChange?.(true);
    setSnackbarMessage(t('article.addToFavorites'));
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
    setSelectFolderDialogOpen(false);
  };

  const handleNavigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setFolderPath(prev => [...prev, { id: folderId, name: folderName }]);
  };

  const handleBreadcrumbClick = (folderId: string | null, index: number) => {
    setCurrentFolderId(folderId);
    setFolderPath(prev => prev.slice(0, index + 1));
  };

  const handleConfirmUnfavorite = async () => {
    if (!localArticle) return;
    try {
      await removeFavorite(localArticle.id);
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
      const newFolder = await createFolder(newFolderName, currentFolderId);
      setNewFolderName('');
      setShowNewFolderInput(false);
      // 进入新创建的文件夹
      if (newFolder) {
        handleNavigateToFolder(newFolder, newFolderName);
      }
    }
  };

  // 编辑信息对话框打开
  const handleOpenEditInfo = () => {
    if (!localArticle) return;
    // 初始化venue状态
    if (hasVenueInfo && localArticle.venueName) {
      setVenueInputName(localArticle.venueName);
    } else {
      setVenueInputName('');
    }
    setMatchedVenue(null);
    setVenueOptions([]);
    setManualVenueAbbreviation(localArticle.venueAbbreviation || '');
    setManualVenueType((localArticle.venueType as 'journal' | 'conference') || '');
    setManualVenueIssn('');
    setManualVenuePublisher('');
    // 初始化arxiv状态
    setArxivInput(localArticle.preprintNumber || '');
    // 初始化publication link状态
    setPublicationLinkInput(localArticle.url || '');
    setEditInfoDialogOpen(true);
  };

  // 导入arxiv信息（覆盖文章基本信息）
  const handleImportArxiv = async () => {
    if (!arxivInput.trim() || !localArticle) return;
    setImportingArxiv(true);
    try {
      // 调用后端导入arxiv信息，覆盖文章基本信息
      await invoke('papers_import_arxiv_info', {
        articleId: parseInt(localArticle.id),
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
    if (!localArticle) return;
    setSavingInfo(true);
    try {
      // 1. 保存venue信息
      if (matchedVenue) {
        await invoke('papers_update_venue', {
          articleId: parseInt(localArticle.id),
          venueId: matchedVenue.venueId,
        });
      } else if (venueInputName.trim()) {
        // 用户输入了venue名称但没有从下拉选择，创建新venue
        const result = await invoke<{ venueId: number }>('papers_create_venue_full', {
          name: venueInputName.trim(),
          abbreviation: manualVenueAbbreviation.trim() || null,
          venueType: manualVenueType || null,
          issn: manualVenueIssn.trim() || null,
          publisher: manualVenuePublisher.trim() || null,
        });
        await invoke('papers_update_venue', {
          articleId: parseInt(localArticle.id),
          venueId: result.venueId,
        });
      } else if (!venueInputName.trim() && hasVenueInfo) {
        // 清空venue信息
        await invoke('papers_update_venue', {
          articleId: parseInt(localArticle.id),
          venueId: null,
        });
      }

      // 2. 保存publication link
      if (publicationLinkInput.trim() !== localArticle.url) {
        await invoke('papers_update_publication_link', {
          articleId: parseInt(localArticle.id),
          publicationLink: publicationLinkInput.trim() || null,
        });
      }

      // 3. 获取最新的文章数据并更新本地状态
      const updatedArticle = await invoke<Article>('paper_detail', {
        articleId: parseInt(localArticle.id),
      });
      setLocalArticle(updatedArticle);
      if (onArticleUpdated) {
        onArticleUpdated(updatedArticle);
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
    if (!localArticle) return;
    try {
      await invoke('papers_delete', {
        articleId: parseInt(localArticle.id),
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
  const hasVenueInfo = localArticle?.venueId && localArticle.venueId > 0;

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
                {localArticle!.title}
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
        <DialogContent dividers>
          {/* 作者列表 */}
          <Typography variant="subtitle2" gutterBottom>
            {t('article.authors')}: {localArticle!.authors.join(', ')}
          </Typography>

          {/* Meta info row - venue info or arXiv + 编辑按钮 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {/* Source chip - clickable if has url */}
              <Chip
                label={localArticle!.source}
                size="small"
                onClick={localArticle!.url ? handleSource : undefined}
                icon={localArticle!.url ? <OpenInNewIcon sx={{ fontSize: 14 }} /> : undefined}
                sx={{ cursor: localArticle!.url ? 'pointer' : 'default' }}
              />
              {/* Venue type */}
              {hasVenueInfo && localArticle!.venueType && (
                <Chip
                  label={localArticle!.venueType === 'journal' ? t('article.journal') : t('article.conference')}
                  size="small"
                  variant="outlined"
                />
              )}
            {/* Rankings */}
            {hasVenueInfo && localArticle!.rankings && localArticle!.rankings.map((r) => (
              <Chip
                key={r.id}
                label={formatRankingChip(r)}
                size="small"
                color={getRankingColor(r.rankingSource, r.rankingCategory)}
              />
            ))}
            {/* Publish date */}
            <Typography variant="body2" color="text.secondary">
              {t('article.publishedDate')}: {localArticle!.publishDate}
            </Typography>
            </Box>
            {/* 编辑信息按钮 */}
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={handleOpenEditInfo}
            >
              {t('article.editInfo')}
            </Button>
          </Box>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            {t('article.abstract')}
          </Typography>
          <Typography variant="body1">{localArticle!.abstract}</Typography>
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
          {/* Breadcrumb navigation */}
          <Breadcrumbs sx={{ mb: 2 }}>
            {folderPath.map((node, index) => (
              <Link
                key={node.id || 'root'}
                component="button"
                variant="body2"
                onClick={() => handleBreadcrumbClick(node.id, index)}
                sx={{ cursor: 'pointer' }}
              >
                {node.name}
              </Link>
            ))}
          </Breadcrumbs>

          {/* Navigate to parent button */}
          {currentFolderId && (
            <ListItemButton onClick={() => handleBreadcrumbClick(folderPath[folderPath.length - 2]?.id, folderPath.length - 2)}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <ArrowUpwardIcon sx={{ color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText primary={t('article.parentFolder')} />
            </ListItemButton>
          )}

          {/* Subfolders list */}
          <List>
            {currentSubFolders.map(folder => (
              <ListItemButton key={folder.id} onClick={() => handleNavigateToFolder(folder.id, folder.name)}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <FolderIcon sx={{ color: '#FFA726' }} />
                </ListItemIcon>
                <ListItemText primary={folder.name} />
              </ListItemButton>
            ))}
            {currentSubFolders.length === 0 && !currentFolderId && (
              <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                {t('favorites.emptyFolder')}
              </Typography>
            )}
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
          <Button variant="contained" onClick={handleSelectFolder}>
            {t('article.confirmSelect')}
          </Button>
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
            {!localArticle?.preprintNumber && (
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
                  // 同步更新venueInputName为显示格式，避免onInputChange误清空
                  if (newValue) {
                    setVenueInputName(newValue.abbreviation ? `${newValue.abbreviation} (${newValue.name})` : newValue.name);
                  }
                }
              }}
              inputValue={venueInputName}
              onInputChange={(_, newInputValue, reason) => {
                // 只有用户输入时才更新，选择时不处理（onChange已处理）
                if (reason === 'input') {
                  setVenueInputName(newInputValue);
                  // 用户修改输入，清空matchedVenue
                  if (matchedVenue) {
                    setMatchedVenue(null);
                  }
                }
              }}
              options={venueOptions}
              getOptionLabel={(option) => typeof option === 'string' ? option : (option.abbreviation ? `${option.abbreviation} (${option.name})` : option.name)}
              loading={searchingVenue}
              filterOptions={(x) => x}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                const rankingsBySource = groupRankings(option.rankings);
                return (
                  <li key={key} {...otherProps}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{option.abbreviation || option.name}</Typography>
                        {option.abbreviation && (
                          <Typography variant="caption" color="text.secondary">
                            ({option.name})
                          </Typography>
                        )}
                        {option.venueType && (
                          <Chip
                            label={option.venueType === 'journal' ? t('article.journal') : t('article.conference')}
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

            {/* 正式venue（有分区信息）不允许修改 */}
            {matchedVenue && matchedVenue.rankings && matchedVenue.rankings.length > 0 && (
              <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
                {t('article.officialVenueHint')}
              </Alert>
            )}

            <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* 有分区信息的venue不允许修改基本信息 */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label={t('manualAdd.abbreviation')}
                    value={matchedVenue?.abbreviation || manualVenueAbbreviation}
                    onChange={(e) => setManualVenueAbbreviation(e.target.value)}
                    size="small"
                    fullWidth
                    disabled={!venueInputName.trim() || (matchedVenue !== null && matchedVenue.rankings && matchedVenue.rankings.length > 0)}
                    placeholder={matchedVenue ? '' : t('manualAdd.abbreviationPlaceholder')}
                  />
                  <FormControl size="small" fullWidth disabled={!venueInputName.trim() || (matchedVenue !== null && matchedVenue.rankings && matchedVenue.rankings.length > 0)}>
                    <InputLabel>{t('manualAdd.venueType')}</InputLabel>
                    <Select
                      value={matchedVenue?.venueType || manualVenueType}
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
                    disabled={!venueInputName.trim() || (matchedVenue !== null && matchedVenue.rankings && matchedVenue.rankings.length > 0)}
                    placeholder={matchedVenue ? '' : t('manualAdd.issnPlaceholder')}
                  />
                  <Autocomplete<string, false, false, true>
                    freeSolo
                    fullWidth
                    size="small"
                    value={matchedVenue?.publisher || manualVenuePublisher}
                    inputValue={matchedVenue?.publisher || manualVenuePublisher}
                    onInputChange={(_, newInputValue) => {
                      if (!matchedVenue || !matchedVenue.rankings || matchedVenue.rankings.length === 0) {
                        setManualVenuePublisher(newInputValue);
                      }
                    }}
                    onChange={(_, newValue) => {
                      if ((!matchedVenue || !matchedVenue.rankings || matchedVenue.rankings.length === 0) && typeof newValue === 'string') {
                        setManualVenuePublisher(newValue);
                      }
                    }}
                    options={publisherOptions}
                    disabled={!venueInputName.trim() || (matchedVenue !== null && matchedVenue.rankings && matchedVenue.rankings.length > 0)}
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
        pdfUrl={localArticle!.pdfUrl}
        pdfPath={localArticle!.pdfPath}
        title={localArticle!.title}
      />
    </>
  );
};