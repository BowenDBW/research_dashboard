import { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  IconButton,
  Typography,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

interface PdfViewerDialogProps {
  open: boolean;
  pdfUrl?: string;   // Online PDF link
  pdfPath?: string;  // Local PDF path
  title?: string;    // Article title for display
  onClose: () => void;
}

export const PdfViewerDialog = ({
  open,
  pdfUrl,
  pdfPath,
  title,
  onClose,
}: PdfViewerDialogProps) => {
  const { t } = useTranslation();

  // Determine the PDF source URL
  const pdfSource = useMemo(() => {
    // Prefer local PDF if available
    if (pdfPath && pdfPath.trim()) {
      try {
        return convertFileSrc(pdfPath);
      } catch (error) {
        console.error('Failed to convert file path:', error);
        return null;
      }
    }
    // Use online URL if available
    if (pdfUrl && pdfUrl.trim()) {
      return pdfUrl;
    }
    return null;
  }, [pdfPath, pdfUrl]);

  // Check if PDF is available
  const hasPdf = pdfSource !== null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{ '& .MuiDialog-paper': { height: '90vh' } }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title || t('article.pdf')}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, height: '80vh' }}>
        {hasPdf ? (
          <iframe
            src={pdfSource}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title="PDF Viewer"
          />
        ) : (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Alert severity="warning" sx={{ width: '100%' }}>
              {t('article.noPdfAvailable')}
            </Alert>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};