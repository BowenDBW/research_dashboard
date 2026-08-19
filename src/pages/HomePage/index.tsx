import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
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
  Select,
  MenuItem,
  FormControl,
  SelectChangeEvent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Chat as ChatIcon,
  Search as SearchIcon,
  SmartToy as SmartToyIcon,
  Person as PersonIcon,
  Cloud as CloudIcon,
  Dns as DnsIcon,
  Apple as AppleIcon,
  Settings as SettingsIcon,
  AutoAwesome as AutoAwesomeIcon,
  MenuBook as MenuBookIcon,
  Lightbulb as LightbulbIcon,
  AttachFile as AttachFileIcon,
  Description as DescriptionIcon,
  Article as ArticleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../stores';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { AbstractDialog } from '../../components/article/AbstractDialog';
import { Article, ChatMode } from '../../types';

interface OutletContext {
  openSettings: () => void;
}

interface AttachedPdfInfo {
  fileName: string;
  charCount: number;
  preview: string;
}

interface ModelOption {
  id: string;
  displayName: string;
  providerName: string;
  type: 'cloud' | 'local';
  localType?: 'server' | 'mlx';  // Only for local models
}

const modeToTab: Partial<Record<ChatMode, number>> = {
  chat: 0,
  paper_search: 1,
  chapter_summary: 0, // 兼容旧会话：章节总结视作普通对话
};

const tabToMode: Record<number, ChatMode> = {
  0: 'chat',
  1: 'paper_search',
};

