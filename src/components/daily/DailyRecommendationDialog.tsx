import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Article as ArticleIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDailyStore } from '../../stores';
import { ArticleCard } from '../article/ArticleCard';
import { DailyRecommendation } from '../../types';

interface DailyRecommendationDialogProps {
  open: boolean;
  recommendationId: string | null;
  onClose: () => void;
}

export const DailyRecommendationDialog = ({ open, recommendationId, onClose }: DailyRecommendationDialogProps) => {
  const { t } = useTranslation();
  const { fetchRecommendationById, loading } = useDailyStore();
  const [recommendation, setRecommendation] = useState<DailyRecommendation | null>(null);

  useEffect(() => {
    if (open && recommendationId) {
      fetchRecommendationById(recommendationId).then((r) => {
        setRecommendation(r);
      });
    }
    if (!open) {
      setRecommendation(null);
    }
  }, [open, recommendationId, fetchRecommendationById]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            {loading ? (
              <Skeleton width={200} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  icon={<CalendarIcon />}
                  label={recommendation?.date || ''}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<ArticleIcon />}
                  label={t('dailyRecommendation.articleCount', { count: recommendation?.articleCount || 0 })}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              </Box>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box>
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </Box>
        ) : recommendation ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {recommendation.articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </Box>
        ) : (
          <Typography color="text.secondary">{t('dailyRecommendation.loadFailed')}</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};