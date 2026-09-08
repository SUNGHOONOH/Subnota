import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Button, Group, Text } from '@mantine/core';
import type { AppSettings } from '../../lib/appSettings';
import { localize } from '../../lib/uiLanguage';
import {
  AppShortcutSettings,
  ShortcutSettings,
} from '../../lib/shortcutSettings';
import SettingsShortcutRecorder from './SettingsShortcutRecorder';
import { Row, Section } from './SettingsPrimitives';

type EditableShortcutField = keyof ShortcutSettings | keyof AppShortcutSettings;

interface ShortcutItem<Field extends EditableShortcutField = EditableShortcutField> {
  description: string;
  enDescription: string;
  enLabel: string;
  field: Field;
  label: string;
}

interface AppShortcutSection {
  description?: string;
  enDescription?: string;
  enTitle: string;
  fields: Array<keyof AppShortcutSettings>;
  title: string;
}

interface SettingsHotkeysSectionProps {
  appShortcutDraft: AppShortcutSettings;
  appShortcuts: AppShortcutSettings;
  appShortcutSections: ReadonlyArray<AppShortcutSection>;
  editableAppShortcuts: ReadonlyArray<ShortcutItem<keyof AppShortcutSettings>>;
  editableShortcuts: ReadonlyArray<ShortcutItem<keyof ShortcutSettings>>;
  hasShortcutConflict: boolean;
  isWorking: boolean;
  language: AppSettings['uiLanguage'];
  onCancelRecording: (field: EditableShortcutField) => void;
  onCaptureShortcut: (
    field: EditableShortcutField,
  ) => (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onResetShortcut: (field: EditableShortcutField) => void;
  onRestoreDefaults: () => void;
  onSave: () => void;
  onStartRecording: (field: EditableShortcutField) => void;
  recording: EditableShortcutField | null;
  shortcutConflicts: Partial<Record<EditableShortcutField, string>>;
  shortcutDraft: ShortcutSettings;
  shortcuts: ShortcutSettings;
}

const SettingsHotkeysSection = ({
  appShortcutDraft,
  appShortcuts,
  appShortcutSections,
  editableAppShortcuts,
  editableShortcuts,
  hasShortcutConflict,
  isWorking,
  language,
  onCancelRecording,
  onCaptureShortcut,
  onResetShortcut,
  onRestoreDefaults,
  onSave,
  onStartRecording,
  recording,
  shortcutConflicts,
  shortcutDraft,
  shortcuts,
}: SettingsHotkeysSectionProps) => {
  const t = (korean: string, english: string) =>
    localize(language, korean, english);

  return (
    <div className="settings-reference-sections">
      {appShortcutSections.map(section => (
        <Section
          description={
            section.description
              ? localize(
                  language,
                  section.description,
                  section.enDescription ?? section.description,
                )
              : undefined
          }
          key={section.title}
          title={localize(language, section.title, section.enTitle)}
        >
          {editableAppShortcuts
            .filter(item => section.fields.includes(item.field))
            .map(item => (
              <Row
                action={
                  <SettingsShortcutRecorder
                    canReset={appShortcutDraft[item.field] !== appShortcuts[item.field]}
                    conflict={shortcutConflicts[item.field]}
                    field={item.field}
                    label={localize(language, item.label, item.enLabel)}
                    language={language}
                    onCancel={() => onCancelRecording(item.field)}
                    onKeyDown={onCaptureShortcut(item.field)}
                    onReset={() => onResetShortcut(item.field)}
                    onStart={() => onStartRecording(item.field)}
                    recording={recording === item.field}
                    value={appShortcutDraft[item.field]}
                  />
                }
                description={
                  shortcutConflicts[item.field] ? (
                    <Text
                      className="settings-reference-shortcut-conflict"
                      component="span"
                      size="sm"
                    >
                      {t(
                        `'${shortcutConflicts[item.field]}'와 충돌합니다.`,
                        `Conflicts with '${shortcutConflicts[item.field]}'.`,
                      )}
                    </Text>
                  ) : (
                    localize(language, item.description, item.enDescription)
                  )
                }
                key={item.field}
                label={localize(language, item.label, item.enLabel)}
              />
            ))}
        </Section>
      ))}
      <Section title={t('빠른 실행', 'Quick actions')}>
        {editableShortcuts.map(item => (
          <Row
            action={
              <SettingsShortcutRecorder
                canReset={shortcutDraft[item.field] !== shortcuts[item.field]}
                conflict={shortcutConflicts[item.field]}
                field={item.field}
                label={localize(language, item.label, item.enLabel)}
                language={language}
                onCancel={() => onCancelRecording(item.field)}
                onKeyDown={onCaptureShortcut(item.field)}
                onReset={() => onResetShortcut(item.field)}
                onStart={() => onStartRecording(item.field)}
                recording={recording === item.field}
                value={shortcutDraft[item.field]}
              />
            }
            description={
              shortcutConflicts[item.field] ? (
                <Text
                  className="settings-reference-shortcut-conflict"
                  component="span"
                  size="sm"
                >
                  {t(
                    `'${shortcutConflicts[item.field]}'와 충돌합니다.`,
                    `Conflicts with '${shortcutConflicts[item.field]}'.`,
                  )}
                </Text>
              ) : (
                localize(language, item.description, item.enDescription)
              )
            }
            key={item.field}
            label={localize(language, item.label, item.enLabel)}
          />
        ))}
      </Section>
      {/* 이 버튼들은 앱 단축키와 전역 단축키를 모두 저장한다. "빠른 실행"
          묶음 안에 두면 그 묶음만 저장하는 것처럼 읽힌다. */}
      <Group className="settings-reference-actions" justify="flex-end">
        <Button
          className="settings-reference-cancel"
          onClick={onRestoreDefaults}
          variant="transparent"
        >
          {t('기본값 복원', 'Restore defaults')}
        </Button>
        <Button
          className="settings-reference-save"
          disabled={hasShortcutConflict || isWorking}
          onClick={onSave}
        >
          {t('단축키 저장', 'Save shortcuts')}
        </Button>
      </Group>
    </div>
  );
};

export default SettingsHotkeysSection;
