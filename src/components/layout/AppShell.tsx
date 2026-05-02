import { useState, useCallback, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { SideDrawer } from './SideDrawer';
import { RightToolbar } from './RightToolbar';
import { SettingsDialog } from '../settings/SettingsDialog';
import { ManualAddDialog } from '../article/ManualAddDialog';

export const AppShell = () => {
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const isSm = useMediaQuery(theme.breakpoints.up('sm'));
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [rightToolbarOpen, setRightToolbarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(false);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openManualAdd = useCallback(() => setManualAddOpen(true), []);

  const outletContext = useMemo(() => ({ openSettings }), [openSettings]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left Drawer */}
      <SideDrawer open={drawerOpen && isSm} onToggle={() => setDrawerOpen(!drawerOpen)} onOpenSettings={openSettings} onOpenManualAdd={openManualAdd} />

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
        <Outlet context={outletContext} />
      </Box>

      {/* Right Toolbar */}
      {isMd && <RightToolbar open={rightToolbarOpen} onToggle={() => setRightToolbarOpen(!rightToolbarOpen)} />}

      {/* Dialogs */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ManualAddDialog open={manualAddOpen} onClose={() => setManualAddOpen(false)} />
    </Box>
  );
};