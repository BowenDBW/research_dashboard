import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { SideDrawer } from './SideDrawer';
import { RightToolbar } from './RightToolbar';

export const AppShell = () => {
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const isSm = useMediaQuery(theme.breakpoints.up('sm'));
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [rightToolbarOpen, setRightToolbarOpen] = useState(true);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left Drawer */}
      <SideDrawer open={drawerOpen && isSm} onToggle={() => setDrawerOpen(!drawerOpen)} />

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <Outlet />
      </Box>

      {/* Right Toolbar */}
      {isMd && <RightToolbar open={rightToolbarOpen} onToggle={() => setRightToolbarOpen(!rightToolbarOpen)} />}
    </Box>
  );
};