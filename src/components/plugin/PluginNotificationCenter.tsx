import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

/** 通知负载：经 "plugin-notification" 事件送达主窗口。
 * 既有插件通知（plugin_notify 带 pluginId），也有 app 后台任务（arXiv 爬虫 / Gmail 同步等）
 * 直接 emit 的通用提醒（不带 pluginId，带 route 跳转目标）。 */
export interface PluginNotificationPayload {
  pluginId?: string;
  pluginName?: string;
  title?: string;
  body?: string;
  kind: 'dialog' | 'bubble';
  level?: string;
  subject?: string;
  /** 可选的跳转目标（如 '/daily'、'/articles'）；插件通知会回退到 /plugins/<id> */
  route?: string;
  ts?: number;
}

/**
 * 插件全局通知中心：监听 "plugin-notification" 事件，在 app 顶层呈现提醒。
 * - kind = 'bubble' → Snackbar 气泡（自动消失，无需点击确认，可点"查看"跳转插件页）
 * - kind = 'dialog' → 模态 Dialog（需点击确认；"查看详情"跳转插件页）
 * 多条通知排队、逐条展示。挂在 AppShell 顶层，与 SettingsDialog 同级。
 */
export const PluginNotificationCenter = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<PluginNotificationPayload[]>([]);
  const [current, setCurrent] = useState<PluginNotificationPayload | null>(null);

  // 订阅后端通知事件
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;
    listen<PluginNotificationPayload>('plugin-notification', (event) => {
      if (cancelled) return;
      const payload = event.payload;
      if (!payload || (payload.kind !== 'dialog' && payload.kind !== 'bubble')) return;
      setQueue((q) => [...q, payload]);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  // 当前没有展示时，从队列取下一条
  useEffect(() => {
    if (current) return;
    if (queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, queue]);

  const dismiss = useCallback(() => setCurrent(null), []);

  // 跳转目标：优先 route，其次插件页；两者都没有则不可跳转（隐藏"查看"）
  const target = current?.route
    ? current.route
    : current?.pluginId
      ? `/plugins/${current.pluginId}`
      : null;

  const goToTarget = useCallback(() => {
    if (target) navigate(target);
    setCurrent(null);
  }, [target, navigate]);

  if (!current) return null;

  const isDialog = current.kind === 'dialog';
  const title = current.title || current.pluginName || t('pluginNotification.title');

  return isDialog ? (
    <Dialog open onClose={dismiss} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{title}</Box>
        {current.level && (
          <Chip
            label={current.level}
            size="small"
            variant="outlined"
            color={current.level === 'CCF A' ? 'error' : current.level === 'CCF B' ? 'warning' : 'default'}
          />
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {current.body}
        </Typography>
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {current.pluginName && <Chip label={current.pluginName} size="small" variant="outlined" />}
          {current.subject && <Chip label={current.subject} size="small" variant="outlined" />}
        </Box>
      </DialogContent>
      <DialogActions>
        {target && (
          <Button onClick={goToTarget}>{t('pluginNotification.details')}</Button>
        )}
        <Button onClick={dismiss} variant="contained" autoFocus>
          {t('pluginNotification.gotIt')}
        </Button>
      </DialogActions>
    </Dialog>
  ) : (
    <Snackbar
      open
      autoHideDuration={6000}
      onClose={dismiss}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      message={title}
      action={
        <>
          {target && (
            <Button color="secondary" size="small" onClick={goToTarget}>
              {t('pluginNotification.view')}
            </Button>
          )}
          <Button color="inherit" size="small" onClick={dismiss}>
            ✕
          </Button>
        </>
      }
    />
  );
};
