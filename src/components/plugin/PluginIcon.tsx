import { useState } from 'react';
import { Extension as ExtensionIcon } from '@mui/icons-material';
import type { PluginInfo } from '../../types/plugin';

/**
 * 插件图标：读插件自己的 icon 文件（rdp://<id>/<icon>，通常是 icon.svg）。
 *
 * 多层兜底，插件图标再脏也不会影响 app：
 * - 插件没声明 icon / 插件本身加载失败 → 直接回退
 * - icon 名非法（空、绝对路径、含 `..`）→ 直接回退（避免构造异常 rdp URL）
 * - <img> 加载失败 / 文件损坏 → onError 回退到通用扩展图标
 */
export function PluginIcon({ plugin, size = 18 }: { plugin: PluginInfo; size?: number }) {
  const [failed, setFailed] = useState(false);

  const iconName = plugin.icon || '';
  const valid = !plugin.loadError &&
    iconName.length > 0 &&
    iconName.indexOf('..') < 0 &&
    !iconName.startsWith('/');

  if (!valid || failed) {
    return <ExtensionIcon fontSize="small" sx={{ color: 'primary.main' }} />;
  }
  return (
    <img
      src={`rdp://${plugin.id}/${iconName}`}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: 4, display: 'block', objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  );
}
