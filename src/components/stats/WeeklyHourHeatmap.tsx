import { Box, Tooltip, Typography } from '@mui/material';

interface DailyHourCell {
  date: string;
  hour: number;
  count: number;
}

interface DailyHourHeatmapProps {
  data: DailyHourCell[];
}

const COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

// Calculate level based on count (0-10 range, evenly divided)
const getLevel = (count: number): number => {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4; // 7-10+
};

export const WeeklyHourHeatmap = ({ data }: DailyHourHeatmapProps) => {
  if (data.length === 0) return null;

  const cellSize = 8;
  const gap = 1;

  // Get unique dates sorted
  const uniqueDates = [...new Set(data.map(d => d.date))].sort();

  // Calculate date labels - show every 5 days
  const getDateLabels = () => {
    const labels: { index: number; label: string }[] = [];
    const totalDays = uniqueDates.length;

    // Always show first date
    const firstDate = new Date(uniqueDates[0]);
    labels.push({ index: 0, label: `${firstDate.getMonth() + 1}.${firstDate.getDate()}` });

    // Show dates every ~5 days
    const interval = Math.max(1, Math.floor(totalDays / 6));
    for (let i = interval; i < totalDays - 1; i += interval) {
      const date = new Date(uniqueDates[i]);
      labels.push({ index: i, label: `${date.getMonth() + 1}.${date.getDate()}` });
    }

    // Always show last date if not already shown
    const lastDate = new Date(uniqueDates[totalDays - 1]);
    const lastLabel = `${lastDate.getMonth() + 1}.${lastDate.getDate()}`;
    if (labels[labels.length - 1].index !== totalDays - 1) {
      labels.push({ index: totalDays - 1, label: lastLabel });
    }

    return labels;
  };

  const dateLabels = getDateLabels();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {/* Date labels row */}
        <Box sx={{ display: 'flex', ml: 2.5, mb: 1, height: '12px' }}>
          {uniqueDates.map((date, index) => {
            const labelInfo = dateLabels.find(l => l.index === index);
            return (
              <Box
                key={date}
                sx={{
                  width: cellSize,
                  mx: gap / 8,
                  textAlign: 'center',
                }}
              >
                {labelInfo && (
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '0.5rem', color: 'text.secondary' }}
                  >
                    {labelInfo.label}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Grid - 24 hours as rows, days as columns (30 days) */}
        {Array.from({ length: 24 }, (_, hour) => (
          <Box key={hour} sx={{ display: 'flex', alignItems: 'center', height: cellSize + 1 }}>
            {/* Hour label */}
            <Box sx={{ width: 20, textAlign: 'right', pr: 0.25, flexShrink: 0 }}>
              {hour % 6 === 0 && (
                <Typography variant="caption" sx={{ fontSize: '0.5rem', color: 'text.secondary' }}>
                  {hour}:00
                </Typography>
              )}
            </Box>

            {/* Day cells for this hour */}
            {uniqueDates.map((date) => {
              const cellData = data.find(d => d.date === date && d.hour === hour);
              const count = cellData?.count || 0;

              return (
                <Tooltip
                  key={date}
                  title={`${hour}:00 - ${count} 篇`}
                  arrow
                  enterDelay={300}
                >
                  <Box
                    sx={{
                      width: cellSize,
                      height: cellSize,
                      mx: gap / 8,
                      borderRadius: 0.25,
                      bgcolor: COLORS[getLevel(count)],
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 0.5, gap: 0.25, width: '100%' }}>
        <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>少</Typography>
        {COLORS.map((color, i) => (
          <Box key={i} sx={{ width: 8, height: 8, bgcolor: color, borderRadius: 0.25 }} />
        ))}
        <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>多</Typography>
      </Box>
    </Box>
  );
};
