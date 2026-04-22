import { Box, Tooltip, Typography } from '@mui/material';
import { HeatmapCell } from '../../types';

interface MonthlyHeatmapProps {
  data: HeatmapCell[];
  onCellClick?: (date: string) => void;
  size?: 'small' | 'medium' | 'large';
}

const COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

// Calculate level based on count (0-50 range, evenly divided)
const getLevel = (count: number): number => {
  if (count === 0) return 0;
  if (count <= 10) return 1;
  if (count <= 20) return 2;
  if (count <= 30) return 3;
  return 4; // 31-50+
};

export const MonthlyHeatmap = ({ data, onCellClick, size = 'small' }: MonthlyHeatmapProps) => {
  const cellSize = size === 'small' ? 12 : size === 'medium' ? 16 : 20;
  const gap = size === 'small' ? 2 : size === 'medium' ? 3 : 4;

  if (data.length === 0) return null;

  // Get start and end date info
  const startDate = new Date(data[0].date);
  const endDate = new Date(data[data.length - 1].date);

  // Check if all dates are in the same month
  const isSingleMonth = startDate.getMonth() === endDate.getMonth() &&
                         startDate.getFullYear() === endDate.getFullYear();

  // Format date range for label
  const formatDate = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
  const dateRangeLabel = `${formatDate(startDate)} - ${formatDate(endDate)}`;

  // Organize data by weeks (rows), each row is a week with 7 days (columns)
  // Calculate starting day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  const startDayOfWeek = (startDate.getDay() + 6) % 7; // Monday=0

  const weeks: (HeatmapCell | null)[][] = [];
  let currentWeek: (HeatmapCell | null)[] = new Array(startDayOfWeek).fill(null);
  let dataIndex = 0;

  while (dataIndex < data.length) {
    currentWeek.push(data[dataIndex]);
    dataIndex++;

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Push remaining days
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  // Day labels for columns (一 二 三 四 五 六 日)
  const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

  // Get week label (show month when it changes)
  const getWeekLabel = (weekIndex: number): string | null => {
    // Don't show month labels if all dates are in the same month
    if (isSingleMonth) return null;

    const firstNonNullCell = weeks[weekIndex]?.find(c => c !== null);
    if (!firstNonNullCell) return null;
    const date = new Date(firstNonNullCell.date);
    if (weekIndex === 0) {
      return `${date.getMonth() + 1}月`;
    }
    const prevFirstNonNullCell = weeks[weekIndex - 1]?.find(c => c !== null);
    if (prevFirstNonNullCell) {
      const prevDate = new Date(prevFirstNonNullCell.date);
      if (prevDate.getMonth() !== date.getMonth()) {
        return `${date.getMonth() + 1}月`;
      }
    }
    return null;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Date range label */}
      <Typography
        variant="caption"
        sx={{ fontSize: size === 'small' ? '0.6rem' : '0.7rem', color: 'text.secondary', mb: 0.5 }}
      >
        {dateRangeLabel}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {/* Day labels row */}
        <Box sx={{ display: 'flex', ml: 3, mb: 0.25 }}>
          {DAY_LABELS.map((label, i) => (
            <Box
              key={i}
              sx={{
                width: cellSize,
                mx: gap / 8,
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: size === 'small' ? '0.5rem' : '0.6rem', color: 'text.secondary' }}
              >
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Heatmap grid - each row is a week */}
        {weeks.map((week, weekIndex) => {
          const weekLabel = getWeekLabel(weekIndex);
          return (
            <Box key={weekIndex} sx={{ display: 'flex', alignItems: 'center', mb: 0.25 }}>
              {/* Week label (month) */}
              <Box sx={{ width: 20, textAlign: 'right', mr: 0.5 }}>
                {weekLabel && (
                  <Typography variant="caption" sx={{ fontSize: size === 'small' ? '0.5rem' : '0.55rem', color: 'text.secondary' }}>
                    {weekLabel}
                  </Typography>
                )}
              </Box>

              {/* Week cells */}
              {week.map((cell, dayIndex) => {
                if (!cell) {
                  return (
                    <Box
                      key={dayIndex}
                      sx={{
                        width: cellSize,
                        height: cellSize,
                        mx: gap / 8,
                        borderRadius: 0.5,
                        bgcolor: 'transparent',
                      }}
                    />
                  );
                }
                return (
                  <Tooltip key={dayIndex} title={`${cell.date}: ${cell.count} 篇`} arrow enterDelay={300}>
                    <Box
                      onClick={() => onCellClick?.(cell.date)}
                      sx={{
                        width: cellSize,
                        height: cellSize,
                        mx: gap / 8,
                        borderRadius: 0.5,
                        bgcolor: COLORS[getLevel(cell.count)],
                        cursor: onCellClick ? 'pointer' : 'default',
                        transition: 'transform 0.1s',
                        '&:hover': onCellClick ? { transform: 'scale(1.1)' } : {},
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
