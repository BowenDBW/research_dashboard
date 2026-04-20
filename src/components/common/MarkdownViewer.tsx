import { Box, Typography, Link } from '@mui/material';

interface MarkdownViewerProps {
  content: string;
}

// Simple markdown renderer for prototype
export const MarkdownViewer = ({ content }: MarkdownViewerProps) => {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let inList = false;
    let listItems: string[] = [];

    lines.forEach((line, index) => {
      // Handle lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        listItems.push(line.substring(2));
        return;
      } else if (inList) {
        // End of list, render it
        elements.push(
          <Box key={`list-${index}`} component="ul" sx={{ my: 1, pl: 3 }}>
            {listItems.map((item, i) => (
              <Typography key={i} component="li" variant="body2" sx={{ mb: 0.5 }}>
                {renderInlineMarkdown(item)}
              </Typography>
            ))}
          </Box>
        );
        inList = false;
        listItems = [];
      }

      // Numbered list
      const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        elements.push(
          <Typography key={index} component="div" variant="body2" sx={{ my: 0.5, pl: 2 }}>
            <Typography component="span" sx={{ fontWeight: 500, mr: 1 }}>
              {numberedMatch[1]}.
            </Typography>
            {renderInlineMarkdown(numberedMatch[2])}
          </Typography>
        );
        return;
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <Typography key={index} variant="h4" sx={{ mt: 3, mb: 2, fontWeight: 600 }}>
            {line.substring(2)}
          </Typography>
        );
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <Typography key={index} variant="h5" sx={{ mt: 2.5, mb: 1.5, fontWeight: 600 }}>
            {line.substring(3)}
          </Typography>
        );
        return;
      }
      if (line.startsWith('### ')) {
        elements.push(
          <Typography key={index} variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
            {line.substring(4)}
          </Typography>
        );
        return;
      }

      // Horizontal rule
      if (line.trim() === '---') {
        elements.push(
          <Box
            key={index}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              my: 2,
            }}
          />
        );
        return;
      }

      // Empty line
      if (line.trim() === '') {
        elements.push(<Box key={index} sx={{ height: 8 }} />);
        return;
      }

      // Bold text line (like **日期**)
      if (line.startsWith('**') && line.endsWith('**')) {
        elements.push(
          <Typography key={index} variant="body2" sx={{ fontWeight: 600, my: 0.5 }}>
            {line.replace(/\*\*/g, '')}
          </Typography>
        );
        return;
      }

      // Regular paragraph
      elements.push(
        <Typography key={index} variant="body2" sx={{ my: 0.5, lineHeight: 1.7 }}>
          {renderInlineMarkdown(line)}
        </Typography>
      );
    });

    // Handle remaining list
    if (inList && listItems.length > 0) {
      elements.push(
        <Box key="list-end" component="ul" sx={{ my: 1, pl: 3 }}>
          {listItems.map((item, i) => (
            <Typography key={i} component="li" variant="body2" sx={{ mb: 0.5 }}>
              {renderInlineMarkdown(item)}
            </Typography>
          ))}
        </Box>
      );
    }

    return elements;
  };

  const renderInlineMarkdown = (text: string): (string | JSX.Element)[] => {
    const result: (string | JSX.Element)[] = [];
    let remaining = text;
    let keyIndex = 0;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          result.push(remaining.substring(0, boldMatch.index));
        }
        result.push(
          <Typography key={`bold-${keyIndex++}`} component="span" sx={{ fontWeight: 600 }}>
            {boldMatch[1]}
          </Typography>
        );
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // Italic
      const italicMatch = remaining.match(/\*(.+?)\*/);
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) {
          result.push(remaining.substring(0, italicMatch.index));
        }
        result.push(
          <Typography key={`italic-${keyIndex++}`} component="span" sx={{ fontStyle: 'italic' }}>
            {italicMatch[1]}
          </Typography>
        );
        remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
        continue;
      }

      // Links [text](url)
      const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);
      if (linkMatch && linkMatch.index !== undefined) {
        if (linkMatch.index > 0) {
          result.push(remaining.substring(0, linkMatch.index));
        }
        result.push(
          <Link
            key={`link-${keyIndex++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'primary.main' }}
          >
            {linkMatch[1]}
          </Link>
        );
        remaining = remaining.substring(linkMatch.index + linkMatch[0].length);
        continue;
      }

      // No more markdown, add remaining text
      result.push(remaining);
      break;
    }

    return result;
  };

  return (
    <Box
      sx={{
        '& h4': { fontSize: '1.5rem', fontWeight: 600, mt: 3, mb: 2 },
        '& h5': { fontSize: '1.25rem', fontWeight: 600, mt: 2.5, mb: 1.5 },
        '& h6': { fontSize: '1rem', fontWeight: 600, mt: 2, mb: 1 },
      }}
    >
      {renderMarkdown(content)}
    </Box>
  );
};