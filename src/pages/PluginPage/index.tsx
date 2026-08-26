import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Chip,
  Alert,
  Snackbar,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Extension as ExtensionIcon, Warning as WarningIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePluginStore } from '../../stores/usePluginStore';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useThemeMode } from '../../app/ThemeProvider';
import { PluginIcon } from '../../components/plugin/PluginIcon';

/**
 * 插件页：在 iframe 里加载插件的独立前端（rdp://<pluginId>/<entry>）。
 * 同时作为 postMessage 桥：把插件 iframe 发来的 rdp-request 转成受控 Tauri 命令，
 * 回传 rdp-response。只响应来自当前插件 iframe 的消息，防止外部伪造。
 */
export const PluginPage = () => {
  const { pluginId } = useParams<{ pluginId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { plugins } = usePluginStore();
  const { language } = useLanguageStore();
  const { mode } = useThemeMode();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const plugin = plugins.find((p) => p.id === pluginId);
  const entry = plugin?.entry || 'page/index.html';
  const src = plugin ? `rdp://${plugin.id}/${entry}` : '';

  // 插件 iframe -> 受控插件 API 的 postMessage 桥
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'rdp-request') return;
      // 只响应来自当前插件 iframe 的消息
      const iframeWin = iframeRef.current?.contentWindow;
      if (!iframeWin || event.source !== iframeWin) return;

      const { id, cmd, args } = data;
      try {
        const result = await invoke(cmd, args || {});
        iframeWin.postMessage({ type: 'rdp-response', id, ok: true, data: result }, '*');
      } catch (err) {
        iframeWin.postMessage({ type: 'rdp-response', id, ok: false, error: String(err) }, '*');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [src]);

  // 插件不存在 / 加载失败 → 提示几秒后消失，不影响使用
  useEffect(() => {
    if (!plugin) {
      setError(t('pluginPage.pluginMissing'));
      setToast(t('pluginPage.pluginMissing'));
      return;
    }
    if (plugin.loadError) {
      setError(t('pluginPage.loadFailed', { reason: plugin.loadError }));
      setToast(t('pluginPage.loadFailed', { reason: plugin.loadError }));
      return;
    }
    if (!plugin.hasPage) {
      setError(t('pluginPage.noPage'));
      return;
    }
    setError(null);
  }, [plugin, t]);

  // 把 app 的明暗主题 / 语言推送给插件 iframe，供插件适配主题与 i18n
  const pushContext = useCallback(() => {
    const iframeWin = iframeRef.current?.contentWindow;
    if (!iframeWin) return;
    iframeWin.postMessage({ type: 'rdp-context', theme: mode, lang: language }, '*');
  }, [mode, language]);

  const handleIframeLoad = () => {
    // 加载成功：清除超时错误占位（具体加载是否成功由 iframe 内决定）
    if (error && error !== t('pluginPage.noPage')) {
      setError(null);
    }
    pushContext();
  };

  // 主题 / 语言变化时重新推送上下文
  useEffect(() => {
    pushContext();
  }, [pushContext]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'background.paper' }}>
        <Toolbar variant="dense">
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          {plugin ? (
            <Box sx={{ mr: 1, display: 'flex' }}>
              <PluginIcon plugin={plugin} />
            </Box>
          ) : (
            <ExtensionIcon sx={{ mr: 1, color: 'primary.main' }} fontSize="small" />
          )}
          {plugin ? (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {plugin.name}
              </Typography>
              <Chip label={plugin.version} size="small" variant="outlined" sx={{ ml: 1 }} />
              {plugin.author && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {plugin.author}
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="subtitle1">{pluginId}</Typography>
          )}
        </Toolbar>
      </AppBar>

      {error ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="warning" icon={<WarningIcon />}>
            {error}
          </Alert>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <iframe
            ref={iframeRef}
            src={src}
            onLoad={handleIframeLoad}
            style={{ width: '100%', height: '100%', border: 'none' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={`plugin-${plugin?.id}`}
          />
        </Box>
      )}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast || undefined}
      />
    </Box>
  );
};
