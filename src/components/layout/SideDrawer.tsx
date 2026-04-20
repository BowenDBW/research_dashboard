import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  ListItemIcon,
  Divider,
  Button,
  Typography,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon as MenuListItemIcon,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Article as ArticleIcon,
  Chat as ChatIcon,
  Search as SearchIcon,
  Summarize as SummarizeIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from '@mui/icons-material';
import { useChatStore } from '../../stores/useChatStore';
import { useThemeMode } from '../../app/ThemeProvider';

interface SideDrawerProps {
  open: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 72;

export const SideDrawer = ({ open, onToggle, onOpenSettings }: SideDrawerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessions, currentSessionId, createSession, switchSession, deleteSession } = useChatStore();
  const { mode, toggleMode } = useThemeMode();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);

  const handleNewChat = () => {
    createSession('chat');
    navigate('/');
  };

  const handleSessionClick = (sessionId: string) => {
    switchSession(sessionId);
    navigate('/');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, sessionId: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuSessionId(sessionId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuSessionId(null);
  };

  const handleDelete = () => {
    if (menuSessionId) {
      deleteSession(menuSessionId);
    }
    handleMenuClose();
  };

  const isCollapsed = !open;

  return (
    <Box sx={{ position: 'relative', pointerEvents: 'none' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
            overflowX: 'hidden',
            transition: (theme) =>
              theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            pointerEvents: 'auto',
          },
        }}
      >
        {/* Crawler Status */}
        <Box sx={{ p: open ? 2 : 1, pt: open ? 2 : 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: open ? 'space-between' : 'center',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/articles')}
          >
            {open ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ArticleIcon fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    文章检索
                  </Typography>
                </Box>
                <ArrowForwardIcon fontSize="small" />
              </>
            ) : (
              <ArticleIcon />
            )}
          </Box>
          {open && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                最后爬取: 2024-01-10
              </Typography>
              <Typography variant="body2">文章总量: 1,234 篇</Typography>
            </Box>
          )}
        </Box>

        <Divider />

        {/* New Chat Button */}
        <Box sx={{ p: open ? 2 : 1 }}>
          <Button
            variant="outlined"
            startIcon={open ? <AddIcon /> : null}
            fullWidth={open}
            onClick={handleNewChat}
            sx={{
              minWidth: isCollapsed ? 40 : 'auto',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
            }}
          >
            {isCollapsed ? <AddIcon /> : '新对话'}
          </Button>
        </Box>

        {/* Session List */}
        <List sx={{ flex: 1, overflow: 'auto' }} dense>
          {sessions.map((session) => (
            <ListItem
              key={session.id}
              disablePadding
              secondaryAction={
                open && (
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => handleMenuOpen(e, session.id)}
                    sx={{ p: 0.5 }}
                  >
                    <MoreVertIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )
              }
            >
              <ListItemButton
                selected={currentSessionId === session.id && location.pathname === '/'}
                onClick={() => handleSessionClick(session.id)}
                sx={{
                  minHeight: 36,
                  py: 0.5,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                }}
              >
                {isCollapsed ? (
                  <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center' }}>
                    {session.mode === 'chat' ? (
                      <ChatIcon fontSize="small" />
                    ) : session.mode === 'paper_search' ? (
                      <SearchIcon fontSize="small" />
                    ) : (
                      <SummarizeIcon fontSize="small" />
                    )}
                  </ListItemIcon>
                ) : (
                  <ListItemAvatar sx={{ minWidth: 28 }}>
                    <Avatar sx={{ width: 20, height: 20 }}>
                      {session.mode === 'chat' ? (
                        <ChatIcon sx={{ fontSize: 12 }} />
                      ) : session.mode === 'paper_search' ? (
                        <SearchIcon sx={{ fontSize: 12 }} />
                      ) : (
                        <SummarizeIcon sx={{ fontSize: 12 }} />
                      )}
                    </Avatar>
                  </ListItemAvatar>
                )}
                {open && (
                  <ListItemText
                    primary={session.title}
                    secondary={
                      session.mode === 'chat'
                        ? '对话'
                        : session.mode === 'paper_search'
                        ? '论文搜索'
                        : '文章总结'
                    }
                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                    sx={{ mr: 3 }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider />

        {/* Theme & Settings - 展开时同一行 */}
        <Box sx={{ p: open ? 1.5 : 1 }}>
          {open ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={toggleMode}
              >
                <IconButton size="small">
                  {mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
                </IconButton>
                <Typography variant="caption" color="text.secondary">
                  {mode === 'light' ? '深色' : '浅色'}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={onOpenSettings}
              >
                <IconButton size="small">
                  <SettingsIcon fontSize="small" />
                </IconButton>
                <Typography variant="caption" color="text.secondary">
                  设置
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={toggleMode} size="small">
                {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
              </IconButton>
              <IconButton onClick={onOpenSettings} size="small">
                <SettingsIcon />
              </IconButton>
            </Box>
          )}
          {open && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
              v0.1.0
            </Typography>
          )}
        </Box>
      </Drawer>

      {/* Toggle Button - positioned at right edge, vertically centered */}
      <IconButton
        onClick={onToggle}
        sx={{
          position: 'absolute',
          right: -16,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1200,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          boxShadow: 1,
          width: 24,
          height: 24,
          '&:hover': { bgcolor: 'action.hover' },
          pointerEvents: 'auto',
        }}
      >
        {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
      </IconButton>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <MenuListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </MenuListItemIcon>
          <Typography>删除对话</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
};