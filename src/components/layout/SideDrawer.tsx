import { useState, useEffect, useRef } from 'react';
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
  Tooltip,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  Add as AddIcon,
  PostAdd as PostAddIcon,
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon,
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
import { useTranslation } from 'react-i18next';

interface SideDrawerProps {
  open: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 72;
const TRANSITION_DURATION = 200; // ms

export const SideDrawer = ({ open, onToggle, onOpenSettings }: SideDrawerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { sessions, currentSessionId, createSession, switchSession, deleteSession, messages } = useChatStore();
  const { mode, toggleMode } = useThemeMode();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(open);
  const prevOpenRef = useRef(open);

  // Track transition state - hide content during transition, show after complete
  useEffect(() => {
    if (prevOpenRef.current !== open) {
      // Toggle started - hide content immediately
      setShowContent(false);
      // Show content after transition completes
      const timer = setTimeout(() => {
        setShowContent(open);
      }, TRANSITION_DURATION);
      prevOpenRef.current = open;
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Filter sessions to only show those with messages, sorted by most recent
  const sessionsWithMessages = sessions
    .filter(session => messages[session.id] && messages[session.id].length > 0)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

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
        {/* Article Search & Manual Add */}
        <Box sx={{ p: open ? 2 : 1, pt: open ? 2 : 2 }}>
          {open ? (
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  opacity: showContent ? 1 : 0,
                  transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
                }}
                onClick={() => navigate('/articles')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ArticleIcon fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {t('sidebar.articleSearch')}
                  </Typography>
                </Box>
                <ArrowForwardIcon fontSize="small" />
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PostAddIcon />}
                fullWidth
                sx={{ mt: 1, opacity: showContent ? 1 : 0, transition: `opacity ${TRANSITION_DURATION}ms ease-in-out` }}
              >
                {t('sidebar.manualAdd')}
              </Button>
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Tooltip title={t('sidebar.articleSearch')} placement="right">
                <IconButton
                  size="small"
                  onClick={() => navigate('/articles')}
                >
                  <ArticleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('sidebar.manualAdd')} placement="right">
                <IconButton size="small">
                  <PostAddIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Chat History Section */}
        <Box sx={{ p: open ? 2 : 1, pt: open ? 2 : 1 }}>
          {open ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, opacity: showContent ? 1 : 0, transition: `opacity ${TRANSITION_DURATION}ms ease-in-out` }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t('sidebar.chatHistory')}
                </Typography>
                <Tooltip title={t('sidebar.newChat')} placement="top">
                  <IconButton size="small" onClick={handleNewChat}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Tooltip title={t('sidebar.newChat')} placement="right">
                <IconButton size="small" onClick={handleNewChat}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('sidebar.chatHistory')} placement="right">
                <ChatIcon color="action" fontSize="small" />
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* Session List */}
        <List sx={{ flex: 1, overflow: 'auto' }} dense>
          {sessionsWithMessages.map((session) => (
            <ListItem
              key={session.id}
              disablePadding
              secondaryAction={
                showContent && open && (
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
                {showContent && open && (
                  <ListItemText
                    primary={session.title}
                    secondary={
                      session.mode === 'chat'
                        ? t('chat.chat')
                        : session.mode === 'paper_search'
                        ? t('chat.paperSearch')
                        : t('chat.articleSummary')
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', opacity: showContent ? 1 : 0, transition: `opacity ${TRANSITION_DURATION}ms ease-in-out` }}>
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
                  {mode === 'light' ? t('sidebar.darkMode') : t('sidebar.lightMode')}
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
                  {t('nav.settings')}
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
          {showContent && open && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
              {t('common.version')}
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
        <ChevronLeftIcon
          fontSize="small"
          sx={{
            transition: 'transform 200ms ease-in-out',
            transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        />
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
          <Typography>{t('sidebar.deleteChat')}</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
};