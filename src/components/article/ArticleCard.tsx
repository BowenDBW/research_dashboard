import { Card, CardContent, Typography, Chip, Box, IconButton, Tooltip } from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Article } from '../../types';
import { ArticleActions } from './ArticleActions';
import { openExternalUrl } from '../../utils/url';
import { useHistory } from '../../hooks';

interface ArticleCardProps {
  article: Article;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logAction } = useHistory();

  // Check if article has venue info (not just arXiv)
  const hasVenueInfo = article.venueId && article.venueId > 0;

  const handleAiSummary = () => {
    navigate(`/?tab=summary&articleId=${article.id}`);
  };

  const handleSourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    logAction(article.id, 'view_source');

    // If has venue info, open publication_link
    if (hasVenueInfo && article.url) {
      openExternalUrl(article.url);
    } else if (!hasVenueInfo && article.preprintNumber) {
      // If arXiv article, open arxiv page
      openExternalUrl(`https://arxiv.org/abs/${article.preprintNumber}`);
    }
  };

  // Format ranking display
  const formatRankingChip = (ranking: { rankingSource: string; rankingCategory: string | null }) => {
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
          <Tooltip title={t('article.aiSummary')} arrow>
            <IconButton
              size="small"
              onClick={handleAiSummary}
              color="secondary"
              sx={{ p: 0, '&:hover': { bgcolor: 'transparent' }, flexShrink: 0 }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 16 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('article.askAI')}
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
            {/* Venue source - clickable */}
            {hasVenueInfo ? (
              <Tooltip title={article.url ? t('article.viewSource') : ''}>
                <Chip
                  label={article.source}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    cursor: article.url ? 'pointer' : 'default',
                    '&:hover': article.url ? { bgcolor: 'primary.light' } : {},
                  }}
                  onClick={handleSourceClick}
                  icon={article.url ? <OpenInNewIcon sx={{ fontSize: 12 }} /> : undefined}
                />
              </Tooltip>
            ) : (
              <Tooltip title={article.preprintNumber ? t('article.viewSource') : ''}>
                <Chip
                  label={article.source}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    cursor: article.preprintNumber ? 'pointer' : 'default',
                    '&:hover': article.preprintNumber ? { bgcolor: 'primary.light' } : {},
                  }}
                  onClick={handleSourceClick}
                  icon={article.preprintNumber ? <OpenInNewIcon sx={{ fontSize: 12 }} /> : undefined}
                />
              </Tooltip>
            )}

            {/* Venue type - only show if has venue info */}
            {hasVenueInfo && article.venueType && (
              <Chip
                label={article.venueType === 'journal' ? t('article.journal') : t('article.conference')}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            )}

            {/* Rankings - only show if has venue info */}
            {hasVenueInfo && article.rankings && article.rankings.slice(0, 2).map((ranking) => (
              <Chip
                key={ranking.id}
                label={formatRankingChip(ranking)}
                size="small"
                color={getRankingColor(ranking.rankingSource, ranking.rankingCategory)}
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            ))}

            <Typography variant="caption" color="text.secondary">
              {article.publishDate}
            </Typography>

            {/* Domains */}
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