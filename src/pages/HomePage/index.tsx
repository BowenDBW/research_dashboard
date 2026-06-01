import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Stack,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Skeleton,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  SelectChangeEvent,
  Button,
  Chip,
} from '@mui/material';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  Send as SendIcon,
  Chat as ChatIcon,
  Search as SearchIcon,
  Summarize as SummarizeIcon,
  SmartToy as SmartToyIcon,
  Person as PersonIcon,
  Cloud as CloudIcon,
  Dns as DnsIcon,
  Apple as AppleIcon,
  Settings as SettingsIcon,
  AutoAwesome as AutoAwesomeIcon,
  MenuBook as MenuBookIcon,
  Lightbulb as LightbulbIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../stores';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Article, ChatMode } from '../../types';

interface OutletContext {
  openSettings: () => void;
}

// 示例文章列表
const ARTICLE_OPTIONS: Article[] = [
  {
    id: '1',
    title: 'Attention Is All You Need',
    authors: ['Vaswani et al.'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2017',
    abstract: '',
    url: '',
    pdfUrl: '',
    domains: ['cs.LG'],
    isFavorited: false,
    metadata: {},
  },
  {
    id: '2',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    authors: ['Devlin et al.'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2018',
    abstract: '',
    url: '',
    pdfUrl: '',
    domains: ['cs.CL'],
    isFavorited: false,
    metadata: {},
  },
  {
    id: '3',
    title: 'GPT-4 Technical Report',
    authors: ['OpenAI'],
    source: 'arXiv',
    sourceType: 'arxiv',
    publishDate: '2023',
    abstract: '',
    url: '',
    pdfUrl: '',
    domains: ['cs.AI'],
    isFavorited: false,
    metadata: {},
  },
];

interface ModelOption {
  id: string;
  displayName: string;
  providerName: string;
  type: 'cloud' | 'local';
  localType?: 'server' | 'mlx';  // Only for local models
}

const modeToTab: Record<ChatMode, number> = {
  chat: 0,
  paper_search: 1,
  chapter_summary: 2,
};

const tabToMode: Record<number, ChatMode> = {
  0: 'chat',
  1: 'paper_search',
  2: 'chapter_summary',
};

const HomePage = () => {
  const { openSettings } = useOutletContext<OutletContext>();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get('sessionId');

  const [activeTab, setActiveTab] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [searchStartDate, setSearchStartDate] = useState<dayjs.Dayjs | null>(null);
  const [searchEndDate, setSearchEndDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const { getCurrentMessages, addMessage, sendMessage, currentSessionId, sessions, createSession, switchSession } = useChat();
  const { settings, updateSettings } = useSettingsStore();
  const messages = getCurrentMessages();

  // Build model options from settings
  const modelOptions = useMemo<ModelOption[]>(() => {
    const options: ModelOption[] = [];
    settings.cloudProviders.forEach((provider) => {
      provider.models.forEach((model) => {
        options.push({
          id: model.id,
          displayName: model.displayName || model.modelName,
          providerName: provider.name,
          type: 'cloud',
        });
      });
    });
    settings.localProviders.forEach((provider) => {
      provider.models.forEach((model) => {
        options.push({
          id: model.id,
          displayName: model.displayName || model.modelName,
          providerName: provider.name,
          type: 'local',
          localType: provider.type,
        });
      });
    });
    return options;
  }, [settings.cloudProviders, settings.localProviders]);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Initialize: create new session on home page load
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;

      if (sessionIdFromUrl) {
        // Switch to the session from URL if it exists
        const sessionExists = sessions.find(s => s.id === sessionIdFromUrl);
        if (sessionExists) {
          switchSession(sessionIdFromUrl);
          return;
        }
      }
      // Always create a new empty chat session when entering home page
      createSession('chat');
    }
  }, [sessionIdFromUrl, sessions, createSession, switchSession]);

  // Update tab when session changes
  useEffect(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      setActiveTab(modeToTab[session.mode]);
      // Update selected article for chapter_summary mode
      if (session.mode === 'chapter_summary' && session.articleId) {
        const article = ARTICLE_OPTIONS.find(a => a.id === session.articleId);
        if (article) {
          setSelectedArticle(article);
        }
      }
    }
  }, [currentSessionId, sessions]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    const newMode = tabToMode[newValue];
    const currentSession = sessions.find(s => s.id === currentSessionId);

    // If current session has messages or different mode, create new session
    if (currentSession && (messages.length > 0 || currentSession.mode !== newMode)) {
      // For chapter_summary mode, pass article info if available
      if (newMode === 'chapter_summary' && selectedArticle) {
        createSession(newMode, { articleId: selectedArticle.id, articleTitle: selectedArticle.title });
      } else {
        createSession(newMode);
      }
    } else if (currentSession && currentSession.mode === newMode) {
      // Same mode, just update tab
      setActiveTab(newValue);
    } else {
      // No current session, create new one
      if (newMode === 'chapter_summary' && selectedArticle) {
        createSession(newMode, { articleId: selectedArticle.id, articleTitle: selectedArticle.title });
      } else {
        createSession(newMode);
      }
    }
    setActiveTab(newValue);
  };

  const handleModelChange = (event: SelectChangeEvent) => {
    updateSettings({ selectedModelId: event.target.value });
  };

  const handleResetArticle = () => {
    setSelectedArticle(null);
    // Create a new empty chapter_summary session
    createSession('chapter_summary');
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !currentSessionId) return;

    // Check if model is selected
    if (!settings.selectedModelId) {
      console.warn('No model selected');
      return;
    }

    const userContent = inputValue.trim();
    setInputValue('');
    setIsStreaming(true);

    try {
      // Send message to backend (backend saves user and assistant messages)
      // Then refresh messages list
      await sendMessage(currentSessionId, userContent, settings.selectedModelId);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      // Add error message locally
      addMessage(currentSessionId, {
        id: `msg-error-${Date.now()}`,
        sessionId: currentSessionId,
        role: 'assistant',
        content: `抱歉，发生了错误: ${error}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // Empty state content for each mode
  const EmptyStateContent = ({ mode }: { mode: ChatMode }) => {
    if (mode === 'chat') {
      return (
        <Box sx={{ textAlign: 'center', py: 6, px: 4 }}>
          <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 3, bgcolor: 'primary.light' }}>
            <ChatIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            {t('homePage.aiChat.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
            {t('homePage.aiChat.description')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip icon={<LightbulbIcon />} label={t('homePage.aiChat.chips.conceptExplain')} variant="outlined" size="small" />
            <Chip icon={<AutoAwesomeIcon />} label={t('homePage.aiChat.chips.researchInspiration')} variant="outlined" size="small" />
            <Chip icon={<MenuBookIcon />} label={t('homePage.aiChat.chips.academicDiscussion')} variant="outlined" size="small" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            {t('homePage.aiChat.tryAsk')}<i>"{t('homePage.tryExamples.transformer')}"</i>
          </Typography>
        </Box>
      );
    } else if (mode === 'paper_search') {
      return (
        <Box sx={{ textAlign: 'center', py: 6, px: 4 }}>
          <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 3, bgcolor: 'secondary.light' }}>
            <SearchIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'secondary.main' }}>
            {t('homePage.aiSearch.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
            {t('homePage.aiSearch.description')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip label="arXiv" size="small" color="primary" variant="outlined" />
            <Chip label="Semantic Scholar" size="small" color="primary" variant="outlined" />
            <Chip label="IEEE" size="small" color="primary" variant="outlined" />
            <Chip label="Springer" size="small" color="primary" variant="outlined" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            {t('homePage.aiSearch.trySearch')}<i>"{t('homePage.tryExamples.llmReasoning')}"</i>
          </Typography>
        </Box>
      );
    } else {
      return (
        <Box sx={{ textAlign: 'center', py: 6, px: 4 }}>
          <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 3, bgcolor: 'warning.light' }}>
            <SummarizeIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'warning.dark' }}>
            {t('homePage.chapterSummary.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
            {t('homePage.chapterSummary.description')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip icon={<MenuBookIcon />} label={t('homePage.chapterSummary.chips.abstractExtract')} variant="outlined" size="small" />
            <Chip icon={<AutoAwesomeIcon />} label={t('homePage.chapterSummary.chips.keyPoints')} variant="outlined" size="small" />
            <Chip icon={<LightbulbIcon />} label={t('homePage.chapterSummary.chips.keyFindings')} variant="outlined" size="small" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            {t('homePage.chapterSummary.selectHint')}
          </Typography>
        </Box>
      );
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Tabs with Model Selector */}
        <Paper sx={{ flexShrink: 0 }} square>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons={false}
              sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0.5, px: 2, minWidth: 'auto' } }}
            >
              <Tab icon={<ChatIcon />} label={t('chat.aiChat')} iconPosition="start" />
              <Tab icon={<SearchIcon />} label={t('chat.aiSearchRecommend')} iconPosition="start" />
              <Tab icon={<SummarizeIcon />} label={t('chat.chapterSummary')} iconPosition="start" />
            </Tabs>

            {/* Model Selector */}
            <FormControl size="small" sx={{ minWidth: 220, mr: 1 }}>
              {modelOptions.length > 0 ? (
                <Select
                  value={settings.selectedModelId || ''}
                  onChange={handleModelChange}
                  displayEmpty
                  renderValue={(value) => {
                    if (!value) return <Typography variant="body2" color="text.secondary">{t('homePage.selectModel')}</Typography>;
                    const model = modelOptions.find(m => m.id === value);
                    if (!model) return <Typography variant="body2">{t('homePage.selectModel')}</Typography>;
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {model.type === 'cloud' ? (
                          <CloudIcon sx={{ fontSize: 16 }} color="primary" />
                        ) : model.localType === 'mlx' ? (
                          <AppleIcon sx={{ fontSize: 16, color: '#A3AAAE' }} />
                        ) : (
                          <DnsIcon sx={{ fontSize: 16 }} color="secondary" />
                        )}
                        <Typography variant="body2" noWrap>{model.displayName}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>
                          {model.providerName}
                        </Typography>
                      </Box>
                    );
                  }}
                  sx={{ height: 32 }}
                >
                  {modelOptions.map((model) => (
                    <MenuItem key={model.id} value={model.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {model.type === 'cloud' ? (
                          <CloudIcon sx={{ fontSize: 18 }} color="primary" />
                        ) : model.localType === 'mlx' ? (
                          <AppleIcon sx={{ fontSize: 18, color: '#A3AAAE' }} />
                        ) : (
                          <DnsIcon sx={{ fontSize: 18 }} color="secondary" />
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                          <Typography variant="body2">{model.displayName}</Typography>
                          <Typography variant="caption" color="text.disabled">
                            {model.providerName}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={openSettings}
                  sx={{ height: 32, whiteSpace: 'nowrap' }}
                >
                  {t('homePage.configureModel')}
                </Button>
              )}
            </FormControl>
          </Box>
        </Paper>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 2 }}>
          {/* AI搜索推荐: Date Range */}
          {activeTab === 1 && (
            <Box sx={{ mb: 2, display: 'flex', gap: 2, flexShrink: 0 }}>
              <MuiDatePicker
                label={t('articles.startDate')}
                value={searchStartDate}
                onChange={(newValue) => setSearchStartDate(newValue)}
                slotProps={{ textField: { size: 'small' } }}
              />
              <MuiDatePicker
                label={t('articles.endDate')}
                value={searchEndDate}
                onChange={(newValue) => setSearchEndDate(newValue)}
                slotProps={{ textField: { size: 'small' } }}
              />
            </Box>
          )}

          {/* Chapter Summary: Article Selection */}
          {activeTab === 2 && (
            <Box sx={{ mb: 2, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              {selectedArticle ? (
                <Paper sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('homePage.currentArticle')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {selectedArticle.title}
                  </Typography>
                  <Chip
                    label={selectedArticle.id}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                  <IconButton size="small" onClick={handleResetArticle} title={t('common.close')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Paper>
              ) : (
                <Autocomplete
                  options={ARTICLE_OPTIONS}
                  getOptionLabel={(option) => option.title}
                  value={selectedArticle}
                  onChange={(_, newValue) => setSelectedArticle(newValue)}
                  sx={{ width: 400, maxWidth: '50%' }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('homePage.selectArticle')}
                      placeholder={t('homePage.articlePlaceholder')}
                      size="small"
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...otherProps } = props as any;
                    return (
                      <li key={key} {...otherProps}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {option.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.authors.join(', ')} · {option.source} · {option.publishDate}
                          </Typography>
                        </Box>
                      </li>
                    );
                  }}
                />
              )}
            </Box>
          )}

          {/* Messages Area - scrollable, fills remaining space */}
          <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
            <Stack spacing={2}>
              {messages.length === 0 ? (
                <EmptyStateContent mode={tabToMode[activeTab]} />
              ) : (
                messages.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      gap: 1,
                    }}
                  >
                    {msg.role === 'assistant' && (
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <SmartToyIcon />
                      </Avatar>
                    )}
                    <Paper
                      sx={{
                        p: 2,
                        maxWidth: '70%',
                        bgcolor: msg.role === 'user' ? 'primary.light' : 'background.default',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <Typography variant="body1">{msg.content}</Typography>
                    </Paper>
                    {msg.role === 'user' && (
                      <Avatar sx={{ bgcolor: 'secondary.main' }}>
                        <PersonIcon />
                      </Avatar>
                    )}
                  </Box>
                ))
              )}
              {isStreaming && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <SmartToyIcon />
                  </Avatar>
                  <Paper sx={{ p: 2 }}>
                    <Skeleton width={200} />
                  </Paper>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Stack>
          </Box>

          {/* Input Area - fixed at bottom, narrower */}
          <Paper sx={{ p: 1.5, flexShrink: 0, maxWidth: 800, mx: 'auto', width: '100%' }} elevation={3}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                multiline
                maxRows={4}
                fullWidth
                size="small"
                placeholder={
                  activeTab === 0
                    ? t('homePage.inputPlaceholder.chat')
                    : activeTab === 1
                    ? t('homePage.inputPlaceholder.search')
                    : t('homePage.inputPlaceholder.summary')
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming}
                sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Paper>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default HomePage;