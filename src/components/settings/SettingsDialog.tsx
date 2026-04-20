import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Slider,
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
} from '@mui/icons-material';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useThemeMode, ThemePreference } from '../../app/ThemeProvider';
import { CloudProviderConfig, LocalProviderConfig, LocalProviderType, ModelConfig } from '../../types';

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
  const { settings, updateSettings, testConnection } = useSettingsStore();
  const { preference, setPreference } = useThemeMode();

  const [localSettings, setLocalSettings] = useState(settings);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const initializedRef = useRef(false);

  const crawlerSourceOptions = ['arxiv', 'semantic_scholar', 'ieee', 'springer'];
  const appleDevice = isApplePlatform();

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

  const handleSourceChange = (source: string) => {
    const sources = localSettings.crawlerSources.includes(source)
      ? localSettings.crawlerSources.filter((s) => s !== source)
      : [...localSettings.crawlerSources, source];
    setLocalSettings({ ...localSettings, crawlerSources: sources });
  };

  const handleTestConnection = async (providerId: string, type: 'cloud' | 'local') => {
    const result = await testConnection(providerId, type);
    setTestResults((prev) => ({ ...prev, [`${type}-${providerId}`]: result }));
  };

  const handleBrowsePath = () => {
    setLocalSettings({
      ...localSettings,
      databasePath: '/Users/example/database',
    });
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
          <Typography variant="h6">设置</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {/* Theme Settings */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>外观设置</Typography>
          <FormControl>
            <FormLabel>主题模式</FormLabel>
            <RadioGroup value={preference} onChange={handleThemeChange} row>
              <FormControlLabel value="system" control={<Radio />} label="跟随系统" />
              <FormControlLabel value="light" control={<Radio />} label="浅色模式" />
              <FormControlLabel value="dark" control={<Radio />} label="深色模式" />
            </RadioGroup>
          </FormControl>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Crawler Settings */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>爬虫设置</Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>爬取来源</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {crawlerSourceOptions.map((source) => (
                <FormControlLabel
                  key={source}
                  control={
                    <Checkbox
                      size="small"
                      checked={localSettings.crawlerSources.includes(source)}
                      onChange={() => handleSourceChange(source)}
                    />
                  }
                  label={source.toUpperCase()}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              爬取频率: 每 {localSettings.crawlIntervalHours} 小时
            </Typography>
            <Slider
              value={localSettings.crawlIntervalHours}
              onChange={(_, value) =>
                setLocalSettings({ ...localSettings, crawlIntervalHours: value as number })
              }
              min={1}
              max={24}
              step={1}
              marks
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>

          <Box>
            <Typography variant="body2" gutterBottom>数据库路径</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                value={localSettings.databasePath}
                slotProps={{ input: { readOnly: true } }}
                size="small"
              />
              <Button variant="outlined" size="small" startIcon={<FolderOpenIcon />} onClick={handleBrowsePath}>
                浏览
              </Button>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* App Settings */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>应用设置</Typography>
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
            label="开机自启动"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* LLM Settings */}
        <Box>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>大模型设置</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            可同时配置多个云端和本地模型服务
          </Typography>

          {/* Cloud Providers Section */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudIcon fontSize="small" color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>云端模型</Typography>
              </Box>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddCloudProvider}>添加</Button>
            </Box>

            {localSettings.cloudProviders.length === 0 ? (
              <Box sx={{ py: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">暂无云端服务配置</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {localSettings.cloudProviders.map((provider) => (
                  <Accordion key={provider.id} defaultExpanded={false}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 2 }}>
                        <CloudIcon fontSize="small" color="primary" />
                        <Typography variant="body2" sx={{ flex: 1 }}>{provider.name || '未命名服务'}</Typography>
                        <Chip label={`${provider.models.length} 模型`} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRemoveCloudProvider(provider.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.5}>
                        <TextField fullWidth label="服务名称" value={provider.name} onChange={(e) => handleUpdateCloudProvider(provider.id, { name: e.target.value })} size="small" />
                        <TextField fullWidth label="API Endpoint" value={provider.endpoint} onChange={(e) => handleUpdateCloudProvider(provider.id, { endpoint: e.target.value })} placeholder="https://api.openai.com/v1" size="small" />
                        <TextField fullWidth label="API Key" type="password" value={provider.apiKey} onChange={(e) => handleUpdateCloudProvider(provider.id, { apiKey: e.target.value })} size="small" />
                        <Button variant="outlined" size="small" onClick={() => handleTestConnection(provider.id, 'cloud')} sx={{ alignSelf: 'flex-start' }}>测试连接</Button>
                        {testResults[`cloud-${provider.id}`] && (
                          <Alert severity={testResults[`cloud-${provider.id}`].success ? 'success' : 'error'}>{testResults[`cloud-${provider.id}`].message}</Alert>
                        )}
                        <Divider />
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">模型列表</Typography>
                            <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddModel(provider.id, 'cloud')}>添加</Button>
                          </Box>
                          {provider.models.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">暂无模型配置</Typography>
                          ) : (
                            <Stack spacing={1}>
                              {provider.models.map((model) => (
                                <Box key={model.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                  <TextField size="small" label="模型名称" value={model.modelName} onChange={(e) => handleUpdateModel(provider.id, model.id, { modelName: e.target.value }, 'cloud')} placeholder="gpt-4o" sx={{ flex: 1 }} />
                                  <TextField size="small" label="显示名称" value={model.displayName} onChange={(e) => handleUpdateModel(provider.id, model.id, { displayName: e.target.value }, 'cloud')} placeholder="GPT-4o" sx={{ flex: 1 }} />
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
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DnsIcon fontSize="small" color="secondary" />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>本地模型</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<TerminalIcon />} onClick={() => handleAddLocalProvider('server')}>端口服务</Button>
                {appleDevice && <Button size="small" startIcon={<AppleIcon />} onClick={() => handleAddLocalProvider('mlx')}>MLX</Button>}
              </Box>
            </Box>

            {!appleDevice && (
              <Alert severity="info" sx={{ mb: 1 }}>MLX 模型仅支持 macOS、iPadOS 和 iOS 设备</Alert>
            )}

            {localSettings.localProviders.length === 0 ? (
              <Box sx={{ py: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">暂无本地服务配置</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {localSettings.localProviders.map((provider) => (
                  <Accordion key={provider.id} defaultExpanded={false}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 2 }}>
                        {getLocalProviderIcon(provider.type)}
                        <Typography variant="body2" sx={{ flex: 1 }}>{provider.name || '未命名服务'}</Typography>
                        <Chip label={provider.type === 'mlx' ? 'MLX' : '端口'} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        <Chip label={`${provider.models.length} 模型`} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRemoveLocalProvider(provider.id); }}><DeleteIcon fontSize="small" /></IconButton>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.5}>
                        <TextField fullWidth label="服务名称" value={provider.name} onChange={(e) => handleUpdateLocalProvider(provider.id, { name: e.target.value })} size="small" />
                        <FormControl size="small">
                          <FormLabel>服务类型</FormLabel>
                          <Select
                            value={provider.type}
                            onChange={(e) => handleUpdateLocalProvider(provider.id, { type: e.target.value as LocalProviderType, endpoint: e.target.value === 'mlx' ? '' : 'http://localhost:11434' })}
                            disabled={!appleDevice && provider.type === 'mlx'}
                          >
                            <MenuItem value="server">端口服务 (Ollama等)</MenuItem>
                            <MenuItem value="mlx" disabled={!appleDevice}>MLX (Apple Silicon)</MenuItem>
                          </Select>
                        </FormControl>
                        {provider.type === 'server' && (
                          <TextField fullWidth label="服务地址" value={provider.endpoint} onChange={(e) => handleUpdateLocalProvider(provider.id, { endpoint: e.target.value })} placeholder="http://localhost:11434" size="small" />
                        )}
                        {provider.type === 'mlx' && (
                          <Alert severity="info">MLX 模型使用 Apple Silicon 的 GPU 加速，无需配置服务地址</Alert>
                        )}
                        {provider.type === 'server' && (
                          <Button variant="outlined" size="small" onClick={() => handleTestConnection(provider.id, 'local')} sx={{ alignSelf: 'flex-start' }}>测试连接</Button>
                        )}
                        {testResults[`local-${provider.id}`] && (
                          <Alert severity={testResults[`local-${provider.id}`].success ? 'success' : 'error'}>{testResults[`local-${provider.id}`].message}</Alert>
                        )}
                        <Divider />
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">模型列表</Typography>
                              {provider.type === 'mlx' && (
                                <Typography variant="caption" color="text.secondary">
                                  (HuggingFace ID 或本地绝对路径)
                                </Typography>
                              )}
                            </Box>
                            <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddModel(provider.id, 'local')}>添加</Button>
                          </Box>
                          {provider.models.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">暂无模型配置</Typography>
                          ) : (
                            <Stack spacing={1}>
                              {provider.models.map((model) => (
                                <Box key={model.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                  <TextField
                                    size="small"
                                    label="模型路径"
                                    value={model.modelName}
                                    onChange={(e) => handleUpdateModel(provider.id, model.id, { modelName: e.target.value }, 'local')}
                                    placeholder={provider.type === 'mlx' ? 'mlx-community/Llama-3.2-3B-Instruct-4bit' : 'llama3'}
                                    sx={{ flex: 1 }}
                                  />
                                  <TextField size="small" label="显示名称" value={model.displayName} onChange={(e) => handleUpdateModel(provider.id, model.id, { displayName: e.target.value }, 'local')} placeholder="Llama 3" sx={{ flex: 1 }} />
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
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};