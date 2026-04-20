import { Card, CardContent, Typography, Chip, Box, IconButton, Tooltip } from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Article } from '../../types';
import { ArticleActions } from './ArticleActions';

interface ArticleCardProps {
  article: Article;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const navigate = useNavigate();

  const handleAiSummary = () => {
    navigate(`/?tab=summary&articleId=${article.id}`);
  };

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        {/* Title row with AI button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Tooltip title={article.title} arrow enterDelay={500}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 1,
                minWidth: 0,
                cursor: 'default',
              }}
            >
              {article.title}
            </Typography>
          </Tooltip>
          <Tooltip title="AI 总结">
            <IconButton
              size="small"
              onClick={handleAiSummary}
              color="secondary"
              sx={{ p: 0, '&:hover': { bgcolor: 'transparent' }, flexShrink: 0 }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 16 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                ASK AI
              </Typography>
            </IconButton>
          </Tooltip>
        </Box>

        {/* Authors */}
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 0.5 }}>
          {article.authors.join(', ')}
        </Typography>

        {/* Tags and actions row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            <Chip label={article.source} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
            <Typography variant="caption" color="text.secondary">
              {article.publishDate}
            </Typography>
            {article.domains.slice(0, 2).map((domain) => (
              <Chip key={domain} label={domain} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            ))}
          </Box>
          <ArticleActions article={article} isFavorited={article.isFavorited} />
        </Box>
      </CardContent>
    </Card>
  );
};