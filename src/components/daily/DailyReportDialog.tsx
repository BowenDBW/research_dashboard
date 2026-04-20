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
import { useDailyStore } from '../../stores/useDailyStore';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { DailyReport } from '../../types';

interface DailyReportDialogProps {
  open: boolean;
  reportId: string | null;
  onClose: () => void;
}

export const DailyReportDialog = ({ open, reportId, onClose }: DailyReportDialogProps) => {
  const { fetchReportById, currentReport, loading } = useDailyStore();
  const [report, setReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    if (open && reportId) {
      fetchReportById(reportId).then((r) => {
        setReport(r);
      });
    }
    if (!open) {
      setReport(null);
    }
  }, [open, reportId, fetchReportById]);

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
              <Skeleton width={300} />
            ) : (
              <>
                <Typography variant="h6">{report?.title || 'Claw 日报'}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip
                    icon={<CalendarIcon />}
                    label={report?.date || ''}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    icon={<ArticleIcon />}
                    label={`${report?.articleCount || 0} 篇论文`}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                </Box>
              </>
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
            <Skeleton height={30} />
            <Skeleton height={30} />
            <Skeleton height={30} />
            <Skeleton height={30} width="80%" />
            <Box sx={{ mt: 2 }}>
              <Skeleton height={25} width="40%" />
              <Skeleton height={20} />
              <Skeleton height={20} />
              <Skeleton height={20} width="90%" />
            </Box>
          </Box>
        ) : report ? (
          <MarkdownViewer content={report.content} />
        ) : (
          <Typography color="text.secondary">加载失败</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};