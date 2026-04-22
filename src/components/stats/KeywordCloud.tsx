import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import 'd3-transition';
import cloud from 'd3-cloud';
import { KeywordItem } from '../../types';

interface Word extends KeywordItem {
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
}

interface KeywordCloudProps {
  data: KeywordItem[];
  width?: number;
  height?: number;
}

const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

export const KeywordCloud = ({ data, width = 300, height = 200 }: KeywordCloudProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!svgRef.current || data.length === 0 || rendered) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const maxCount = Math.max(...data.map(d => d.value), 1);

    const fontScale = scaleLinear()
      .domain([1, maxCount])
      .range([12, 36]);

    const words: Word[] = data.map(d => ({
      ...d,
      size: fontScale(d.value),
    }));

    const layout = cloud<Word>()
      .size([width, height])
      .words(words)
      .padding(3)
      .rotate(() => (Math.random() > 0.5 ? 0 : 90))
      .font('Arial')
      .fontSize(d => d.size)
      .on('end', (drawnWords) => {
        svg
          .append('g')
          .attr('transform', `translate(${width / 2},${height / 2})`)
          .selectAll('text')
          .data(drawnWords)
          .enter()
          .append('text')
          .style('font-size', d => `${d.size}px`)
          .style('font-family', 'Arial')
          .style('fill', (_, i) => COLORS[i % COLORS.length])
          .style('cursor', 'pointer')
          .style('opacity', 0)
          .attr('text-anchor', 'middle')
          .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})rotate(${d.rotate ?? 0})`)
          .text(d => d.text)
          .transition()
          .duration(300)
          .delay((_, i) => i * 20)
          .style('opacity', 1);
      });

    layout.start();
    setRendered(true);
  }, [data, width, height, rendered]);

  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">暂无关键词数据</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <svg ref={svgRef} width={width} height={height} />
    </Box>
  );
};
