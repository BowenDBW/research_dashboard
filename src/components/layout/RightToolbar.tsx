import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  ExpandMore as ExpandMoreIcon,
  Bookmark as BookmarkIcon,
  History as HistoryIcon,
  Tune as TuneIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { SubscriptionDialog } from '../common/SubscriptionDialog';

interface RightToolbarProps {
  open: boolean;
  onToggle: () => void;
}

const TOOLBAR_WIDTH = 280;

export const RightToolbar = ({ open, onToggle }: RightToolbarProps) => {
  const navigate = useNavigate();
  const { items } = useFavoriteStore();
  const { records } = useHistoryStore();
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [expandedPanels, setExpandedPanels] = useState<string[]>([]);

  const handlePanelToggle = (panel: string) => {
    setExpandedPanels((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]
    );
  };

  // Get recent history (last 7 days)
  const recentRecords = records.slice(0, 5);

  if (!open) {
    // Collapsed state - show toggle button only
    return (
      <Box sx={{ position: 'relative', width: 0 }}>
        <IconButton
          onClick={onToggle}
          sx={{
            position: 'absolute',
            left: -16,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1200,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            boxShadow: 1,
            width: 24,
            height: 24,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          width: TOOLBAR_WIDTH,
          flexShrink: 0,
          borderLeft: 1,
          borderColor: 'divider',
          height: '100vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Favorites Tree */}
        <Accordion
          expanded={expandedPanels.includes('favorites')}
          onChange={() => handlePanelToggle('favorites')}
          sx={{ borderRadius: 0 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BookmarkIcon fontSize="small" />
                <Typography variant="subtitle2">收藏夹</Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/favorites');
                }}
              >
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <SimpleTreeView sx={{ overflow: 'auto' }}>
              {items.map((item) => (
                <TreeItem
                  key={item.id}
                  itemId={item.id}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{item.name}</Typography>
                      {item.type === 'file' && (
                        <Chip label={item.article?.source} size="small" />
                      )}
                    </Box>
                  }
                >
                  {item.children?.map((child) => (
                    <TreeItem
                      key={child.id}
                      itemId={child.id}
                      label={<Typography variant="body2">{child.name}</Typography>}
                    />
                  ))}
                </TreeItem>
              ))}
            </SimpleTreeView>
          </AccordionDetails>
        </Accordion>

        {/* Weekly History */}
        <Accordion
          expanded={expandedPanels.includes('history')}
          onChange={() => handlePanelToggle('history')}
          sx={{ borderRadius: 0 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon fontSize="small" />
                <Typography variant="subtitle2">本周历史</Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/history');
                }}
              >
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <List dense>
              {recentRecords.map((record) => (
                <ListItem key={record.id} sx={{ px: 0 }}>
                  <ListItemText
                    primary={record.article.title}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        <Chip
                          label={
                            record.action === 'view_abstract'
                              ? '摘要'
                              : record.action === 'view_source'
                              ? '链接'
                              : record.action === 'favorite'
                              ? '收藏'
                              : '下载'
                          }
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(record.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Box>
                    }
                    sx={{ '& .MuiListItemText-primary': { noWrap: true } }}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Subscription Settings */}
        <Accordion
          expanded={expandedPanels.includes('subscription')}
          onChange={() => handlePanelToggle('subscription')}
          sx={{ borderRadius: 0 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneIcon fontSize="small" />
              <Typography variant="subtitle2">订阅设置</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              点击下方按钮管理订阅的关键词和作者
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label="cs.LG" size="small" />
              <Chip label="transformer" size="small" />
            </Box>
            <Box sx={{ mt: 1 }}>
              <Chip label="Yann LeCun" size="small" variant="outlined" />
            </Box>
            <IconButton
              onClick={() => setSubscriptionDialogOpen(true)}
              sx={{ mt: 1 }}
            >
              <TuneIcon />
              <Typography sx={{ ml: 1 }}>编辑订阅</Typography>
            </IconButton>
          </AccordionDetails>
        </Accordion>

        <SubscriptionDialog
          open={subscriptionDialogOpen}
          onClose={() => setSubscriptionDialogOpen(false)}
        />
      </Box>

      {/* Toggle Button - positioned at left edge, vertically centered */}
      <IconButton
        onClick={onToggle}
        sx={{
          position: 'absolute',
          left: -16,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1200,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          boxShadow: 1,
          width: 24,
          height: 24,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};