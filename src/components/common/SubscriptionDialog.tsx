import { useState } from 'react';
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
import { useSubscriptionStore } from '../../stores/useSubscriptionStore';

interface SubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SubscriptionDialog = ({ open, onClose }: SubscriptionDialogProps) => {
  const { t } = useTranslation();
  const { keywords, authors, updateSubscriptions } = useSubscriptionStore();
  const [localKeywords, setLocalKeywords] = useState<string[]>(keywords);
  const [localAuthors, setLocalAuthors] = useState<string[]>(authors);

  const handleSave = async () => {
    await updateSubscriptions({
      keywords: localKeywords,
      authors: localAuthors,
    });
    onClose();
  };

  const handleCancel = () => {
    setLocalKeywords(keywords);
    setLocalAuthors(authors);
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
            slots={{
              tag: (props) => {
                const { label, onDelete, ...other } = props;
                return <Chip label={label} size="small" onDelete={onDelete} {...other} />;
              },
            }}
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
            slots={{
              tag: (props) => {
                const { label, onDelete, ...other } = props;
                return <Chip label={label} size="small" onDelete={onDelete} {...other} />;
              },
            }}
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