import { ActionIcon, Badge, Button, Group, Kbd, Tooltip } from '@mantine/core';
import {
  ArrowUturnLeftIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

import type { AppSettings } from '../../lib/appSettings';
import { formatHotkeyKey } from '../../lib/shortcutSettings';
import { localize } from '../../lib/uiLanguage';

const Hotkey = ({
  language,
  value,
}: {
  language: AppSettings['uiLanguage'];
  value: string;
}) => {
  if (!value.trim()) {
    return (
      <Badge className="settings-reference-badge" variant="filled">
        {localize(language, '미설정', 'Not set')}
      </Badge>
    );
  }

  return (
    <Group gap={4} wrap="nowrap">
      {value.split('+').map((key, index) => (
        <Kbd key={`${key}-${index}`}>{formatHotkeyKey(key)}</Kbd>
      ))}
    </Group>
  );
};

interface SettingsShortcutRecorderProps {
  canReset: boolean;
  conflict?: string;
  field: string;
  language: AppSettings['uiLanguage'];
  label: string;
  onCancel: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onReset: () => void;
  onStart: () => void;
  recording: boolean;
  value: string;
}

const SettingsShortcutRecorder = ({
  canReset,
  conflict,
  field,
  language,
  label,
  onCancel,
  onKeyDown,
  onReset,
  onStart,
  recording,
  value,
}: SettingsShortcutRecorderProps) => {
  if (recording) {
    return (
      <Group className="settings-reference-shortcut-control" gap={7} wrap="nowrap">
        <button
          aria-label={localize(language, `${label} 단축키 입력`, `Set ${label} shortcut`)}
          autoFocus
          className="settings-reference-shortcut-record"
          data-conflict={conflict ? '' : undefined}
          key={`record-${field}`}
          onBlur={onCancel}
          onKeyDown={onKeyDown}
          type="button"
        >
          <span className="settings-reference-shortcut-recording-text">
            {localize(language, '단축키를 누르세요', 'Press a shortcut')}
          </span>
        </button>
        <Button
          className="settings-reference-shortcut-cancel"
          onClick={onCancel}
          variant="transparent"
        >
          {localize(language, '취소', 'Cancel')}
        </Button>
      </Group>
    );
  }

  return (
    <Group className="settings-reference-shortcut-control" gap={7} wrap="nowrap">
      <span
        aria-label={localize(language, `${label} 단축키`, `${label} shortcut`)}
        className="settings-reference-shortcut-value"
        data-conflict={conflict ? '' : undefined}
      >
        <Hotkey language={language} value={value} />
      </span>
      <Tooltip label={localize(language, '단축키 변경', 'Change shortcut')} withArrow>
        <ActionIcon
          aria-label={localize(language, `${label} 단축키 변경`, `Change ${label} shortcut`)}
          className="settings-reference-shortcut-edit"
          onClick={onStart}
          variant="subtle"
        >
          <PencilIcon />
        </ActionIcon>
      </Tooltip>
      {canReset && (
        <Tooltip label={localize(language, '저장된 단축키로 되돌리기', 'Restore saved shortcut')} withArrow>
          <ActionIcon
            aria-label={localize(
              language,
              `${label} 단축키를 저장된 값으로 되돌리기`,
              `Restore ${label} shortcut`,
            )}
            className="settings-reference-shortcut-reset"
            onClick={onReset}
            variant="subtle"
          >
            <ArrowUturnLeftIcon />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
};

export default SettingsShortcutRecorder;
