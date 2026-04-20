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
    // 如果菜单已打开，再次右键关闭菜单
    if (anchorPosition !== null) {
      setAnchorPosition(null);
    } else {
      setAnchorPosition({
        top: event.clientY,
        left: event.clientX,
      });
    }
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
              sx={{
                py: 0.75,
                px: 1.5,
                ...(item.danger ? { color: 'error.main', '&:hover': { color: 'error.main' } } : {}),
              }}
            >
              {item.icon && (
                <ListItemIcon sx={{ minWidth: 32, ...(item.danger ? { color: 'error.main' } : {}) }}>
                  {item.icon}
                </ListItemIcon>
              )}
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </MenuItem>
          </div>
        ))}
      </Menu>
    </>
  );
};