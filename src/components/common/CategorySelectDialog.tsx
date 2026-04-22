import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Collapse,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ACADEMIC_CATEGORIES } from '../../constants/academicCategories';

interface CategorySelectDialogProps {
  open: boolean;
  selectedCategories: string[];
  onClose: () => void;
  onSave: (categories: string[]) => void;
}

export const CategorySelectDialog = ({
  open,
  selectedCategories,
  onClose,
  onSave,
}: CategorySelectDialogProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [localSelected, setLocalSelected] = useState<string[]>(selectedCategories);

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSelected([...selectedCategories]);
      setSearchQuery('');
      setExpandedCategories(new Set());
    }
  }, [open, selectedCategories]);

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return ACADEMIC_CATEGORIES;
    }
    const query = searchQuery.toLowerCase();
    const result: Record<string, { name: string; code: string }[]> = {};

    Object.entries(ACADEMIC_CATEGORIES).forEach(([parent, categories]) => {
      const filtered = categories.filter(
        cat => cat.name.toLowerCase().includes(query) || cat.code.toLowerCase().includes(query)
      );
      if (filtered.length > 0) {
        result[parent] = filtered;
      }
    });

    return result;
  }, [searchQuery]);

  const MAX_CATEGORIES = 20;

  const toggleCategory = (code: string) => {
    setLocalSelected(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code);
      } else if (prev.length < MAX_CATEGORIES) {
        return [...prev, code];
      }
      return prev;
    });
  };

  const toggleParentCategory = (parent: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parent)) {
        newSet.delete(parent);
      } else {
        newSet.add(parent);
      }
      return newSet;
    });
  };

  const selectAllInParent = (parent: string, checked: boolean) => {
    const codes = ACADEMIC_CATEGORIES[parent].map(cat => cat.code);
    setLocalSelected(prev => {
      if (checked) {
        const newSelected = [...new Set([...prev, ...codes])];
        return newSelected.slice(0, MAX_CATEGORIES);
      } else {
        return prev.filter(c => !codes.includes(c));
      }
    });
  };

  const isParentFullySelected = (parent: string) => {
    const codes = ACADEMIC_CATEGORIES[parent].map(cat => cat.code);
    return codes.every(code => localSelected.includes(code));
  };

  const isParentPartiallySelected = (parent: string) => {
    const codes = ACADEMIC_CATEGORIES[parent].map(cat => cat.code);
    const selectedCount = codes.filter(code => localSelected.includes(code)).length;
    return selectedCount > 0 && selectedCount < codes.length;
  };

  const handleSave = () => {
    onSave(localSelected);
    onClose();
  };

  const handleClearAll = () => {
    setLocalSelected([]);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">{t('categorySelect.title')}</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Search and quick actions */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            placeholder={t('categorySelect.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ flex: 1 }}
          />
          <Button size="small" onClick={handleClearAll}>
            {t('categorySelect.clearAll')}
          </Button>
        </Box>

        {/* Selected count and limit hint */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={t('categorySelect.selectedCount', { count: localSelected.length })}
            size="small"
            color={localSelected.length >= MAX_CATEGORIES ? 'warning' : 'primary'}
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary">
            {t('categorySelect.maxLimitHint')}
          </Typography>
          {localSelected.length >= MAX_CATEGORIES && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningIcon color="warning" sx={{ fontSize: 18 }} />
              <Typography variant="caption" color="warning.main">
                {t('categorySelect.maxLimit')}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Category list */}
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {Object.entries(filteredCategories).map(([parent, categories]) => (
            <Paper key={parent} variant="outlined" sx={{ mb: 1 }}>
              {/* Parent header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => toggleParentCategory(parent)}
              >
                <Checkbox
                  size="small"
                  checked={isParentFullySelected(parent)}
                  indeterminate={isParentPartiallySelected(parent)}
                  disabled={!isParentFullySelected(parent) && localSelected.length >= MAX_CATEGORIES}
                  onClick={e => {
                    e.stopPropagation();
                    selectAllInParent(parent, !isParentFullySelected(parent));
                  }}
                  onMouseDown={e => e.stopPropagation()}
                />
                <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
                  {parent} ({categories.length})
                </Typography>
                {expandedCategories.has(parent) ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </Box>

              {/* Child categories */}
              <Collapse in={expandedCategories.has(parent)}>
                <Box sx={{ px: 2, pb: 1 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {categories.map(cat => {
                      const isSelected = localSelected.includes(cat.code);
                      const isDisabled = !isSelected && localSelected.length >= MAX_CATEGORIES;
                      return (
                        <FormControlLabel
                          key={cat.code}
                          control={
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={() => toggleCategory(cat.code)}
                              disabled={isDisabled}
                              sx={{ py: 0.25 }}
                            />
                          }
                          label={
                            <Typography variant="caption" color={isDisabled ? 'text.disabled' : 'text.primary'}>
                              {cat.name} ({cat.code})
                            </Typography>
                          }
                          sx={{ mr: 0, mb: 0 }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              </Collapse>
            </Paper>
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleSave}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
