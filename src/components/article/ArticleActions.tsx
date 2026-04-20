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
} from '@mui/material';
import {
  Description as DescriptionIcon,
  OpenInNew as OpenInNewIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { Article } from '../../types';

interface ArticleActionsProps {
  article: Article;
  isFavorited?: boolean;
  compact?: boolean;
  onFavorite?: (articleId: string) => void;
}

export const ArticleActions = ({
  article,
  isFavorited = false,
  compact = false,
  onFavorite,
}: ArticleActionsProps) => {
  const [abstractDialogOpen, setAbstractDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [favorited, setFavorited] = useState(isFavorited);

  const handleAbstract = () => {
    setAbstractDialogOpen(true);
  };

  const handleSource = () => {
    window.open(article.url, '_blank');
    setSnackbarMessage('正在打开来源网页...');
    setSnackbarOpen(true);
  };

  const handleFavorite = () => {
    setFavorited(!favorited);
    onFavorite?.(article.id);
    setSnackbarMessage(favorited ? '已取消收藏' : '已添加到收藏夹');
    setSnackbarOpen(true);
  };

  const handleDownload = () => {
    window.open(article.pdfUrl, '_blank');
    setSnackbarMessage('正在下载 PDF...');
    setSnackbarOpen(true);
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: compact ? 0.25 : 0.5 }}>
        <Tooltip title="摘要">
          <IconButton size="small" onClick={handleAbstract} sx={{ p: 0.5 }}>
            <DescriptionIcon sx={{ fontSize: compact ? 16 : 18 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="来源">
          <IconButton size="small" onClick={handleSource} sx={{ p: 0.5 }}>
            <OpenInNewIcon sx={{ fontSize: compact ? 16 : 18 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={favorited ? '取消收藏' : '收藏'}>
          <IconButton
            size="small"
            onClick={handleFavorite}
            color={favorited ? 'primary' : 'default'}
            sx={{ p: 0.5 }}
          >
            {favorited ? (
              <BookmarkIcon sx={{ fontSize: compact ? 16 : 18 }} />
            ) : (
              <BookmarkBorderIcon sx={{ fontSize: compact ? 16 : 18 }} />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title="PDF">
          <IconButton size="small" onClick={handleDownload} sx={{ p: 0.5 }}>
            <DownloadIcon sx={{ fontSize: compact ? 16 : 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Abstract Dialog */}
      <Dialog open={abstractDialogOpen} onClose={() => setAbstractDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{article.title}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" gutterBottom>
            作者: {article.authors.join(', ')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            来源: {article.source} | 发布日期: {article.publishDate}
          </Typography>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            摘要
          </Typography>
          <Typography variant="body1">{article.abstract}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbstractDialogOpen(false)}>关闭</Button>
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