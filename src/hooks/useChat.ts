import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChatSession, ChatMessage, ChatMode } from '../types';

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({} as Record<string, ChatMessage[]>);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const fetchSessions = useCallback(async (mode?: ChatMode, limit?: number) => {
    try {
      const response = await invoke<ChatSession[]>('chat_get_sessions', {
        mode: mode || null,
        limit: limit || 20,
      });
      console.log('[DEBUG] fetchSessions response:', response);

      // Fetch messages for each session that might have messages
      const messagesData: Record<string, ChatMessage[]> = {};
      await Promise.all(
        response.map(async (session) => {
          try {
            const msgs = await invoke<ChatMessage[]>('chat_get_messages', {
              sessionId: parseInt(session.id),
            });
            console.log(`[DEBUG] Session ${session.id} messages:`, msgs);
            if (msgs.length > 0) {
              messagesData[session.id] = msgs;
            }
          } catch (e) {
            console.error(`Failed to fetch messages for session ${session.id}:`, e);
          }
        })
      );
      console.log('[DEBUG] messagesData:', messagesData);

      // Update both sessions and messages at the same time to avoid race condition
      setSessions(response);
      setMessages(messagesData);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
    }
  }, []);

  const createSession = useCallback(async (mode: ChatMode = 'chat', articleInfo?: { articleId: string; articleTitle: string }) => {
    try {
      const response = await invoke<ChatSession>('chat_create_session', {
        mode,
        articleId: articleInfo ? parseInt(articleInfo.articleId) : null,
        title: articleInfo ? `总结: ${articleInfo.articleTitle}` : null,
      });
      setSessions((prev: ChatSession[]) => [response, ...prev]);
      setCurrentSessionId(response.id);
      setMessages((prev: Record<string, ChatMessage[]>) => ({ ...prev, [response.id]: [] }));
      return response.id;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }, []);

  const switchSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessagesLoading(true);
    try {
      const response = await invoke<ChatMessage[]>('chat_get_messages', {
        sessionId: parseInt(sessionId),
      });
      setMessages((prev: Record<string, ChatMessage[]>) => ({ ...prev, [sessionId]: response }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages((prev: Record<string, ChatMessage[]>) => ({ ...prev, [sessionId]: [] }));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await invoke('chat_delete_session', { sessionId: parseInt(sessionId) });
      setSessions((prev: ChatSession[]) => prev.filter(s => s.id !== sessionId));
      setMessages((prev: Record<string, ChatMessage[]>) => {
        const newMessages = { ...prev };
        delete newMessages[sessionId];
        return newMessages;
      });
      if (currentSessionId === sessionId) {
        setCurrentSessionId(sessions.length > 1 ? sessions[0].id : null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }, [currentSessionId, sessions]);

  const fetchMessages = useCallback(async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const response = await invoke<ChatMessage[]>('chat_get_messages', {
        sessionId: parseInt(sessionId),
      });
      setMessages((prev: Record<string, ChatMessage[]>) => ({ ...prev, [sessionId]: response }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages((prev: Record<string, ChatMessage[]>) => ({ ...prev, [sessionId]: [] }));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const addMessage = useCallback((sessionId: string, messageOrContent: string | ChatMessage) => {
    const userMsg: ChatMessage = typeof messageOrContent === 'string'
      ? {
          id: `temp-user-${Date.now()}`,
          sessionId,
          role: 'user',
          content: messageOrContent,
          timestamp: new Date().toISOString(),
        }
      : messageOrContent;
    setMessages((prev: Record<string, ChatMessage[]>) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), userMsg],
    }));
  }, []);

  /// Send a message to the LLM and get response
  const sendMessage = useCallback(async (
    sessionId: string,
    content: string,
    modelId: string,
  ): Promise<void> => {
    // Immediately show user message in UI
    const userMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      sessionId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev: Record<string, ChatMessage[]>) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), userMessage],
    }));

    setSendingMessage(true);
    try {
      // Call backend to send message (backend saves both user and assistant messages)
      await invoke('chat_send_message', {
        sessionId: parseInt(sessionId),
        content,
        modelId,
      });
      // Refresh messages from backend after sending (replace temp message with real ones)
      const response = await invoke<ChatMessage[]>('chat_get_messages', {
        sessionId: parseInt(sessionId),
      });
      setMessages((prev: Record<string, ChatMessage[]>) => ({
        ...prev,
        [sessionId]: response,
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove the temp user message on error
      setMessages((prev: Record<string, ChatMessage[]>) => ({
        ...prev,
        [sessionId]: (prev[sessionId] || []).filter(m => m.id !== userMessage.id),
      }));
      throw error;
    } finally {
      setSendingMessage(false);
    }
  }, []);

  const getCurrentMessages = useCallback(() => {
    return currentSessionId ? messages[currentSessionId] || [] : [];
  }, [currentSessionId, messages]);

  return {
    sessions,
    currentSessionId,
    messages,
    messagesLoading,
    sendingMessage,
    fetchSessions,
    createSession,
    switchSession,
    deleteSession,
    fetchMessages,
    addMessage,
    sendMessage,
    getCurrentMessages,
  };
}