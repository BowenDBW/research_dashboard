import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Paper,
  FormControlLabel,
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
  IconButton as MuiIconButton,
  Chip,
  Stack,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FolderOpen as FolderOpenIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Cloud as CloudIcon,
  Storage as StorageIcon,
  Apple as AppleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useThemeMode, ThemePreference } from '../../app/ThemeProvider';
import { CloudProviderConfig, LocalProviderConfig, LocalProviderType, ModelConfig } from '../../types';
import { CategorySelectDialog } from '../../components/common/CategorySelectDialog';
import { getCategoryByCode } from '../../constants/academicCategories';

const generateId = () => Math.random().toString(36).substring(2, 9);

// Check if running on Apple platform (macOS, iPadOS, iOS)
const isApplePlatform = () => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('mac') || userAgent.includes('iphone') || userAgent.includes('ipad');
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const {
    settings,
    updateSettings,
    testConnection,
  } = useSettingsStore();
  const { preference, setPreference } = useThemeMode();

  const [localSettings, setLocalSettings] = useState(settings);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const appleDevice = isApplePlatform();

  // Sync local settings with store
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Auto-save when local settings change
  useEffect(() => {
    updateSettings(localSettings);
  }, [localSettings, updateSettings]);

  const handleCategoriesChange = (categories: string[]) => {
    setLocalSettings({ ...localSettings, crawlerCategories: categories });
  };

  const handleTestConnection = async (providerId: string, type: 'cloud' | 'local') => {
    const result = await testConnection(providerId, type);
    setTestResults((prev) => ({ ...prev, [`${type}-${providerId}`]: result }));
  };

  const handleBrowsePath = () => {
    setLocalSettings({
      ...localSettings,
      pdfStoragePath: '~/.research_dashboard',
    });
  };

  const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPreference(event.target.value as ThemePreference);
  };

  const handleBackClick = () => {
    navigate('/');
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
    const updated = { ...localSettings, cloudProviders: [...localSettings.cloudProviders, newProvider] };
    setLocalSettings(updated);
  };

  const handleUpdateCloudProvider = (id: string, updates: Partial<CloudProviderConfig>) => {
    const updated = {
      ...localSettings,
      cloudProviders: localSettings.cloudProviders.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    };
    setLocalSettings(updated);
  };

  const handleRemoveCloudProvider = (id: string) => {
    const updated = {
      ...localSettings,
      cloudProviders: localSettings.cloudProviders.filter((p) => p.id !== id),
    };
    setLocalSettings(updated);
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
    const updated = { ...localSettings, localProviders: [...localSettings.localProviders, newProvider] };
    setLocalSettings(updated);
  };

  const handleUpdateLocalProvider = (id: string, updates: Partial<LocalProviderConfig>) => {
    const updated = {
      ...localSettings,
      localProviders: localSettings.localProviders.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    };
    setLocalSettings(updated);
  };

  const handleRemoveLocalProvider = (id: string) => {
    const updated = {
      ...localSettings,
      localProviders: localSettings.localProviders.filter((p) => p.id !== id),
    };
    setLocalSettings(updated);
  };

  // Model handlers
  const handleAddModel = (providerId: string, type: 'cloud' | 'local') => {
    const newModel: ModelConfig = {
      id: generateId(),
      modelName: '',
      displayName: '',
    };

    if (type === 'cloud') {
      const updated = {
        ...localSettings,
        cloudProviders: localSettings.cloudProviders.map((p) =>
          p.id === providerId ? { ...p, models: [...p.models, newModel] } : p
        ),
      };
      setLocalSettings(updated);
    } else {
      const updated = {
        ...localSettings,
        localProviders: localSettings.localProviders.map((p) =>
          p.id === providerId ? { ...p, models: [...p.models, newModel] } : p
        ),
      };
      setLocalSettings(updated);
    }
  };

  const handleUpdateModel = (
    providerId: string,
    modelId: string,
    updates: Partial<ModelConfig>,
    type: 'cloud' | 'local'
  ) => {
    if (type === 'cloud') {
      const updated = {
        ...localSettings,
        cloudProviders: localSettings.cloudProviders.map((p) =>
          p.id === providerId
            ? { ...p, models: p.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m)) }
            : p
        ),
      };
      setLocalSettings(updated);
    } else {
      const updated = {
        ...localSettings,
        localProviders: localSettings.localProviders.map((p) =>
          p.id === providerId
            ? { ...p, models: p.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m)) }
            : p
        ),
      };
      setLocalSettings(updated);
    }
  };

  const handleRemoveModel = (providerId: string, modelId: string, type: 'cloud' | 'local') => {
    if (type === 'cloud') {
      const updated = {
        ...localSettings,
        cloudProviders: localSettings.cloudProviders.map((p) =>
          p.id === providerId ? { ...p, models: p.models.filter((m) => m.id !== modelId) } : p
        ),
      };
      setLocalSettings(updated);
    } else {
      const updated = {
        ...localSettings,
        localProviders: localSettings.localProviders.map((p) =>
          p.id === providerId ? { ...p, models: p.models.filter((m) => m.id !== modelId) } : p
        ),
      };
      setLocalSettings(updated);
    }
  };

  const getLocalProviderIcon = (type: LocalProviderType) => {
    if (type === 'mlx') {
      return <AppleIcon fontSize="small" sx={{ color: '#A3AAAE' }} />;
    }
    return <StorageIcon fontSize="small" color="secondary" />;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'background.paper', zIndex: 100 }}>
        <Toolbar>
          <IconButton
            onClick={handleBackClick}
            sx={{
              pointerEvents: 'auto',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2 }}>
            设置
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Container maxWidth="md" sx={{ py: 3, overflow: 'auto' }}>
        {/* Theme Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>外观设置</Typography>
          <FormControl>
            <FormLabel>主题模式</FormLabel>
            <RadioGroup value={preference} onChange={handleThemeChange} row>
              <FormControlLabel value="system" control={<Radio />} label="跟随系统" />
              <FormControlLabel value="light" control={<Radio />} label="浅色模式" />
              <FormControlLabel value="dark" control={<Radio />} label="深色模式" />
            </RadioGroup>
          </FormControl>
        </Paper>

        {/* Crawler Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>爬虫设置</Typography>

          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">爬取领域 ({localSettings.crawlerCategories.length} 个已选)</Typography>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => setCategoryDialogOpen(true)}
              >
                编辑领域
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {localSettings.crawlerCategories.slice(0, 10).map((code) => {
                const cat = getCategoryByCode(code);
                return (
                  <Chip
                    key={code}
                    label={cat?.name || code}
                    size="small"
                    variant="outlined"
                  />
                );
              })}
              {localSettings.crawlerCategories.length > 10 && (
                <Chip
                  label={`+${localSettings.crawlerCategories.length - 10} 更多`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
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
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>PDF 存储路径</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                value={localSettings.pdfStoragePath || '~/.research_dashboard'}
                slotProps={{ input: { readOnly: true } }}
                size="small"
              />
              <Button variant="outlined" startIcon={<FolderOpenIcon />} onClick={handleBrowsePath}>
                浏览
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* App Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>应用设置</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={localSettings.autoLaunch}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, autoLaunch: e.target.checked })
                }
              />
            }
            label="开机自启动"
          />
        </Paper>

        {/* LLM Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>大模型设置</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            可同时配置多个云端和本地模型服务
          </Typography>

          {/* Cloud Providers Section */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2">云端模型</Typography>
              </Box>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddCloudProvider}
              >
                添加云端服务
              </Button>
            </Box>

            {localSettings.cloudProviders.length === 0 ? (
              <Box sx={{ py: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  暂无云端服务配置
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {localSettings.cloudProviders.map((provider) => (
                  <Accordion key={provider.id} defaultExpanded={false}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 2 }}>
                        <CloudIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2" sx={{ flex: 1 }}>
                          {provider.name || '未命名服务'}
                        </Typography>
                        <Chip
                          label={`${provider.models.length} 个模型`}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <MuiIconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCloudProvider(provider.id);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </MuiIconButton>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        <TextField
                          fullWidth
                          label="服务名称"
                          value={provider.name}
                          onChange={(e) =>
                            handleUpdateCloudProvider(provider.id, { name: e.target.value })
                          }
                          size="small"
                        />
                        <TextField
                          fullWidth
                          label="API Endpoint"
                          value={provider.endpoint}
                          onChange={(e) =>
                            handleUpdateCloudProvider(provider.id, { endpoint: e.target.value })
                          }
                          placeholder="https://api.openai.com/v1"
                          size="small"
                        />
                        <TextField
                          fullWidth
                          label="API Key"
                          type="password"
                          value={provider.apiKey}
                          onChange={(e) =>
                            handleUpdateCloudProvider(provider.id, { apiKey: e.target.value })
                          }
                          size="small"
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleTestConnection(provider.id, 'cloud')}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          测试连接
                        </Button>
                        {testResults[`cloud-${provider.id}`] && (
                          <Alert
                            severity={testResults[`cloud-${provider.id}`].success ? 'success' : 'error'}
                          >
                            {testResults[`cloud-${provider.id}`].message}
                          </Alert>
                        )}

                        <Divider />

                        {/* Models */}
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="subtitle2">模型列表</Typography>
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => handleAddModel(provider.id, 'cloud')}
                            >
                              添加模型
                            </Button>
                          </Box>

                          {provider.models.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              暂无模型配置
                            </Typography>
                          ) : (
                            <Stack spacing={1}>
                              {provider.models.map((model) => (
                                <Box
                                  key={model.id}
                                  sx={{
                                    display: 'flex',
                                    gap: 1,
                                    alignItems: 'center',
                                    p: 1,
                                    bgcolor: 'action.hover',
                                    borderRadius: 1,
                                  }}
                                >
                                  <TextField
                                    size="small"
                                    label="模型名称"
                                    value={model.modelName}
                                    onChange={(e) =>
                                      handleUpdateModel(provider.id, model.id, { modelName: e.target.value }, 'cloud')
                                    }
                                    placeholder="gpt-4o"
                                    sx={{ flex: 1 }}
                                  />
                                  <TextField
                                    size="small"
                                    label="显示名称"
                                    value={model.displayName}
                                    onChange={(e) =>
                                      handleUpdateModel(provider.id, model.id, { displayName: e.target.value }, 'cloud')
                                    }
                                    placeholder="GPT-4o"
                                    sx={{ flex: 1 }}
                                  />
                                  <MuiIconButton
                                    size="small"
                                    onClick={() => handleRemoveModel(provider.id, model.id, 'cloud')}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </MuiIconButton>
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
                <StorageIcon fontSize="small" color="secondary" />
                <Typography variant="subtitle2">本地模型</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<StorageIcon />}
                  onClick={() => handleAddLocalProvider('server')}
                >
                  端口服务
                </Button>
                {appleDevice && (
                  <Button
                    size="small"
                    startIcon={<AppleIcon />}
                    onClick={() => handleAddLocalProvider('mlx')}
                  >
                    MLX
                  </Button>
                )}
              </Box>
            </Box>

            {!appleDevice && (
              <Alert severity="info" sx={{ mb: 2 }}>
                MLX 模型仅支持 macOS、iPadOS 和 iOS 设备
              </Alert>
            )}

            {localSettings.localProviders.length === 0 ? (
              <Box sx={{ py: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  暂无本地服务配置
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {localSettings.localProviders.map((provider) => (
                  <Accordion key={provider.id} defaultExpanded={false}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 2 }}>
                        {getLocalProviderIcon(provider.type)}
                        <Typography variant="subtitle2" sx={{ flex: 1 }}>
                          {provider.name || '未命名服务'}
                        </Typography>
                        <Chip
                          label={provider.type === 'mlx' ? 'MLX' : '端口服务'}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Chip
                          label={`${provider.models.length} 个模型`}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <MuiIconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveLocalProvider(provider.id);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </MuiIconButton>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        <TextField
                          fullWidth
                          label="服务名称"
                          value={provider.name}
                          onChange={(e) =>
                            handleUpdateLocalProvider(provider.id, { name: e.target.value })
                          }
                          size="small"
                        />

                        {/* Type selector */}
                        <FormControl size="small">
                          <FormLabel>服务类型</FormLabel>
                          <Select
                            value={provider.type}
                            onChange={(e) =>
                              handleUpdateLocalProvider(provider.id, {
                                type: e.target.value as LocalProviderType,
                                endpoint: e.target.value === 'mlx' ? '' : 'http://localhost:11434',
                              })
                            }
                            disabled={!appleDevice && provider.type === 'mlx'}
                          >
                            <MenuItem value="server">端口服务 (Ollama等)</MenuItem>
                            <MenuItem value="mlx" disabled={!appleDevice}>MLX (Apple Silicon)</MenuItem>
                          </Select>
                        </FormControl>

                        {/* Endpoint - only for server type */}
                        {provider.type === 'server' && (
                          <TextField
                            fullWidth
                            label="服务地址"
                            value={provider.endpoint}
                            onChange={(e) =>
                              handleUpdateLocalProvider(provider.id, { endpoint: e.target.value })
                            }
                            placeholder="http://localhost:11434"
                            size="small"
                          />
                        )}

                        {provider.type === 'mlx' && (
                          <Alert severity="info">
                            MLX 模型使用 Apple Silicon 的 GPU 加速，无需配置服务地址
                          </Alert>
                        )}

                        {provider.type === 'server' && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleTestConnection(provider.id, 'local')}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            测试连接
                          </Button>
                        )}
                        {testResults[`local-${provider.id}`] && (
                          <Alert
                            severity={testResults[`local-${provider.id}`].success ? 'success' : 'error'}
                          >
                            {testResults[`local-${provider.id}`].message}
                          </Alert>
                        )}

                        <Divider />

                        {/* Models */}
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="subtitle2">模型列表</Typography>
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => handleAddModel(provider.id, 'local')}
                            >
                              添加模型
                            </Button>
                          </Box>

                          {provider.models.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              暂无模型配置
                            </Typography>
                          ) : (
                            <Stack spacing={1}>
                              {provider.models.map((model) => (
                                <Box
                                  key={model.id}
                                  sx={{
                                    display: 'flex',
                                    gap: 1,
                                    alignItems: 'center',
                                    p: 1,
                                    bgcolor: 'action.hover',
                                    borderRadius: 1,
                                  }}
                                >
                                  <TextField
                                    size="small"
                                    label="模型名称"
                                    value={model.modelName}
                                    onChange={(e) =>
                                      handleUpdateModel(provider.id, model.id, { modelName: e.target.value }, 'local')
                                    }
                                    placeholder={provider.type === 'mlx' ? 'mlx-community/Llama-3.2-3B-Instruct-4bit' : 'llama3'}
                                    sx={{ flex: 1 }}
                                  />
                                  <TextField
                                    size="small"
                                    label="显示名称"
                                    value={model.displayName}
                                    onChange={(e) =>
                                      handleUpdateModel(provider.id, model.id, { displayName: e.target.value }, 'local')
                                    }
                                    placeholder="Llama 3"
                                    sx={{ flex: 1 }}
                                  />
                                  <MuiIconButton
                                    size="small"
                                    onClick={() => handleRemoveModel(provider.id, model.id, 'local')}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </MuiIconButton>
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
        </Paper>
      </Container>

      {/* Category Select Dialog */}
      <CategorySelectDialog
        open={categoryDialogOpen}
        selectedCategories={localSettings.crawlerCategories}
        onClose={() => setCategoryDialogOpen(false)}
        onSave={handleCategoriesChange}
      />
    </Box>
  );
};

export default SettingsPage;