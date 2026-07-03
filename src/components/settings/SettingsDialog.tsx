import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  FormControlLabel,
  TextField,
  Button,
  Switch,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Alert,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Chip,
  Stack,
  Select,
  MenuItem,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Slider,
  Dialog as ConfirmDialog,
  DialogTitle as ConfirmDialogTitle,
  DialogContent as ConfirmDialogContent,
  DialogActions as ConfirmDialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  FolderOpen as FolderOpenIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Cloud as CloudIcon,
  Dns as DnsIcon,
  Apple as AppleIcon,
  Terminal as TerminalIcon,
  Palette as PaletteIcon,
  Storage as StorageIcon,
  Settings as SettingsIcon,
  SmartToy as SmartToyIcon,
  Chat as ChatIcon,
  Article as ArticleIcon,
  PictureAsPdf as PdfIcon,
  History as HistoryIcon,
  SdStorage as SdStorageIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { open as showOpenDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useThemeMode, ThemePreference } from '../../app/ThemeProvider';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { CloudProviderConfig, LocalProviderConfig, LocalProviderType, ModelConfig } from '../../types';
import { CategorySelectDialog } from '../common/CategorySelectDialog';
import { getCategoryByCode } from '../../constants/academicCategories';

const generateId = () => Math.random().toString(36).substring(2, 9);

