import { Box, Typography, Paper } from '@mui/material';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface StatsCardProps {
  icon: ReactNode;
  label: string;  // i18n key
  value: number | string;
  unit?: string;
  color?: string;
}

export const StatsCard = ({ icon, label, value, unit, color = '#2196f3' }: StatsCardProps) => {
  const { t } = useTranslation();

  return (
    <Paper
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Typography variant="caption" color="text.secondary" noWrap>
        {t(label)}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            bgcolor: `${color}15`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color }}>
            {value}
          </Typography>
          {unit && (
            <Typography variant="caption" color="text.secondary">
              {unit}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
};
