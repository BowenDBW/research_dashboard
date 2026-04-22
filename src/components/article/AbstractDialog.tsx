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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Article, FavoriteItem } from '../../types';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { useChatStore } from '../../stores/useChatStore';

interface FolderItem {
  id: string | null;
  name: string;
  children?: FolderItem[];
}

interface AbstractDialogProps {
  open: boolean;
  article: Article | null;
  isFavorited?: boolean;
  onClose: () => void;
  onFavoriteChange?: (isFavorited: boolean) => void;
  hideActions?: boolean;
}

export const AbstractDialog = ({
  open,
  article,
  isFavorited = false,
  onClose,
  onFavoriteChange,
  hideActions = false,
}: AbstractDialogProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectFolderDialogOpen, setSelectFolderDialogOpen] = useState(false);
  const [unfavoriteConfirmOpen, setUnfavoriteConfirmOpen] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const { items, createFolder, addFavorite, removeFavorite } = useFavoriteStore();
  const { createSession } = useChatStore();

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

  if (!article) return null;

  const handleSource = () => {
    window.open(article.url, '_blank');
  };

  const handleDownload = () => {
    window.open(article.pdfUrl, '_blank');
  };

  const handleAskAI = () => {
    // Create a new session with article info and switch to chapter_summary mode
    createSession('chapter_summary', { articleId: article.id, articleTitle: article.title });
    navigate('/');
    onClose();
  };

  const handleFavoriteClick = () => {
    if (isFavorited) {
      setUnfavoriteConfirmOpen(true);
    } else {
      setSelectFolderDialogOpen(true);
    }
  };

  const handleSelectFolder = async (folderId: string | null) => {
    await addFavorite(article, folderId);
    onFavoriteChange?.(true);
    setSnackbarMessage(t('article.addToFavorites'));
    setSnackbarOpen(true);
    setSelectFolderDialogOpen(false);
  };

  const handleConfirmUnfavorite = async () => {
    await removeFavorite(article.id);
    onFavoriteChange?.(false);
    setSnackbarMessage(t('article.removedFromFavorites'));
    setSnackbarOpen(true);
    setUnfavoriteConfirmOpen(false);
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
          onClick={() => folder.children && folder.children.length > 0 ? toggleFolderExpand(folder.id!) : handleSelectFolder(folder.id)}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <FolderIcon sx={{ color: '#FFA726' }} />
          </ListItemIcon>
          <ListItemText primary={folder.name} />
          {folder.children && folder.children.length > 0 && (
            expandedFolders.has(folder.id!) ? <ExpandLessIcon /> : <ExpandMoreIcon />
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

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { aspectRatio: '16/9', maxHeight: '80vh' },
        }}
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
        <DialogContent dividers>
          <Typography variant="subtitle2" gutterBottom>
            {t('article.authors')}: {article.authors.join(', ')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('article.source')}: {article.source} | {t('article.publishedDate')}: {article.publishDate}
          </Typography>
          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            {t('article.abstract')}
          </Typography>
          <Typography variant="body1">{article.abstract}</Typography>
        </DialogContent>
        {!hideActions && (
          <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={isFavorited ? t('article.unfavoriteTooltip') : t('article.favoriteTooltip')}>
              <IconButton onClick={handleFavoriteClick} color={isFavorited ? 'primary' : 'default'}>
                {isFavorited ? <BookmarkIcon /> : <BookmarkBorderIcon />}
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<OpenInNewIcon />} onClick={handleSource}>
              {t('article.sourceButton')}
            </Button>
            <Button startIcon={<DownloadIcon />} onClick={handleDownload}>
              {t('article.pdf')}
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
          <Button onClick={() => setUnfavoriteConfirmOpen(false)}>{t('common.cancel')}</Button>
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
        message={snackbarMessage}
      />
    </>
  );
};
