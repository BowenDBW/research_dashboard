import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Container,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowUpward as ArrowUpwardIcon,
  Folder as FolderIcon,
  InsertDriveFile as InsertDriveFileIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCut as ContentCutIcon,
  ContentPaste as ContentPasteIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFavoritesStore } from '../../stores';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ContextMenu } from '../../components/common/ContextMenu';
import { AbstractDialog } from '../../components/article/AbstractDialog';
import { Article } from '../../types';

const FavoritesPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { folderId } = useParams();
  const {
    currentFolderId,
    folderPath,
    items,
    clipboard,
    navigateToFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    cutFolder,
    cutPaper,
    pasteItem,
    removeFavorite,
  } = useFavoritesStore();

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeFavoriteDialogOpen, setRemoveFavoriteDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [abstractDialogOpen, setAbstractDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedArticleFavorited, setSelectedArticleFavorited] = useState(false);

  // Navigate to folder on mount or folderId change
  useEffect(() => {
    navigateToFolder(folderId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const handleBreadcrumbClick = (folderId: string | null) => {
    if (folderId === null) {
      navigate('/favorites');
    } else {
      navigate(`/favorites/${folderId}`);
    }
  };

  const handleFolderClick = (item: { id: string; type: string }) => {
    if (item.type === 'folder') {
      navigate(`/favorites/${item.id}`);
    }
  };

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
    setSelectedArticleFavorited(true);
    setAbstractDialogOpen(true);
  };

  const handleAbstractDialogClose = () => {
    setAbstractDialogOpen(false);
    setSelectedArticle(null);
  };

  const handleFavoriteChange = (isFavorited: boolean) => {
    setSelectedArticleFavorited(isFavorited);
  };

  const handleNewFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName, currentFolderId);
      setNewFolderDialogOpen(false);
      setNewFolderName('');
    }
  };

  const handleRenameFolder = async () => {
    if (selectedFolderId && newFolderName.trim()) {
      await renameFolder(selectedFolderId, newFolderName);
      setRenameDialogOpen(false);
      setNewFolderName('');
      setSelectedFolderId(null);
    }
  };

  const handleDeleteFolder = async () => {
    if (selectedFolderId) {
      await deleteFolder(selectedFolderId);
      setDeleteDialogOpen(false);
      setSelectedFolderId(null);
    }
  };

  const handleRemoveFavorite = async () => {
    if (selectedArticleId) {
      await removeFavorite(selectedArticleId);
      setRemoveFavoriteDialogOpen(false);
      setSelectedArticleId(null);
    }
  };

  const handlePaste = async () => {
    if (clipboard) {
      await pasteItem(currentFolderId);
    }
  };

  // 格式化作者列表：最多显示3个，多于3个显示 "et al."
  const formatAuthors = (authors: string[]) => {
    if (authors.length <= 3) {
      return authors.join(', ');
    }
    return `${authors.slice(0, 3).join(', ')} et al.`;
  };

  const folderContextMenuItems = (folderId: string) => [
    {
      label: t('favorites.renameFolder'),
      icon: <EditIcon />,
      onClick: () => {
        setRenameDialogOpen(true);
      },
    },
    {
      label: t('favorites.cutFolder'),
      icon: <ContentCutIcon />,
      onClick: () => {
        cutFolder(folderId);
      },
    },
    ...(clipboard
      ? [
          {
            label: t('favorites.pasteFolder'),
            icon: <ContentPasteIcon />,
            onClick: handlePaste,
          },
        ]
      : []),
    {
      label: t('favorites.deleteFolder'),
      icon: <DeleteIcon />,
      danger: true,
      onClick: () => {
        setDeleteDialogOpen(true);
      },
    },
  ];

  const fileContextMenuItems = (article: Article, itemId: string) => [
    {
      label: t('favorites.properties'),
      icon: <InfoIcon />,
      onClick: () => {
        handleArticleClick(article);
      },
    },
    {
      label: t('favorites.cut'),
      icon: <ContentCutIcon />,
      onClick: () => {
        cutPaper(itemId);
      },
    },
    {
      label: t('favorites.unfavorite'),
      icon: <DeleteIcon />,
      danger: true,
      onClick: () => {
        setRemoveFavoriteDialogOpen(true);
      },
    },
  ];

  const emptyContextMenuItems = [
    {
      label: t('favorites.newFolder'),
      icon: <AddIcon />,
      onClick: () => setNewFolderDialogOpen(true),
    },
    ...(clipboard
      ? [
          {
            label: t('favorites.pasteFolder'),
            icon: <ContentPasteIcon />,
            onClick: handlePaste,
          },
        ]
      : []),
  ];

  const canGoUp = folderPath.length > 1;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'background.paper' }}>
        <Toolbar>
          <IconButton onClick={() => navigate('/')}>
            <ArrowBackIcon />
          </IconButton>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setNewFolderDialogOpen(true)}
            sx={{ ml: 2 }}
          >
            {t('favorites.newFolder')}
          </Button>
          <IconButton
            onClick={() => {
              const parentId = folderPath[folderPath.length - 2]?.id;
              handleBreadcrumbClick(parentId);
            }}
            disabled={!canGoUp}
            sx={{ ml: 1 }}
          >
            <ArrowUpwardIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Breadcrumb */}
      <Box sx={{ px: 3, py: 2, bgcolor: 'background.paper' }}>
        <Breadcrumbs>
          {folderPath.map((node) => (
            <Link
              key={node.id || 'root'}
              component="button"
              variant="body2"
              onClick={() => handleBreadcrumbClick(node.id)}
              sx={{ cursor: 'pointer' }}
            >
              {node.id === null ? t('favorites.rootFolder') : node.name}
            </Link>
          ))}
        </Breadcrumbs>
      </Box>

      {/* Content */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 2, overflow: 'auto' }}>
        <Box sx={{ minHeight: '100%' }} onContextMenu={(e) => e.preventDefault()}>
          <List>
            {items.map((item) => (
              <div key={`${item.type}-${item.id}`}>
                {item.type === 'folder' ? (
                  <ContextMenu
                    items={folderContextMenuItems(item.id).map((i) => ({
                      ...i,
                      onClick: () => {
                        setSelectedFolderId(item.id);
                        i.onClick();
                      },
                    }))}
                  >
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => handleFolderClick(item)}>
                        <ListItemIcon>
                          <FolderIcon sx={{ color: '#FFA726' }} />
                        </ListItemIcon>
                        <ListItemText primary={item.name} />
                      </ListItemButton>
                    </ListItem>
                  </ContextMenu>
                ) : (
                  <ContextMenu
                    items={fileContextMenuItems(item.article!, item.id).map((i) => ({
                      ...i,
                      onClick: () => {
                        setSelectedArticleId(item.id);
                        i.onClick();
                      },
                    }))}
                  >
                    <ListItem
                      disablePadding
                      onClick={() => item.article && handleArticleClick(item.article)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <Box sx={{ width: '100%', px: 2, py: 1.5 }}>
                        {item.article && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* 图标 */}
                            <InsertDriveFileIcon sx={{ color: '#42A5F5', fontSize: 20, flexShrink: 0 }} />

                            {/* 来源 */}
                            <Chip label={item.article.source} size="small" sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }} />

                            {/* 标题 - 带 Tooltip */}
                            <Tooltip title={item.article.title} arrow enterDelay={500}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                                {item.article.title}
                              </Typography>
                            </Tooltip>

                            {/* 作者 */}
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 1, minWidth: 0 }}>
                              {formatAuthors(item.article.authors)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                  </ContextMenu>
                )}
                <Divider />
              </div>
            ))}
            {items.length === 0 ? (
              <ContextMenu items={emptyContextMenuItems}>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 8,
                    minHeight: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography color="text.secondary">
                    {t('favorites.emptyFolder')}
                  </Typography>
                </Box>
              </ContextMenu>
            ) : (
              <ContextMenu items={emptyContextMenuItems}>
                <Box sx={{ py: 4, minHeight: 100 }} />
              </ContextMenu>
            )}
          </List>
        </Box>
      </Container>

      {/* Abstract Dialog */}
      <AbstractDialog
        open={abstractDialogOpen}
        article={selectedArticle}
        isFavorited={selectedArticleFavorited}
        onClose={handleAbstractDialogClose}
        onFavoriteChange={handleFavoriteChange}
        hideActions
      />

      {/* Dialogs */}
      <Dialog open={newFolderDialogOpen} onClose={() => setNewFolderDialogOpen(false)}>
        <DialogTitle>{t('favorites.newFolder')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('favorites.folderName')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleNewFolder}>
            {t('favorites.create')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>{t('favorites.renameFolder')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('favorites.newName')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleRenameFolder}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title={t('favorites.deleteFolder')}
        message={t('favorites.deleteConfirm')}
        severity="error"
        onConfirm={handleDeleteFolder}
        onCancel={() => setDeleteDialogOpen(false)}
      />

      <ConfirmDialog
        open={removeFavoriteDialogOpen}
        title={t('favorites.unfavorite')}
        message={t('favorites.unfavoriteConfirm')}
        severity="warning"
        onConfirm={handleRemoveFavorite}
        onCancel={() => setRemoveFavoriteDialogOpen(false)}
      />
    </Box>
  );
};

export default FavoritesPage;