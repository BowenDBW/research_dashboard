import { useState } from 'react';
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
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { ArticleActions } from '../../components/article/ArticleActions';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ContextMenu } from '../../components/common/ContextMenu';

const FavoritesPage = () => {
  const navigate = useNavigate();
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
    pasteFolder,
    removeFavorite,
  } = useFavoriteStore();

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeFavoriteDialogOpen, setRemoveFavoriteDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Navigate to folder on mount or folderId change
  useState(() => {
    navigateToFolder(folderId || null);
  });

  const handleBreadcrumbClick = (folderId: string | null) => {
    navigateToFolder(folderId);
    if (folderId === null) {
      navigate('/favorites');
    } else {
      navigate(`/favorites/${folderId}`);
    }
  };

  const handleFolderClick = (item: { id: string; type: string }) => {
    if (item.type === 'folder') {
      navigate(`/favorites/${item.id}`);
      navigateToFolder(item.id);
    }
  };

  const handleNewFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName);
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
      await pasteFolder(currentFolderId);
    }
  };

  const folderContextMenuItems = [
    {
      label: '修改文件夹',
      icon: <EditIcon />,
      onClick: () => {
        setRenameDialogOpen(true);
      },
    },
    {
      label: '删除文件夹',
      icon: <DeleteIcon />,
      danger: true,
      onClick: () => {
        setDeleteDialogOpen(true);
      },
    },
    {
      label: '剪贴文件夹',
      icon: <ContentCutIcon />,
      onClick: () => {
        if (selectedFolderId) {
          cutFolder(selectedFolderId);
        }
      },
    },
  ];

  const fileContextMenuItems = [
    {
      label: '取消收藏',
      icon: <DeleteIcon />,
      danger: true,
      onClick: () => {
        setRemoveFavoriteDialogOpen(true);
      },
    },
  ];

  const emptyContextMenuItems = [
    {
      label: '新建文件夹',
      icon: <AddIcon />,
      onClick: () => setNewFolderDialogOpen(true),
    },
    ...(clipboard
      ? [
          {
            label: '粘贴文件夹',
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
            新建文件夹
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
          {folderPath.map((node, index) => (
            <Link
              key={node.id || 'root'}
              component="button"
              variant="body2"
              onClick={() => handleBreadcrumbClick(node.id)}
              sx={{ cursor: 'pointer' }}
            >
              {node.name}
            </Link>
          ))}
        </Breadcrumbs>
      </Box>

      {/* Content */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 2, overflow: 'auto' }}>
        <Box sx={{ minHeight: '100%' }} onContextMenu={(e) => e.preventDefault()}>
          <List>
            {items.map((item) => (
              <div key={item.id}>
                {item.type === 'folder' ? (
                  <ContextMenu
                    items={folderContextMenuItems.map((i) => ({
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
                    items={fileContextMenuItems.map((i) => ({
                      ...i,
                      onClick: () => {
                        setSelectedArticleId(item.id);
                        i.onClick();
                      },
                    }))}
                  >
                    <ListItem disablePadding>
                      <Box sx={{ width: '100%', px: 2, py: 1.5 }}>
                        {item.article && (
                          <>
                            {/* 第一行：图标 + 标题 + AI按钮 + 功能按钮 */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <InsertDriveFileIcon sx={{ color: '#42A5F5', fontSize: 20 }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                                {item.article.title}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/?tab=summary&articleId=${item.article?.id}`)}
                                color="secondary"
                                sx={{ p: 0, '&:hover': { bgcolor: 'transparent' } }}
                              >
                                <AutoAwesomeIcon sx={{ fontSize: 14 }} />
                                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                  ASK AI
                                </Typography>
                              </IconButton>
                              <Box sx={{ flex: 1 }} />
                              <ArticleActions article={item.article} compact />
                            </Box>
                            {/* 第二行：来源 + 作者 */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, pl: 3.5 }}>
                              <Chip label={item.article.source} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {item.article.authors.join(', ')}
                              </Typography>
                            </Box>
                          </>
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
                    当前文件夹为空，右键点击此处新建文件夹
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

      {/* Dialogs */}
      <Dialog open={newFolderDialogOpen} onClose={() => setNewFolderDialogOpen(false)}>
        <DialogTitle>新建文件夹</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="文件夹名称"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleNewFolder}>
            创建
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>修改文件夹名称</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="新名称"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleRenameFolder}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="删除文件夹"
        message="确认删除该文件夹及其全部内容？此操作不可撤销。"
        severity="error"
        onConfirm={handleDeleteFolder}
        onCancel={() => setDeleteDialogOpen(false)}
      />

      <ConfirmDialog
        open={removeFavoriteDialogOpen}
        title="取消收藏"
        message="确认取消收藏该文章？"
        severity="warning"
        onConfirm={handleRemoveFavorite}
        onCancel={() => setRemoveFavoriteDialogOpen(false)}
      />
    </Box>
  );
};

export default FavoritesPage;