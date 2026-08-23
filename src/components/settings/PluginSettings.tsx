import { useState } from 'react';
import { Box, Typography, TextField, Switch, FormControlLabel, Button, Chip } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { PluginInfo } from '../../types/plugin';

interface PluginSettingsProps {
  plugin: PluginInfo;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

/** 按 plugin.json 的 settings 键值对渲染编辑表单，保存时写回该插件 plugin.json。 */
export const PluginSettings = ({ plugin, onSaved, onError }: PluginSettingsProps) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, unknown>>(plugin.settings || {});
  const [saving, setSaving] = useState(false);

  const settings = plugin.settings || {};
  const keys = Object.keys(settings);

  const updateValue = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke('plugin_update_settings', { pluginId: plugin.id, settings: values });
      onSaved(t('settings.pluginSettingsSaved'));
    } catch (err) {
      onError(`保存 ${plugin.name} 配置失败: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  if (keys.length === 0) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{plugin.name}</Typography>
        {plugin.version && <Chip label={`v${plugin.version}`} size="small" variant="outlined" />}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
        {keys.map((key) => {
          const v = values[key];
          const isBool = typeof v === 'boolean';
          const isNum = typeof v === 'number';
          if (isBool) {
            return (
              <FormControlLabel
                key={key}
                control={
                  <Switch
                    checked={Boolean(v)}
                    onChange={(e) => updateValue(key, e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{key}</Typography>}
              />
            );
          }
          return (
            <TextField
              key={key}
              label={key}
              size="small"
              fullWidth
              type={isNum ? 'number' : 'text'}
              value={isNum ? Number(v) : typeof v === 'string' ? v : JSON.stringify(v ?? '')}
              onChange={(e) => {
                if (isNum) {
                  const n = Number(e.target.value);
                  updateValue(key, Number.isNaN(n) ? 0 : n);
                } else {
                  updateValue(key, e.target.value);
                }
              }}
            />
          );
        })}
      </Box>
      <Button
        variant="contained"
        size="small"
        startIcon={<SaveIcon />}
        disabled={saving}
        onClick={handleSave}
      >
        {t('save')}
      </Button>
    </Box>
  );
};
