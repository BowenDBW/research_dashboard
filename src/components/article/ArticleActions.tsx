import { useState, useEffect } from 'react';
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
  Collapse,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  OpenInNew as OpenInNewIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Download as DownloadIcon,
  Folder as FolderIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Article, FavoriteItem } from '../../types';
import { useFavorites } from '../../hooks';
import { useHistory } from '../../hooks';
import { AbstractDialog } from './AbstractDialog';
import { PdfViewerDialog } from './PdfViewerDialog';
import { openExternalUrl } from '../../utils/url';

interface FolderItem {
  id: string | null;
  name: string;
  children?: FolderItem[];
}

interface ArticleActionsProps {
  article: Article;
  isFavorited?: boolean;
  compact?: boolean;
  hideFavorite?: boolean;
  onFavorite?: (articleId: string) => void;
}

export const ArticleActions = ({
  article,
  isFavorited = false,
  compact = false,
  hideFavorite = false,
  onFavorite,
}: ArticleActionsProps) => {
  const { t } = useTranslation();
  const { logAction } = useHistory();
  const [abstractDialogOpen, setAbstractDialogOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'warning' | 'error'>('success');
  const [favorited, setFavorited] = useState(isFavorited);
  const [selectFolderDialogOpen, setSelectFolderDialogOpen] = useState(false);
  const [unfavoriteConfirmOpen, setUnfavoriteConfirmOpen] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  const { items, createFolder, addFavorite, removeFavorite } = useFavorites();

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

  const handleSelectFolder = async (folderId: string | null) => {
    logAction(article.id, 'favorite');

    await addFavorite(article, folderId);
    setFavorited(true);
    onFavorite?.(article.id);
    setSnackbarMessage(t('article.addToFavorites'));
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
    setSelectFolderDialogOpen(false);
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
      />

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