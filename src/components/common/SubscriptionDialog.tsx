import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  Chip,
  Box,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../hooks';

interface SubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SubscriptionDialog = ({ open, onClose }: SubscriptionDialogProps) => {
  const { t } = useTranslation();
  const { keywords, authors, addKeyword, removeKeyword, addAuthor, removeAuthor, loadSubscriptions } = useSubscription();
  const [localKeywords, setLocalKeywords] = useState<string[]>([]);
  const [localAuthors, setLocalAuthors] = useState<string[]>([]);

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalKeywords(keywords.map(k => k.keyword));
      setLocalAuthors(authors.map(a => a.authorName));
    }
  }, [open, keywords, authors]);

  const handleSave = async () => {
    // Calculate keywords to add/remove
    const currentKeywords = keywords.map(k => k.keyword);
    const keywordsToRemove = keywords.filter(k => !localKeywords.includes(k.keyword));
    const keywordsToAdd = localKeywords.filter(k => !currentKeywords.includes(k));

    // Calculate authors to add/remove
    const currentAuthors = authors.map(a => a.authorName);
    const authorsToRemove = authors.filter(a => !localAuthors.includes(a.authorName));
    const authorsToAdd = localAuthors.filter(a => !currentAuthors.includes(a));

    // Remove items
    for (const kw of keywordsToRemove) {
      await removeKeyword(kw.id);
    }
    for (const author of authorsToRemove) {
      await removeAuthor(author.id);
    }

    // Add items
    for (const keyword of keywordsToAdd) {
      await addKeyword(keyword);
    }
    for (const authorName of authorsToAdd) {
      await addAuthor(authorName);
    }

    // Refresh and close
    await loadSubscriptions();
    onClose();
  };

  const handleCancel = () => {
    setLocalKeywords(keywords.map(k => k.keyword));
    setLocalAuthors(authors.map(a => a.authorName));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('subscription.settings')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('subscription.keywords')}
          </Typography>
          <Autocomplete
            multiple
            freeSolo
            options={['cs.LG', 'cs.AI', 'cs.CL', 'deep learning', 'transformer']}
            value={localKeywords}
            onChange={(_, newValue) => setLocalKeywords(newValue)}
            renderTags={(value: string[], getTagProps: (index: number) => any) =>
              value.map((option: string, index: number) => (
                <Chip size="small" label={option} {...getTagProps(index)} key={option} />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} placeholder={t('subscription.keywordPlaceholder')} size="small" />
            )}
          />
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t('subscription.subscribedAuthors')}
          </Typography>
          <Autocomplete
            multiple
            freeSolo
            options={['Yann LeCun', 'Geoffrey Hinton', 'Yoshua Bengio']}
            value={localAuthors}
            onChange={(_, newValue) => setLocalAuthors(newValue)}
            renderTags={(value: string[], getTagProps: (index: number) => any) =>
              value.map((option: string, index: number) => (
                <Chip size="small" label={option} {...getTagProps(index)} key={option} />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} placeholder={t('subscription.authorPlaceholder')} size="small" />
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleSave}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};