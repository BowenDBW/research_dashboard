import { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Snackbar,
  Alert,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  OpenInNew as OpenInNewIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Download as DownloadIcon,
  Folder as FolderIcon,
  ArrowUpward as ArrowUpwardIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Article } from '../../types';
import { useFavoritesStore, useHistoryStore } from '../../stores';
import { AbstractDialog } from './AbstractDialog';
import { PdfViewerDialog } from './PdfViewerDialog';
import { openExternalUrl } from '../../utils/url';

interface ArticleActionsProps {
  article: Article;
  isFavorited?: boolean;
  compact?: boolean;
  hideFavorite?: boolean;
  onFavorite?: (articleId: string) => void;
  onArticleUpdated?: (article: Article) => void;
}

export const ArticleActions = ({
  article,
  isFavorited = false,
  compact = false,
  hideFavorite = false,
  onFavorite,
  onArticleUpdated,
}: ArticleActionsProps) => {
  const { t } = useTranslation();
  const { logAction } = useHistoryStore();
  const [abstractDialogOpen, setAbstractDialogOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'warning' | 'error'>('success');
  const [favorited, setFavorited] = useState(isFavorited);
  const [selectFolderDialogOpen, setSelectFolderDialogOpen] = useState(false);
  const [unfavoriteConfirmOpen, setUnfavoriteConfirmOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: t('article.rootFolder') }]);

  const { items, createFolder, addFavorite, removeFavorite, navigateToFolder } = useFavoritesStore();

  // 获取当前文件夹下的子文件夹
  const currentSubFolders = items
    .filter(item => item.type === 'folder' && item.parentId === currentFolderId)
    .map(item => ({ id: item.id, name: item.name }));

  const handleAbstract = () => {
    setAbstractDialogOpen(true);
  };

  const handleSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    logAction(article.id, 'view_source');

    const hasVenueInfo = article.venueId && article.venueId > 0;
    if (hasVenueInfo && article.url) {
      openExternalUrl(article.url);
    } else if (!hasVenueInfo && article.preprintNumber) {
      openExternalUrl(`https://arxiv.org/abs/${article.preprintNumber}`);
    } else {
      setSnackbarMessage(t('article.noPublicationLink'));
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
  };

  const handleFavoriteClick = () => {
    if (favorited) {
      setUnfavoriteConfirmOpen(true);
    } else {
      // Reset to root folder when opening dialog
      setCurrentFolderId(null);
      setFolderPath([{ id: null, name: t('article.rootFolder') }]);
      navigateToFolder(null);
      setSelectFolderDialogOpen(true);
    }
  };

  const handleConfirmUnfavorite = async () => {
    try {
      await removeFavorite(article.id);
      setFavorited(false);
      onFavorite?.(article.id);
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

  const handleSelectFolder = () => {
    logAction(article.id, 'favorite');

    addFavorite(article, currentFolderId);
    setFavorited(true);
    onFavorite?.(article.id);
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

  const handlePreviewPdf = () => {
    logAction(article.id, 'download');
    setPdfViewerOpen(true);
  };

  // 按钮尺寸：compact 模式保持原样，非 compact 模式放大一号
  const iconSize = compact ? 18 : 20;
  const buttonPadding = compact ? 0.5 : 0.75;

  return (
    <>
      <Box sx={{ display: 'flex', gap: compact ? 0.25 : 0.5 }}>
        <Tooltip title={t('article.abstract')}>
          <IconButton size="small" onClick={handleAbstract} sx={{ p: buttonPadding }}>
            <DescriptionIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('article.source')}>
          <IconButton size="small" onClick={handleSource} sx={{ p: buttonPadding }}>
            <OpenInNewIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>

        {!hideFavorite && (
          <Tooltip title={favorited ? t('article.unfavoriteTooltip') : t('article.favoriteTooltip')}>
            <IconButton
              size="small"
              onClick={handleFavoriteClick}
              color={favorited ? 'primary' : 'default'}
              sx={{ p: buttonPadding }}
            >
              {favorited ? (
                <BookmarkIcon sx={{ fontSize: iconSize }} />
              ) : (
                <BookmarkBorderIcon sx={{ fontSize: iconSize }} />
              )}
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title={t('article.previewPdf')}>
          <IconButton size="small" onClick={handlePreviewPdf} sx={{ p: buttonPadding }}>
            <DownloadIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Abstract Dialog */}
      <AbstractDialog
        open={abstractDialogOpen}
        article={article}
        isFavorited={favorited}
        onClose={() => setAbstractDialogOpen(false)}
        onFavoriteChange={(newFavorited) => setFavorited(newFavorited)}
        onArticleUpdated={onArticleUpdated}
      />

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