const HomePage = () => {
  const { openSettings } = useOutletContext<OutletContext>();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get('sessionId');

  const [activeTab, setActiveTab] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [attachedPdf, setAttachedPdf] = useState<AttachedPdfInfo | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  // 从库内文章选择附件
  const [arxivPickerOpen, setArxivPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<Article[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  // 检索结果文章弹窗（阅读/收藏等）
  const [dialogArticle, setDialogArticle] = useState<Article | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // Initialize: 仅在没有任何会话时才创建新会话。
  // 之前"每次进入首页都 createSession"会在每次导航回首页时新建空会话，
  // 导致 chat_sessions 堆积大量 0 消息的空壳，污染统计与历史记录。
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
      // 已有会话（例如从其他页面返回）则复用，不再新建空会话
      if (!currentSessionId) {
        createSession('chat');
      }
    }
  }, [sessionIdFromUrl, sessions, currentSessionId, createSession, switchSession]);

  // Update tab when session changes
  useEffect(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      setActiveTab(modeToTab[session.mode] ?? 0);
      // 切换会话时重置附件指示（上下文仍存于后端 session）
      setAttachedPdf(null);
    }
  }, [currentSessionId, sessions]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    const newMode = tabToMode[newValue];
    const currentSession = sessions.find(s => s.id === currentSessionId);

    // 目标模式已存在的空会话（无消息）→ 直接复用，避免来回切标签时堆积空会话
    const emptySessionOfMode = sessions.find(
      s => s.mode === newMode && !s.messageCount
    );

    if (currentSession && currentSession.mode === newMode) {
      // Same mode, just update tab
      setActiveTab(newValue);
    } else if (emptySessionOfMode) {
      // Reuse an existing empty session of the target mode
      switchSession(emptySessionOfMode.id);
      setActiveTab(newValue);
    } else {
      // 目标模式没有可复用的空会话，才新建
      createSession(newMode);
      setActiveTab(newValue);
    }
    setAttachedPdf(null);
  };

  const handleModelChange = (event: SelectChangeEvent) => {
    updateSettings({ selectedModelId: event.target.value });
  };

  // 上传并解析文章 PDF 作为对话上下文
  const handleAttachPdf = async () => {
    if (!currentSessionId) return;
    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!selected) return;
      const res = await invoke<{ charCount: number; preview: string }>('chat_attach_pdf', {
        sessionId: parseInt(currentSessionId),
        filePath: selected,
      });
      const fileName = (selected as string).split(/[\\/]/).pop() || 'article.pdf';
      setAttachedPdf({ fileName, charCount: res.charCount, preview: res.preview });
    } catch (error) {
      console.error('PDF 解析失败:', error);
    }
  };

  // 移除附件（同时清空后端会话上下文）
  const handleRemovePdf = async () => {
    setAttachedPdf(null);
    if (currentSessionId) {
      try {
        await invoke('chat_clear_context', { sessionId: parseInt(currentSessionId) });
      } catch (error) {
        console.error('清空上下文失败:', error);
      }
    }
  };

  // 打开检索结果文章摘要弹窗
  const handleOpenArticle = (article: Article) => {
    setDialogArticle(article);
    setDialogOpen(true);
  };

  // 从库内文章选择附件：搜索
  const handlePickerSearch = async () => {
    if (!pickerQuery.trim()) return;
    setPickerLoading(true);
    try {
      const resp = await invoke<{ articles: Article[] }>('papers_list', {
        page: 1,
        pageSize: 20,
        query: pickerQuery.trim(),
        startDate: null,
        endDate: null,
        sources: null,
        domains: null,
        subscribedOnly: false,
      });
      setPickerResults(resp.articles || []);
    } catch (error) {
      console.error('搜索文章失败:', error);
      setPickerResults([]);
    } finally {
      setPickerLoading(false);
    }
  };

  // 选中库内文章：下载其 arXiv PDF 解析为对话上下文（后端解析后删除临时文件）
  const handlePickArticle = async (article: Article) => {
    setArxivPickerOpen(false);
    if (!currentSessionId) return;
    try {
      const res = await invoke<{ charCount: number; preview: string }>('chat_attach_arxiv', {
        sessionId: parseInt(currentSessionId),
        articleId: parseInt(article.id),
      });
      setAttachedPdf({
        fileName: `${article.preprintNumber || 'article'}.pdf`,
        charCount: res.charCount,
        preview: res.preview,
      });
    } catch (error) {
      console.error('附件解析失败:', error);
    }
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
    }
  };

  return (
    <>
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
          {/* 对话模式：上传文章附件（可选） */}
          {activeTab === 0 && (
            <Box sx={{ mb: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
              {attachedPdf ? (
                <Paper sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DescriptionIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {attachedPdf.fileName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('homePage.pdfAttached', { count: attachedPdf.charCount })}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={handleRemovePdf} title={t('common.close')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Paper>
              ) : (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AttachFileIcon />}
                    onClick={handleAttachPdf}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('homePage.attachPdf')}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ArticleIcon />}
                    onClick={() => setArxivPickerOpen(true)}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('homePage.attachFromLibrary')}
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Messages Area - scrollable, fills remaining space */}
          <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
            <Stack spacing={2}>
              {messages.length === 0 ? (
                <EmptyStateContent mode={tabToMode[activeTab]} />
              ) : (
                messages.map((msg) => {
                  const hasArticles = msg.role === 'assistant' && !!msg.articles && msg.articles.length > 0;
                  return (
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
                      <Box sx={{ maxWidth: '70%', minWidth: 0 }}>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: msg.role === 'user' ? 'primary.light' : 'background.default',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          <Typography variant="body1">{msg.content}</Typography>
                        </Paper>
                        {hasArticles && (
                          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                            {msg.articles!.map((article) => (
                              <Paper
                                key={article.id}
                                sx={{
                                  p: 1.5,
                                  cursor: 'pointer',
                                  '&:hover': { boxShadow: 2 },
                                }}
                                onClick={() => handleOpenArticle(article)}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <ArticleIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                                  <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                                    {article.title}
                                  </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.5 }}>
                                  {article.authors.join(', ')} · {article.source} · {article.publishDate}
                                </Typography>
                              </Paper>
                            ))}
                          </Box>
                        )}
                      </Box>
                      {msg.role === 'user' && (
                        <Avatar sx={{ bgcolor: 'secondary.main' }}>
                          <PersonIcon />
                        </Avatar>
                      )}
                    </Box>
                  );
                })
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
                    : t('homePage.inputPlaceholder.search')
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

      {/* 检索结果文章摘要弹窗（阅读/收藏/打开来源等） */}
      <AbstractDialog
        open={dialogOpen}
        article={dialogArticle}
        onClose={() => setDialogOpen(false)}
      />

      {/* 从库内文章选择附件 */}
      <Dialog open={arxivPickerOpen} onClose={() => setArxivPickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('homePage.attachFromLibrary')}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              autoFocus
              placeholder={t('homePage.articlePlaceholder')}
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePickerSearch();
              }}
            />
            <Button size="small" variant="contained" onClick={handlePickerSearch} disabled={!pickerQuery.trim()}>
              {t('common.search')}
            </Button>
          </Box>
          {pickerLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : pickerResults.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              {t('homePage.noSearchResult')}
            </Typography>
          ) : (
            pickerResults.map((a) => (
              <Paper
                key={a.id}
                sx={{ p: 1.5, mb: 1, cursor: 'pointer', '&:hover': { boxShadow: 2 } }}
                onClick={() => handlePickArticle(a)}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {a.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                  {a.authors.join(', ')} · {a.preprintNumber || a.source}
                </Typography>
              </Paper>
            ))
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HomePage;