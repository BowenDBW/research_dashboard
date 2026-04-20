import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  AppBar,
  Toolbar,
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
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useChatStore } from '../../stores/useChatStore';
import { Article } from '../../types';

const HomePage = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const articleIdFromUrl = searchParams.get('articleId');

  const [activeTab, setActiveTab] = useState(tabFromUrl === 'summary' ? 2 : tabFromUrl === 'search' ? 1 : 0);
  const [inputValue, setInputValue] = useState('');
  const [searchStartDate, setSearchStartDate] = useState<dayjs.Dayjs | null>(null);
  const [searchEndDate, setSearchEndDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { getCurrentMessages, addMessage, currentSessionId, sessions, currentSessionId: activeSessionId } = useChatStore();
  const messages = getCurrentMessages();

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Update tab when session changes
  useEffect(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      if (session.mode === 'chat') {
        setActiveTab(0);
      } else if (session.mode === 'paper_search') {
        setActiveTab(1);
      } else if (session.mode === 'chapter_summary') {
        setActiveTab(2);
      }
    }
  }, [currentSessionId, sessions]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSend = () => {
    if (!inputValue.trim() || !currentSessionId) return;

    // Add user message
    addMessage(currentSessionId, {
      id: `msg-${Date.now()}`,
      sessionId: currentSessionId,
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    });

    setInputValue('');
    setIsStreaming(true);

    // Mock AI response for prototype
    setTimeout(() => {
      addMessage(currentSessionId, {
        id: `msg-${Date.now() + 1}`,
        sessionId: currentSessionId,
        role: 'assistant',
        content: getMockResponse(inputValue, activeTab),
        timestamp: new Date().toISOString(),
      });
      setIsStreaming(false);
    }, 1000);
  };

  const getMockResponse = (input: string, tab: number) => {
    if (tab === 0) {
      return `关于"${input}"的问题，这是一个很好的话题。让我为您详细解释一下...\n\n主要要点包括：\n1. 核心概念的理解\n2. 相关应用场景\n3. 未来发展趋势`;
    } else if (tab === 1) {
      return `根据您的搜索条件"${input}"，我找到了以下相关论文：\n\n1. Attention Is All You Need (2017)\n2. BERT: Pre-training of Deep Bidirectional Transformers (2018)\n3. GPT-3: Language Models are Few-Shot Learners (2020)`;
    } else {
      return `正在对文章进行逐章总结...\n\n## 第一章：简介\n本文介绍了一个新的深度学习模型架构...\n\n## 第二章：方法论\n采用自注意力机制作为核心计算单元...`;
    }
  };

  const currentSession = sessions.find(s => s.id === activeSessionId);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Bar */}
        <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'background.paper', flexShrink: 0 }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Research Dashboard
            </Typography>
            <Chip label={`模式: ${currentSession?.mode || 'chat'}`} size="small" />
          </Toolbar>
        </AppBar>

        {/* Tabs */}
        <Paper sx={{ flexShrink: 0 }} square>
          <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
            <Tab icon={<ChatIcon />} label="AI 对话" iconPosition="start" />
            <Tab icon={<SearchIcon />} label="文章检索" iconPosition="start" />
            <Tab icon={<SummarizeIcon />} label="文章总结" iconPosition="start" />
          </Tabs>
        </Paper>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 2 }}>
          {/* 文章检索: Date Range */}
          {activeTab === 1 && (
            <Box sx={{ mb: 2, display: 'flex', gap: 2, flexShrink: 0 }}>
              <MuiDatePicker
                label="开始日期"
                value={searchStartDate}
                onChange={(newValue) => setSearchStartDate(newValue)}
                slotProps={{ textField: { size: 'small' } }}
              />
              <MuiDatePicker
                label="结束日期"
                value={searchEndDate}
                onChange={(newValue) => setSearchEndDate(newValue)}
                slotProps={{ textField: { size: 'small' } }}
              />
            </Box>
          )}

          {/* Chapter Summary: Article Selection */}
          {activeTab === 2 && !articleIdFromUrl && (
            <Box sx={{ mb: 2, flexShrink: 0 }}>
              <TextField
                fullWidth
                label="选择文章标题"
                placeholder="输入文章标题部分..."
                value={selectedArticle?.title || ''}
                onChange={(e) => {
                  if (e.target.value.includes('Attention')) {
                    setSelectedArticle({
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
                    });
                  }
                }}
              />
            </Box>
          )}

          {/* Messages Area - scrollable, fills remaining space */}
          <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
            <Stack spacing={2}>
              {messages.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    {activeTab === 0
                      ? '开始一个新的对话...'
                      : activeTab === 1
                      ? '输入搜索条件查找论文...'
                      : '选择文章开始逐章总结...'}
                  </Typography>
                </Box>
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

          {/* Input Area - fixed at bottom */}
          <Paper sx={{ p: 2, flexShrink: 0 }} elevation={3}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                multiline
                maxRows={4}
                fullWidth
                placeholder={
                  activeTab === 0
                    ? '输入您的问题...'
                    : activeTab === 1
                    ? '描述您想要查找的论文...'
                    : '添加额外的总结要求...'
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