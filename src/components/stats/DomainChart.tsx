import { Box, Typography } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DomainDistribution } from '../../types';

interface DomainChartProps {
  data: DomainDistribution[];
}

const COLORS = ['#2196f3', '#4caf50', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ff5722', '#607d8b', '#795548', '#3f51b5'];

export const DomainChart = ({ data }: DomainChartProps) => {
  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">暂无领域数据</Typography>
      </Box>
    );
  }

  const topDomains = data.slice(0, 8);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ width: 180, height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={topDomains}
              dataKey="count"
              nameKey="domain"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {topDomains.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: '0.75rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ flex: 1 }}>
        {topDomains.map((domain, index) => (
          <Box key={domain.domain} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: 0.25,
                bgcolor: COLORS[index % COLORS.length],
              }}
            />
            <Typography variant="body2" sx={{ flex: 1, fontSize: '0.75rem' }}>
              {domain.domain}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              {domain.count} ({domain.percentage.toFixed(2)}%)
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
