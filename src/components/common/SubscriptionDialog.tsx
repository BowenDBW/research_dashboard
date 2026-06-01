import { useState, useEffect, useMemo } from 'react';
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
import { useSubscriptionStore } from '../../stores';
import { getAllCategories, getCategoryByCode } from '../../constants/academicCategories';

interface SubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SubscriptionDialog = ({ open, onClose }: SubscriptionDialogProps) => {
  const { t } = useTranslation();
  const { keywords, authors, categories, addKeyword, removeKeyword, addAuthor, removeAuthor, addCategory, removeCategory, loadSubscriptions } = useSubscriptionStore();
  const [localKeywords, setLocalKeywords] = useState<string[]>([]);
  const [localAuthors, setLocalAuthors] = useState<string[]>([]);
  const [localCategories, setLocalCategories] = useState<string[]>([]);

  // All available categories for autocomplete: { code, name } format
  const allCategories = useMemo(() => getAllCategories(), []);

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      // Load subscription data when dialog opens
      loadSubscriptions();
    }
  }, [open, loadSubscriptions]);

  // Update local state when subscription data changes
  useEffect(() => {
    setLocalKeywords(keywords.map(k => k.keyword));
    setLocalAuthors(authors.map(a => a.authorName));
    setLocalCategories(categories.map(c => c.category));
  }, [keywords, authors, categories]);

  const handleSave = async () => {
    // Calculate keywords to add/remove
    const currentKeywords = keywords.map(k => k.keyword);
    const keywordsToRemove = keywords.filter(k => !localKeywords.includes(k.keyword));
    const keywordsToAdd = localKeywords.filter(k => !currentKeywords.includes(k));

    // Calculate authors to add/remove
    const currentAuthors = authors.map(a => a.authorName);
    const authorsToRemove = authors.filter(a => !localAuthors.includes(a.authorName));
    const authorsToAdd = localAuthors.filter(a => !currentAuthors.includes(a));

    // Calculate categories to add/remove
    const currentCategories = categories.map(c => c.category);
    const categoriesToRemove = categories.filter(c => !localCategories.includes(c.category));
    const categoriesToAdd = localCategories.filter(c => !currentCategories.includes(c));

    // Remove items
    for (const kw of keywordsToRemove) {
      await removeKeyword(kw.id);
    }
    for (const author of authorsToRemove) {
      await removeAuthor(author.id);
    }
    for (const cat of categoriesToRemove) {
      await removeCategory(cat.id);
    }

    // Add items
    for (const keyword of keywordsToAdd) {
      await addKeyword(keyword);
    }
    for (const authorName of authorsToAdd) {
      await addAuthor(authorName);
    }
    for (const category of categoriesToAdd) {
      await addCategory(category);
    }

    // Refresh and close
    await loadSubscriptions();
    onClose();
  };

  const handleCancel = () => {
    setLocalKeywords(keywords.map(k => k.keyword));
    setLocalAuthors(authors.map(a => a.authorName));
    setLocalCategories(categories.map(c => c.category));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('subscription.settings')}</DialogTitle>
      <DialogContent>
        {/* Keywords - freeSolo for custom input */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('subscription.keywords')}
          </Typography>
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={localKeywords}
            onChange={(_, newValue) => setLocalKeywords(newValue)}
            renderTags={(value: string[], getTagProps) =>
              value.map((option, index) => {
                const tagProps = getTagProps({ index });
                return (
                  <Chip
                    size="small"
                    label={option}
                    {...tagProps}
                    key={`${option}-${index}`}
                    onDelete={() => {
                      setLocalKeywords(prev => prev.filter((_, i) => i !== index));
                    }}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField {...params} placeholder={t('subscription.keywordPlaceholder')} size="small" />
            )}
          />
        </Box>

        {/* Authors - freeSolo for custom input */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('subscription.subscribedAuthors')}
          </Typography>
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={localAuthors}
            onChange={(_, newValue) => setLocalAuthors(newValue)}
            renderTags={(value: string[], getTagProps) =>
              value.map((option, index) => {
                const tagProps = getTagProps({ index });
                return (
                  <Chip
                    size="small"
                    label={option}
                    {...tagProps}
                    key={`${option}-${index}`}
                    onDelete={() => {
                      setLocalAuthors(prev => prev.filter((_, i) => i !== index));
                    }}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField {...params} placeholder={t('subscription.authorPlaceholder')} size="small" />
            )}
          />
        </Box>

        {/* Categories - select from predefined academic categories (no freeSolo) */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t('subscription.subscribedCategories')}
          </Typography>
          <Autocomplete
            multiple
            options={allCategories}
            getOptionLabel={(option) => typeof option === 'string' ? option : `${option.name} (${option.code})`}
            isOptionEqualToValue={(option, value) => {
              const valCode = typeof value === 'string' ? value : value.code;
              return option.code === valCode;
            }}
            value={localCategories.map(code => {
              const found = allCategories.find(c => c.code === code);
              return found || { name: code, code: code, parent: '' };
            })}
            onChange={(_, newValue) => setLocalCategories(newValue.map(c => typeof c === 'string' ? c : c.code))}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const tagProps = getTagProps({ index });
                const code = typeof option === 'string' ? option : option.code;
                return (
                  <Chip
                    size="small"
                    label={code}
                    {...tagProps}
                    key={code}
                    onDelete={() => {
                      setLocalCategories(prev => prev.filter((_, i) => i !== index));
                    }}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField {...params} placeholder={t('subscription.categoryPlaceholder')} size="small" />
            )}
            groupBy={(option) => typeof option === 'string' ? '' : option.parent}
            sx={{ mt: 1 }}
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