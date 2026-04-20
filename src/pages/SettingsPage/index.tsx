import { useState } from 'react';
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
  Checkbox,
  Slider,
  TextField,
  Button,
  Switch,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Collapse,
  Alert,
  Snackbar,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { useSettingsStore } from '../../stores/useSettingsStore';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, testConnection } = useSettingsStore();

  const [localSettings, setLocalSettings] = useState(settings);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const crawlerSourceOptions = ['arxiv', 'semantic_scholar', 'ieee', 'springer'];

  const handleSourceChange = (source: string) => {
    const sources = localSettings.crawlerSources.includes(source)
      ? localSettings.crawlerSources.filter((s) => s !== source)
      : [...localSettings.crawlerSources, source];
    setLocalSettings({ ...localSettings, crawlerSources: sources });
  };

  const handleSave = async () => {
    await updateSettings(localSettings);
    setSnackbarOpen(true);
  };

  const handleTestConnection = async () => {
    const result = await testConnection();
    setTestResult(result);
  };

  const handleBrowsePath = () => {
    // Mock file dialog for prototype
    setLocalSettings({
      ...localSettings,
      databasePath: '/Users/example/database',
    });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'background.paper' }}>
        <Toolbar>
          <IconButton onClick={() => navigate('/')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2 }}>
            设置
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Container maxWidth="md" sx={{ py: 3, overflow: 'auto' }}>
        {/* Crawler Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>爬虫设置</Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>爬取来源</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {crawlerSourceOptions.map((source) => (
                <FormControlLabel
                  key={source}
                  control={
                    <Checkbox
                      checked={localSettings.crawlerSources.includes(source)}
                      onChange={() => handleSourceChange(source)}
                    />
                  }
                  label={source.toUpperCase()}
                />
              ))}
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
            <Typography variant="subtitle2" gutterBottom>数据库路径</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                value={localSettings.databasePath}
                InputProps={{ readOnly: true }}
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

          <FormControl>
            <FormLabel>模型类型</FormLabel>
            <RadioGroup
              value={localSettings.llmType}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, llmType: e.target.value as 'cloud' | 'local' })
              }
              row
            >
              <FormControlLabel value="cloud" control={<Radio />} label="云端模型" />
              <FormControlLabel value="local" control={<Radio />} label="本地模型" />
            </RadioGroup>
          </FormControl>

          <Divider sx={{ my: 2 }} />

          {/* Cloud LLM Settings */}
          <Collapse in={localSettings.llmType === 'cloud'}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>云端模型配置</Typography>
              <TextField
                fullWidth
                label="API Endpoint"
                value={localSettings.cloudLlm.endpoint}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    cloudLlm: { ...localSettings.cloudLlm, endpoint: e.target.value },
                  })
                }
                sx={{ mb: 2 }}
                size="small"
              />
              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={localSettings.cloudLlm.apiKey}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    cloudLlm: { ...localSettings.cloudLlm, apiKey: e.target.value },
                  })
                }
                sx={{ mb: 2 }}
                size="small"
              />
              <Button variant="outlined" onClick={handleTestConnection}>
                测试连接
              </Button>
              {testResult && (
                <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                  {testResult.message}
                </Alert>
              )}
            </Box>
          </Collapse>

          {/* Local LLM Settings */}
          <Collapse in={localSettings.llmType === 'local'}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>本地模型配置</Typography>
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>来源</FormLabel>
                <RadioGroup
                  value={localSettings.localLlm.type}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      localLlm: {
                        ...localSettings.localLlm,
                        type: e.target.value as 'huggingface' | 'path',
                      },
                    })
                  }
                  row
                >
                  <FormControlLabel value="huggingface" control={<Radio />} label="HuggingFace" />
                  <FormControlLabel value="path" control={<Radio />} label="指定路径" />
                </RadioGroup>
              </FormControl>

              {localSettings.localLlm.type === 'huggingface' ? (
                <TextField
                  fullWidth
                  label="HF 模型名"
                  value={localSettings.localLlm.modelName}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      localLlm: {
                        ...localSettings.localLlm,
                        modelName: e.target.value,
                      },
                    })
                  }
                  placeholder="例如: meta-llama/Llama-2-7b-chat-hf"
                  size="small"
                />
              ) : (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    label="本地模型路径"
                    value={localSettings.localLlm.modelPath}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        localLlm: {
                          ...localSettings.localLlm,
                          modelPath: e.target.value,
                        },
                      })
                    }
                    size="small"
                  />
                  <Button variant="outlined" startIcon={<FolderOpenIcon />}>
                    浏览
                  </Button>
                </Box>
              )}
            </Box>
          </Collapse>
        </Paper>

        {/* Save Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="contained" size="large" onClick={handleSave}>
            保存设置
          </Button>
        </Box>
      </Container>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message="设置已保存"
      />
    </Box>
  );
};

export default SettingsPage;