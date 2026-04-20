import { useState, ReactNode } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';

interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: ReactNode;
}

export const ContextMenu = ({ items, children }: ContextMenuProps) => {
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number } | null>(null);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorPosition({
      top: event.clientY,
      left: event.clientX,
    });
  };

  const handleClose = () => {
    setAnchorPosition(null);
  };

  const handleItemClick = (onClick: () => void) => {
    onClick();
    handleClose();
  };

  return (
    <>
      <div onContextMenu={handleContextMenu} style={{ width: '100%', height: '100%' }}>
        {children}
      </div>
      <Menu
        open={anchorPosition !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? undefined}
      >
        {items.map((item, index) => (
          <div key={index}>
            {item.divider && <Divider />}
            <MenuItem
              onClick={() => handleItemClick(item.onClick)}
              disabled={item.disabled}
              sx={item.danger ? { color: 'error.main', '&:hover': { color: 'error.main' } } : undefined}
            >
              {item.icon && <ListItemIcon sx={item.danger ? { color: 'error.main' } : undefined}>{item.icon}</ListItemIcon>}
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          </div>
        ))}
      </Menu>
    </>
  );
};