// Check if running on Apple platform (macOS, iPadOS, iOS)
const isApplePlatform = () => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('mac') || userAgent.includes('iphone') || userAgent.includes('ipad');
};

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsDialog = ({ open, onClose }: SettingsDialogProps) => {
  const { t } = useTranslation();
  const { settings, updateSettings, testConnection } = useSettingsStore();
  const { preference, setPreference } = useThemeMode();
  const { language, setLanguage } = useLanguageStore();

  const [localSettings, setLocalSettings] = useState(settings);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const initializedRef = useRef(false);
  const [activeSection, setActiveSection] = useState('appearance');
  const [llmExpanded, setLlmExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState<{ open: boolean; type: 'chat' | 'reading' | 'article' | 'pdf'; months: number }>({ open: false, type: 'chat', months: 3 });
  const [cleanChatMonths, setCleanChatMonths] = useState(3);
  const [cleanReadingMonths, setCleanReadingMonths] = useState(3);
  const [cleanArticleMonths, setCleanArticleMonths] = useState(3);
  const [cleanPdfMonths, setCleanPdfMonths] = useState(3);
  const [diskUsage, setDiskUsage] = useState<{ totalGb: number; freeGb: number; appGb: number } | null>(null);
  const [categorySizes, setCategorySizes] = useState<{
    chatHistoryMb: number; readingHistoryMb: number;
    articleDatabaseMb: number; pdfFilesMb: number; totalMb: number;
  } | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [crawlerStatus, setCrawlerStatus] = useState<{
    running: boolean;
    currentSubject: string;
    subjectIndex: number;
    totalSubjects: number;
    pagesFetched: number;
    articlesFound: number;
    articlesSaved: number;
    errors: string[];
  } | null>(null);
  const [crawlMessage, setCrawlMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const crawlPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appleDevice = isApplePlatform();

  // Fetch real storage data from backend
  const fetchStorageData = useCallback(async () => {
    setStorageLoading(true);
    try {
      const [disk, stats] = await Promise.all([
        invoke<{ totalGb: number; freeGb: number; appGb: number }>('get_disk_usage'),
        invoke<{ chatHistoryMb: number; readingHistoryMb: number; articleDatabaseMb: number; pdfFilesMb: number; totalMb: number }>('get_storage_stats'),
      ]);
      setDiskUsage(disk);
      setCategorySizes(stats);
    } catch (err) {
      console.error('Failed to fetch storage data:', err);
    } finally {
      setStorageLoading(false);
    }
  }, []);

  // Refresh data when dialog opens
  useEffect(() => {
    if (open) {
      fetchStorageData();
    }
  }, [open, fetchStorageData]);

  // Calculate storage breakdown from real data
  const storageBreakdown = useMemo(() => {
    const formatSize = (mb: number) => {
      if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
      if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
      return `${mb.toFixed(1)} MB`;
    };

    if (categorySizes) {
      return {
        chatHistory: { size: formatSize(categorySizes.chatHistoryMb), sizeMB: categorySizes.chatHistoryMb },
        readingHistory: { size: formatSize(categorySizes.readingHistoryMb), sizeMB: categorySizes.readingHistoryMb },
        articleDatabase: { size: formatSize(categorySizes.articleDatabaseMb), sizeMB: categorySizes.articleDatabaseMb },
        pdfFiles: { size: formatSize(categorySizes.pdfFilesMb), sizeMB: categorySizes.pdfFilesMb },
        total: formatSize(categorySizes.totalMb),
      };
    }

    // Fallback while loading
    return {
      chatHistory: { size: '...', sizeMB: 1 },
      readingHistory: { size: '...', sizeMB: 1 },
      articleDatabase: { size: '...', sizeMB: 1 },
      pdfFiles: { size: '...', sizeMB: 1 },
      total: '...',
    };
  }, [categorySizes]);

  // Clean history handlers
  const handleCleanHistory = (type: 'chat' | 'reading' | 'article' | 'pdf') => {
    const months = type === 'chat' ? cleanChatMonths
      : type === 'reading' ? cleanReadingMonths
      : type === 'article' ? cleanArticleMonths
      : cleanPdfMonths;
    setConfirmDialogOpen({ open: true, type, months });
  };

  const handleConfirmClean = async () => {
    const { type, months } = confirmDialogOpen;
    try {
      if (type === 'chat') {
        await invoke('cleanup_chat_history', { months });
      } else if (type === 'reading') {
        await invoke('cleanup_reading_history', { months });
      } else if (type === 'article' || type === 'pdf') {
        await invoke('cleanup_articles_and_pdfs', { months });
      }
      // Refresh storage data after cleanup
      await fetchStorageData();
    } catch (err) {
      console.error('Cleanup failed:', err);
    }
    setConfirmDialogOpen({ open: false, type: 'chat', months: 3 });
  };

  // Navigation sections
  const sections = [
    { id: 'appearance', label: t('settings.appearance'), icon: <PaletteIcon fontSize="small" /> },
    { id: 'storage', label: t('settings.storage'), icon: <StorageIcon fontSize="small" /> },
    { id: 'crawl', label: t('settings.crawler'), icon: <CloudIcon fontSize="small" /> },
    { id: 'app', label: t('settings.appSettings'), icon: <SettingsIcon fontSize="small" /> },
    { id: 'llm', label: t('settings.llmSettings'), icon: <SmartToyIcon fontSize="small" />, children: [
      { id: 'llm-cloud', label: t('settings.cloudModels'), icon: <CloudIcon fontSize="small" /> },
      { id: 'llm-local', label: t('settings.localModels'), icon: <DnsIcon fontSize="small" /> },
    ]},
  ];

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    if (element && contentRef.current) {
      const container = contentRef.current;
      const elementTop = element.offsetTop - container.offsetTop - 8;
      container.scrollTo({ top: elementTop, behavior: 'smooth' });
    }
  };

  // Sync local settings when dialog opens
  useEffect(() => {
    if (open && !initializedRef.current) {
      setLocalSettings(settings);
      initializedRef.current = true;
    }
    if (!open) {
      initializedRef.current = false;
    }
  }, [open, settings]);

  // Save settings when dialog closes
  useEffect(() => {
    if (!open && initializedRef.current) {
      updateSettings(localSettings);
    }
  }, [open, localSettings, updateSettings]);

  const handleTestConnection = async (providerId: string, type: 'cloud' | 'local') => {
    const result = await testConnection(providerId, type);
    setTestResults((prev) => ({ ...prev, [`${type}-${providerId}`]: result }));
  };

  const handleBrowsePath = async () => {
    try {
      const selected = await showOpenDialog({
        multiple: false,
        directory: true,
        title: t('settings.selectPdfFolder'),
      });
      if (selected) {
        // Change PDF storage path via backend (moves files)
        await invoke('change_pdf_storage_path', { newPath: selected });
        setLocalSettings({
          ...localSettings,
          pdfStoragePath: selected,
        });
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

  // Crawler handlers
  const handleCrawlNow = async () => {
    try {
      setCrawlMessage({ type: 'info', text: '正在启动爬虫...' });
      const result = await invoke<string>('crawler_start');
      setCrawlMessage({ type: 'info', text: result });
      const status = await invoke<{
        running: boolean; currentSubject: string; subjectIndex: number;
        totalSubjects: number; pagesFetched: number; articlesFound: number;
        articlesSaved: number; errors: string[];
      }>('crawler_status');
      setCrawlerStatus(status);
    } catch (err) {
      setCrawlMessage({ type: 'error', text: String(err) });
    }
  };

  const handleCrawlStop = async () => {
    try {
      const result = await invoke<string>('crawler_stop');
      setCrawlMessage({ type: 'info', text: result });
    } catch (err) {
      setCrawlMessage({ type: 'error', text: String(err) });
    }
  };

  const pollCrawlerStatus = useCallback(async () => {
    try {
      const status = await invoke<{
        running: boolean; currentSubject: string; subjectIndex: number;
        totalSubjects: number; pagesFetched: number; articlesFound: number;
        articlesSaved: number; errors: string[];
      }>('crawler_status');
      setCrawlerStatus(status);
      if (!status.running) {
        if (crawlPollRef.current) {
          clearInterval(crawlPollRef.current);
          crawlPollRef.current = null;
        }
        if (status.errors.length > 0) {
          setCrawlMessage({ type: 'error', text: `爬取完成，但有 ${status.errors.length} 个错误` });
        } else if (status.articlesSaved > 0) {
          setCrawlMessage({ type: 'success', text: `爬取完成！新增 ${status.articlesSaved} 篇文章` });
        } else {
          setCrawlMessage({ type: 'info', text: '爬取完成，无新增文章' });
        }
      }
    } catch (err) {
      console.error('Failed to poll crawler status:', err);
    }
  }, []);

  // Polling effect
  useEffect(() => {
    if (crawlerStatus?.running) {
      if (!crawlPollRef.current) {
        crawlPollRef.current = setInterval(pollCrawlerStatus, 2000);
      }
    }
    return () => {
      if (crawlPollRef.current) {
        clearInterval(crawlPollRef.current);
        crawlPollRef.current = null;
      }
    };
  }, [crawlerStatus?.running, pollCrawlerStatus]);

  // Check if crawler is already running on dialog open
  useEffect(() => {
    if (open) {
      invoke<{
        running: boolean; currentSubject: string; subjectIndex: number;
        totalSubjects: number; pagesFetched: number; articlesFound: number;
        articlesSaved: number; errors: string[];
      }>('crawler_status').then((status) => {
        if (status.running) setCrawlerStatus(status);
      }).catch(console.error);
    }
  }, [open]);

  const handleCategoriesChange = (categories: string[]) => {
    setLocalSettings({ ...localSettings, crawlerCategories: categories });
  };

  const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPreference(event.target.value as ThemePreference);
  };

  const handleClose = () => {
    // Save before closing
    updateSettings(localSettings);
    onClose();
  };

  // Cloud Provider handlers
  const handleAddCloudProvider = () => {
    const newProvider: CloudProviderConfig = {
      id: generateId(),
      name: '新云端服务',
      endpoint: '',
      apiKey: '',
      models: [],
    };
    setLocalSettings({ ...localSettings, cloudProviders: [...localSettings.cloudProviders, newProvider] });
  };

  const handleUpdateCloudProvider = (id: string, updates: Partial<CloudProviderConfig>) => {
    setLocalSettings({
      ...localSettings,
      cloudProviders: localSettings.cloudProviders.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    });
  };

  const handleRemoveCloudProvider = (id: string) => {
    setLocalSettings({
      ...localSettings,
      cloudProviders: localSettings.cloudProviders.filter((p) => p.id !== id),
    });
  };

  // Local Provider handlers
  const handleAddLocalProvider = (type: LocalProviderType = 'server') => {
    const newProvider: LocalProviderConfig = {
      id: generateId(),
      name: type === 'mlx' ? 'MLX' : '新本地服务',
      type,
      endpoint: type === 'mlx' ? '' : 'http://localhost:11434',
      models: [],
    };
    setLocalSettings({ ...localSettings, localProviders: [...localSettings.localProviders, newProvider] });
  };

  const handleUpdateLocalProvider = (id: string, updates: Partial<LocalProviderConfig>) => {
    setLocalSettings({
      ...localSettings,
      localProviders: localSettings.localProviders.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    });
  };

  const handleRemoveLocalProvider = (id: string) => {
    setLocalSettings({
      ...localSettings,
      localProviders: localSettings.localProviders.filter((p) => p.id !== id),
    });
  };

  // Model handlers
  const handleAddModel = (providerId: string, type: 'cloud' | 'local') => {
    const newModel: ModelConfig = {
      id: generateId(),
      modelName: '',
      displayName: '',
    };

    if (type === 'cloud') {
      setLocalSettings({
        ...localSettings,
        cloudProviders: localSettings.cloudProviders.map((p) =>
          p.id === providerId ? { ...p, models: [...p.models, newModel] } : p
        ),
      });
    } else {
      setLocalSettings({
        ...localSettings,
        localProviders: localSettings.localProviders.map((p) =>
          p.id === providerId ? { ...p, models: [...p.models, newModel] } : p
        ),
      });
    }
  };

  const handleUpdateModel = (
    providerId: string,
    modelId: string,
    updates: Partial<ModelConfig>,
    type: 'cloud' | 'local'
  ) => {
    if (type === 'cloud') {
      setLocalSettings({
        ...localSettings,
        cloudProviders: localSettings.cloudProviders.map((p) =>
          p.id === providerId
            ? { ...p, models: p.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m)) }
            : p
        ),
      });
    } else {
      setLocalSettings({
        ...localSettings,
        localProviders: localSettings.localProviders.map((p) =>
          p.id === providerId
            ? { ...p, models: p.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m)) }
            : p
        ),
      });
    }
  };

  const handleRemoveModel = (providerId: string, modelId: string, type: 'cloud' | 'local') => {
    if (type === 'cloud') {
      setLocalSettings({
        ...localSettings,
        cloudProviders: localSettings.cloudProviders.map((p) =>
          p.id === providerId ? { ...p, models: p.models.filter((m) => m.id !== modelId) } : p
        ),
      });
    } else {
      setLocalSettings({
        ...localSettings,
        localProviders: localSettings.localProviders.map((p) =>
          p.id === providerId ? { ...p, models: p.models.filter((m) => m.id !== modelId) } : p
        ),
      });
    }
  };

  const getLocalProviderIcon = (type: LocalProviderType) => {
    if (type === 'mlx') {
      return <AppleIcon fontSize="small" sx={{ color: '#A3AAAE' }} />;
    }
    return <DnsIcon fontSize="small" color="secondary" />;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '85vh' },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">{t('settings.title')}</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Left Navigation */}
        <Box
          sx={{
            width: 160,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
          }}
        >
          <List dense sx={{ py: 1 }}>
            {sections.map((section) => (
              <Box key={section.id}>
                <ListItemButton
                  selected={activeSection === section.id || (section.children && activeSection.startsWith(section.id + '-'))}
                  onClick={() => {
                    if (section.children) {
                      setLlmExpanded(!llmExpanded);
                    } else {
                      scrollToSection(section.id);
                    }
                  }}
                  sx={{
                    mx: 0.5,
                    borderRadius: 1,
                    '&.Mui-selected': {
                      bgcolor: 'primary.light',
                      '&:hover': { bgcolor: 'primary.light' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>{section.icon}</ListItemIcon>
                  <ListItemText primary={section.label} primaryTypographyProps={{ variant: 'body2' }} />
                  {section.children && (
                    <ExpandMoreIcon
                      sx={{
                        transform: llmExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 200ms',
                        fontSize: 18,
                      }}
                    />
                  )}
                </ListItemButton>
                {section.children && llmExpanded && (
                  <List dense disablePadding sx={{ pl: 2 }}>
                    {section.children.map((child) => (
                      <ListItemButton
                        key={child.id}
                        selected={activeSection === child.id}
                        onClick={() => scrollToSection(child.id)}
                        sx={{
                          mx: 0.5,
                          borderRadius: 1,
                          '&.Mui-selected': {
                            bgcolor: 'primary.light',
                            '&:hover': { bgcolor: 'primary.light' },
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 28 }}>{child.icon}</ListItemIcon>
                        <ListItemText primary={child.label} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>
            ))}
          </List>
        </Box>

        {/* Right Content */}
        <Box
          ref={contentRef}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
          }}
        >
          {/* Theme Settings */}
          <Box id="section-appearance" sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>{t('settings.appearance')}</Typography>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('settings.themeMode')}</Typography>
            <RadioGroup value={preference} onChange={handleThemeChange} row>
              <FormControlLabel value="system" control={<Radio />} label={t('settings.followSystem')} />
              <FormControlLabel value="light" control={<Radio />} label={t('settings.lightMode')} />
              <FormControlLabel value="dark" control={<Radio />} label={t('settings.darkMode')} />
            </RadioGroup>
          </Box>

          {/* Language Settings */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('settings.language')}</Typography>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as string)}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="zh">中文</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </Select>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Database Settings */}
        <Box id="section-storage" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>{t('settings.storage')}</Typography>

          {/* Disk Usage Overview */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Typography variant="body2" gutterBottom sx={{ fontWeight: 500, mb: 1.5 }}>
              <SdStorageIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-top' }} />
              {t('settings.diskUsage')}
            </Typography>
            {storageLoading || !diskUsage ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
              </Box>
            ) : (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">{t('settings.totalDisk')}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{diskUsage.totalGb.toFixed(1)} GB</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">{t('settings.appUsage')}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{diskUsage.appGb.toFixed(2)} GB</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">{t('settings.freeSpace')}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{diskUsage.freeGb.toFixed(1)} GB</Typography>
                </Box>
                {/* Three-color segmented bar */}
                <Box sx={{ width: '100%', height: 10, borderRadius: 1, mt: 1, display: 'flex', gap: 0.25, overflow: 'hidden' }}>
                  {(() => {
                    const total = diskUsage.totalGb;
                    if (total <= 0) return null;
                    const otherPct = Math.max(0, ((total - diskUsage.freeGb - diskUsage.appGb) / total) * 100);
                    const appPct = Math.max(0, (diskUsage.appGb / total) * 100);
                    const freePct = Math.max(0, (diskUsage.freeGb / total) * 100);
                    return (
                      <>
                        <Box sx={{ width: `${otherPct}%`, bgcolor: 'warning.main', borderRadius: 1, minWidth: otherPct > 0 ? 2 : 0 }} />
                        <Box sx={{ width: `${appPct}%`, bgcolor: diskUsage.appGb / total > 0.8 ? 'error.main' : 'primary.main', borderRadius: 1, minWidth: appPct > 0 ? 2 : 0 }} />
                        <Box sx={{ width: `${freePct}%`, bgcolor: 'grey.300', borderRadius: 1, minWidth: freePct > 0 ? 2 : 0 }} />
                      </>
                    );
                  })()}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                    <Typography variant="caption" color="text.secondary">{t('settings.otherUsage')}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
                    <Typography variant="caption" color="text.secondary">{t('settings.appUsage')}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'grey.300' }} />
                    <Typography variant="caption" color="text.secondary">{t('settings.freeSpace')}</Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>

          {/* Storage Breakdown */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>{t('settings.storageBreakdown')}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Chat History */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <ChatIcon fontSize="small" color="primary" />
                    <Typography variant="body2">{t('settings.chatHistory')}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, ml: 1 }}>{storageBreakdown.chatHistory.size}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FormControl size="small" sx={{ '& .MuiOutlinedInput-root': { height: 28 }, '& .MuiSelect-select': { py: 0.5, fontSize: '0.75rem' }, minWidth: 85 }}>
                      <Select
                        value={cleanChatMonths}
                        onChange={(e) => setCleanChatMonths(e.target.value as number)}
                      >
                        <MenuItem value={1} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 1 })}</MenuItem>
                        <MenuItem value={3} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 3 })}</MenuItem>
                        <MenuItem value={6} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 6 })}</MenuItem>
                        <MenuItem value={12} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 12 })}</MenuItem>
                        <MenuItem value={999} sx={{ fontSize: '0.75rem' }}>{t('settings.allTime')}</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      onClick={() => handleCleanHistory('chat')}
                      sx={{ height: 28, minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                    >
                      {t('settings.cleanBefore')}
                    </Button>
                  </Box>
                </Box>
                <LinearProgress variant="determinate" value={(storageBreakdown.chatHistory.sizeMB / 100) * 100} sx={{ height: 6, borderRadius: 1 }} color="primary" />
              </Box>

              {/* Reading History */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <HistoryIcon fontSize="small" color="secondary" />
                    <Typography variant="body2">{t('settings.readingHistory')}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, ml: 1 }}>{storageBreakdown.readingHistory.size}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FormControl size="small" sx={{ '& .MuiOutlinedInput-root': { height: 28 }, '& .MuiSelect-select': { py: 0.5, fontSize: '0.75rem' }, minWidth: 85 }}>
                      <Select
                        value={cleanReadingMonths}
                        onChange={(e) => setCleanReadingMonths(e.target.value as number)}
                      >
                        <MenuItem value={1} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 1 })}</MenuItem>
                        <MenuItem value={3} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 3 })}</MenuItem>
                        <MenuItem value={6} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 6 })}</MenuItem>
                        <MenuItem value={12} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 12 })}</MenuItem>
                        <MenuItem value={999} sx={{ fontSize: '0.75rem' }}>{t('settings.allTime')}</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      onClick={() => handleCleanHistory('reading')}
                      sx={{ height: 28, minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                    >
                      {t('settings.cleanBefore')}
                    </Button>
                  </Box>
                </Box>
                <LinearProgress variant="determinate" value={(storageBreakdown.readingHistory.sizeMB / 100) * 100} sx={{ height: 6, borderRadius: 1 }} color="secondary" />
              </Box>

              {/* Article Database */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <ArticleIcon fontSize="small" color="info" />
                    <Typography variant="body2">{t('settings.articleDatabase')}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, ml: 1 }}>{storageBreakdown.articleDatabase.size}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FormControl size="small" sx={{ '& .MuiOutlinedInput-root': { height: 28 }, '& .MuiSelect-select': { py: 0.5, fontSize: '0.75rem' }, minWidth: 85 }}>
                      <Select
                        value={cleanArticleMonths}
                        onChange={(e) => setCleanArticleMonths(e.target.value as number)}
                      >
                        <MenuItem value={1} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 1 })}</MenuItem>
                        <MenuItem value={3} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 3 })}</MenuItem>
                        <MenuItem value={6} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 6 })}</MenuItem>
                        <MenuItem value={12} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 12 })}</MenuItem>
                        <MenuItem value={999} sx={{ fontSize: '0.75rem' }}>{t('settings.allTime')}</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      onClick={() => handleCleanHistory('article')}
                      sx={{ height: 28, minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                    >
                      {t('settings.cleanBefore')}
                    </Button>
                  </Box>
                </Box>
                <LinearProgress variant="determinate" value={(storageBreakdown.articleDatabase.sizeMB / 100) * 100} sx={{ height: 6, borderRadius: 1 }} color="info" />
              </Box>

              {/* PDF Files */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <PdfIcon fontSize="small" color="error" />
                    <Typography variant="body2">{t('settings.pdfFiles')}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, ml: 1 }}>{storageBreakdown.pdfFiles.size}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FormControl size="small" sx={{ '& .MuiOutlinedInput-root': { height: 28 }, '& .MuiSelect-select': { py: 0.5, fontSize: '0.75rem' }, minWidth: 85 }}>
                      <Select
                        value={cleanPdfMonths}
                        onChange={(e) => setCleanPdfMonths(e.target.value as number)}
                      >
                        <MenuItem value={1} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 1 })}</MenuItem>
                        <MenuItem value={3} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 3 })}</MenuItem>
                        <MenuItem value={6} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 6 })}</MenuItem>
                        <MenuItem value={12} sx={{ fontSize: '0.75rem' }}>{t('settings.monthsAgo', { count: 12 })}</MenuItem>
                        <MenuItem value={999} sx={{ fontSize: '0.75rem' }}>{t('settings.allTime')}</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      onClick={() => handleCleanHistory('pdf')}
                      sx={{ height: 28, minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                    >
                      {t('settings.cleanBefore')}
                    </Button>
                  </Box>
                </Box>
                <LinearProgress variant="determinate" value={(storageBreakdown.pdfFiles.sizeMB / 100) * 100} sx={{ height: 6, borderRadius: 1 }} color="error" />
              </Box>
            </Box>

            {/* Total */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{t('settings.storageUsage')}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{storageBreakdown.total}</Typography>
            </Box>
          </Box>

          {/* PDF Storage Path */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>{t('settings.pdfStoragePath')}</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                sx={{ flex: 1 }}
                value={localSettings.pdfStoragePath || '~/.research_dashboard'}
                slotProps={{ input: { readOnly: true } }}
                size="small"
              />
              <Button variant="outlined" size="small" startIcon={<FolderOpenIcon />} onClick={handleBrowsePath} sx={{ flexShrink: 0 }}>
                {t('settings.browse')}
              </Button>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Crawler Settings */}
        <Box id="section-crawl" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>爬虫设置</Typography>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>爬取领域 ({localSettings.crawlerCategories.length} 个已选)</Typography>
              <Button size="small" startIcon={<EditIcon />} onClick={() => setCategoryDialogOpen(true)}>编辑领域</Button>
            </Box>
            {localSettings.crawlerCategories.length === 0 ? (
              <Typography variant="body2" color="text.secondary">暂无已选领域，请点击编辑领域添加</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {localSettings.crawlerCategories.slice(0, 10).map((code) => {
                  const cat = getCategoryByCode(code);
                  return <Chip key={code} label={cat?.name || code} size="small" variant="outlined" />;
                })}
                {localSettings.crawlerCategories.length > 10 && (
                  <Chip label={`+${localSettings.crawlerCategories.length - 10} 更多`} size="small" variant="outlined" />
                )}
              </Box>
            )}
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>爬取频率: 每 {localSettings.crawlIntervalHours} 小时</Typography>
            <Slider
              value={localSettings.crawlIntervalHours}
              onChange={(_, value) => setLocalSettings({ ...localSettings, crawlIntervalHours: value as number })}
              min={1} max={24} step={1} marks valueLabelDisplay="auto" size="small"
            />
          </Box>

          {localSettings.lastCrawlTime && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              上次爬取: {localSettings.lastCrawlTime}
            </Typography>
          )}

          {crawlerStatus?.running ? (
            <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <CircularProgress size={14} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>爬虫运行中...</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, ml: 3 }}>
                <Typography variant="caption" color="text.secondary">分类: {crawlerStatus.currentSubject || '等待中...'} ({crawlerStatus.subjectIndex}/{crawlerStatus.totalSubjects})</Typography>
                <Typography variant="caption" color="text.secondary">已爬取 {crawlerStatus.pagesFetched} 页</Typography>
                <Typography variant="caption" color="text.secondary">发现 {crawlerStatus.articlesFound} 篇, 新增 {crawlerStatus.articlesSaved} 篇</Typography>
              </Box>
            </Box>
          ) : crawlerStatus && !crawlerStatus.running && crawlerStatus.articlesSaved > 0 ? (
            <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'success.light', borderRadius: 1, color: 'success.contrastText' }}>
              <Typography variant="body2">上次爬取完成: 新增 {crawlerStatus.articlesSaved} 篇</Typography>
            </Box>
          ) : null}

          {crawlMessage && !crawlerStatus?.running && (
            <Alert severity={crawlMessage.type} sx={{ mb: 1.5 }}>{crawlMessage.text}</Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" size="small" startIcon={crawlerStatus?.running ? <CircularProgress size={14} color="inherit" /> : <CloudIcon />} onClick={handleCrawlNow} disabled={crawlerStatus?.running}>
              {crawlerStatus?.running ? '爬取中...' : '现在爬取'}
            </Button>
            {crawlerStatus?.running && (
              <Button variant="outlined" size="small" color="error" onClick={handleCrawlStop}>停止</Button>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* App Settings */}
        <Box id="section-app" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>{t('settings.appSettings')}</Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={localSettings.autoLaunch}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, autoLaunch: e.target.checked })
                }
              />
            }
            label={t('settings.autoLaunch')}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* LLM Settings */}
        <Box id="section-llm">
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>{t('settings.llmSettings')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('settings.llmSettingsDesc')}
          </Typography>

          {/* Cloud Providers Section */}
          <Box id="section-llm-cloud" sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudIcon fontSize="small" color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{t('settings.cloudModels')}</Typography>
              </Box>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddCloudProvider}>{t('common.add')}</Button>
            </Box>

            {localSettings.cloudProviders.length === 0 ? (
              <Box sx={{ py: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">{t('settings.noCloudConfig')}</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {localSettings.cloudProviders.map((provider) => (
                  <Accordion key={provider.id} defaultExpanded={false}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 2 }}>
                        <CloudIcon fontSize="small" color="primary" />
                        <Typography variant="body2" sx={{ flex: 1 }}>{provider.name || t('settings.unnamedService')}</Typography>
                        <Chip label={`${provider.models.length} ${t('settings.models')}`} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRemoveCloudProvider(provider.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.5}>
                        <TextField fullWidth label={t('settings.serviceName')} value={provider.name} onChange={(e) => handleUpdateCloudProvider(provider.id, { name: e.target.value })} size="small" />
                        <TextField fullWidth label={t('settings.apiEndpoint')} value={provider.endpoint} onChange={(e) => handleUpdateCloudProvider(provider.id, { endpoint: e.target.value })} placeholder="https://api.openai.com/v1" size="small" />
                        <TextField fullWidth label={t('settings.apiKey')} type="password" value={provider.apiKey} onChange={(e) => handleUpdateCloudProvider(provider.id, { apiKey: e.target.value })} size="small" />
                        <Button variant="outlined" size="small" onClick={() => handleTestConnection(provider.id, 'cloud')} sx={{ alignSelf: 'flex-start' }}>{t('settings.testConnection')}</Button>
                        {testResults[`cloud-${provider.id}`] && (
                          <Alert severity={testResults[`cloud-${provider.id}`].success ? 'success' : 'error'}>{testResults[`cloud-${provider.id}`].message}</Alert>
                        )}
                        <Divider />
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">{t('settings.modelList')}</Typography>
                            <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddModel(provider.id, 'cloud')}>{t('common.add')}</Button>
                          </Box>
                          {provider.models.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">{t('settings.noModels')}</Typography>
                          ) : (
                            <Stack spacing={1}>
                              {provider.models.map((model) => (
                                <Box key={model.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                  <TextField size="small" label={t('settings.modelName')} value={model.modelName} onChange={(e) => handleUpdateModel(provider.id, model.id, { modelName: e.target.value }, 'cloud')} placeholder="gpt-4o" sx={{ flex: 1 }} />
                                  <TextField size="small" label={t('settings.displayName')} value={model.displayName} onChange={(e) => handleUpdateModel(provider.id, model.id, { displayName: e.target.value }, 'cloud')} placeholder="GPT-4o" sx={{ flex: 1 }} />
                                  <IconButton size="small" onClick={() => handleRemoveModel(provider.id, model.id, 'cloud')}><DeleteIcon fontSize="small" /></IconButton>
                                </Box>
                              ))}
                            </Stack>
                          )}
                        </Box>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Local Providers Section */}
          <Box id="section-llm-local">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DnsIcon fontSize="small" color="secondary" />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{t('settings.localModels')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<TerminalIcon />} onClick={() => handleAddLocalProvider('server')}>{t('settings.addPort')}</Button>
                {appleDevice && <Button size="small" startIcon={<AppleIcon />} onClick={() => handleAddLocalProvider('mlx')}>MLX</Button>}
              </Box>
            </Box>

            {!appleDevice && (
              <Alert severity="info" sx={{ mb: 1 }}>{t('settings.mlxOnlyApple')}</Alert>
            )}

            {localSettings.localProviders.length === 0 ? (
              <Box sx={{ py: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">{t('settings.noLocalConfig')}</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {localSettings.localProviders.map((provider) => (
                  <Accordion key={provider.id} defaultExpanded={false}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 2 }}>
                        {getLocalProviderIcon(provider.type)}
                        <Typography variant="body2" sx={{ flex: 1 }}>{provider.name || t('settings.unnamedService')}</Typography>
                        <Chip label={provider.type === 'mlx' ? 'MLX' : t('settings.portService')} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        <Chip label={`${provider.models.length} ${t('settings.models')}`} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRemoveLocalProvider(provider.id); }}><DeleteIcon fontSize="small" /></IconButton>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.5}>
                        <TextField fullWidth label={t('settings.serviceName')} value={provider.name} onChange={(e) => handleUpdateLocalProvider(provider.id, { name: e.target.value })} size="small" />
                        <FormControl size="small">
                          <FormLabel>{t('settings.serverType')}</FormLabel>
                          <Select
                            value={provider.type}
                            onChange={(e) => handleUpdateLocalProvider(provider.id, { type: e.target.value as LocalProviderType, endpoint: e.target.value === 'mlx' ? '' : 'http://localhost:11434' })}
                            disabled={!appleDevice && provider.type === 'mlx'}
                          >
                            <MenuItem value="server">{t('settings.server')}</MenuItem>
                            <MenuItem value="mlx" disabled={!appleDevice}>{t('settings.mlx')}</MenuItem>
                          </Select>
                        </FormControl>
                        {provider.type === 'server' && (
                          <TextField fullWidth label={t('settings.serviceAddress')} value={provider.endpoint} onChange={(e) => handleUpdateLocalProvider(provider.id, { endpoint: e.target.value })} placeholder="http://localhost:11434" size="small" />
                        )}
                        {provider.type === 'mlx' && (
                          <Alert severity="info">{t('settings.mlxInfo')}</Alert>
                        )}
                        {provider.type === 'server' && (
                          <Button variant="outlined" size="small" onClick={() => handleTestConnection(provider.id, 'local')} sx={{ alignSelf: 'flex-start' }}>{t('settings.testConnection')}</Button>
                        )}
                        {testResults[`local-${provider.id}`] && (
                          <Alert severity={testResults[`local-${provider.id}`].success ? 'success' : 'error'}>{testResults[`local-${provider.id}`].message}</Alert>
                        )}
                        <Divider />
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">{t('settings.modelList')}</Typography>
                              {provider.type === 'mlx' && (
                                <Typography variant="caption" color="text.secondary">
                                  {t('settings.huggingfaceHint')}
                                </Typography>
                              )}
                            </Box>
                            <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddModel(provider.id, 'local')}>{t('common.add')}</Button>
                          </Box>
                          {provider.models.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">{t('settings.noModels')}</Typography>
                          ) : (
                            <Stack spacing={1}>
                              {provider.models.map((model) => (
                                <Box key={model.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                  <TextField
                                    size="small"
                                    label={t('settings.modelPath')}
                                    value={model.modelName}
                                    onChange={(e) => handleUpdateModel(provider.id, model.id, { modelName: e.target.value }, 'local')}
                                    placeholder={provider.type === 'mlx' ? 'mlx-community/Llama-3.2-3B-Instruct-4bit' : 'llama3'}
                                    sx={{ flex: 1 }}
                                  />
                                  <TextField size="small" label={t('settings.displayName')} value={model.displayName} onChange={(e) => handleUpdateModel(provider.id, model.id, { displayName: e.target.value }, 'local')} placeholder="Llama 3" sx={{ flex: 1 }} />
                                  <IconButton size="small" onClick={() => handleRemoveModel(provider.id, model.id, 'local')}><DeleteIcon fontSize="small" /></IconButton>
                                </Box>
                              ))}
                            </Stack>
                          )}
                        </Box>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            )}
          </Box>
        </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.close')}</Button>
      </DialogActions>

      {/* Confirm Clean Dialog */}
      <ConfirmDialog open={confirmDialogOpen.open} onClose={() => setConfirmDialogOpen({ open: false, type: 'chat', months: 3 })}>
        <ConfirmDialogTitle>{t('settings.cleanConfirmTitle')}</ConfirmDialogTitle>
        <ConfirmDialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('settings.cleanConfirmMessage', {
              months: confirmDialogOpen.months === 999 ? t('settings.allTime') : confirmDialogOpen.months,
              type: confirmDialogOpen.type === 'chat' ? t('settings.chatHistory')
                : confirmDialogOpen.type === 'reading' ? t('settings.readingHistory')
                : confirmDialogOpen.type === 'article' ? t('settings.articleDatabase')
                : t('settings.pdfFiles')
            })}
          </Alert>
        </ConfirmDialogContent>
        <ConfirmDialogActions>
          <Button onClick={() => setConfirmDialogOpen({ open: false, type: 'chat', months: 3 })}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={handleConfirmClean}>{t('common.confirm')}</Button>
        </ConfirmDialogActions>
      </ConfirmDialog>
      <CategorySelectDialog
        open={categoryDialogOpen}
        selectedCategories={localSettings.crawlerCategories}
        onClose={() => setCategoryDialogOpen(false)}
        onSave={handleCategoriesChange}
      />
    </Dialog>
  );
};