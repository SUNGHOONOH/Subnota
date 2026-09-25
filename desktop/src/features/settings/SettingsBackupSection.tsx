import type { Dispatch, SetStateAction } from 'react';

import {
  Box,
  Button,
  FileButton,
  Group,
  Text,
} from '@mantine/core';

import {
  Row,
  RowAction,
  Section,
} from './SettingsPrimitives';

type RunAction = <T>(
  action: () => Promise<T>,
  success: string | ((result: T) => string | null),
) => void;

interface SettingsBackupSectionProps {
  inboxData: unknown[];
  isWorking: boolean;
  onBackup: () => Promise<string | null>;
  onExportJson: (name: string, value: unknown) => Promise<string | null>;
  onRestore: (file: File) => Promise<void>;
  onRestoreFileChange: Dispatch<SetStateAction<File | null>>;
  restoreFile: File | null;
  run: RunAction;
  scheduleData: unknown[];
  translate: (korean: string, english: string) => string;
}

export default function SettingsBackupSection({
  inboxData,
  isWorking,
  onBackup,
  onExportJson,
  onRestore,
  onRestoreFileChange,
  restoreFile,
  run,
  scheduleData,
  translate: t,
}: SettingsBackupSectionProps) {
  return (
    <div className="settings-reference-sections">
      <Section title={t('전체 백업', 'Full backup')}>
        <Row
          action={
            <RowAction
              disabled={isWorking}
              onClick={() =>
                run(
                  onBackup,
                  path => (path ? t('백업을 생성했습니다.', 'Backup created.') : null),
                )
              }
            >
              {t('백업 생성', 'Create backup')}
            </RowAction>
          }
          description={t(
            '메모, 캘린더, Inbox가 포함된 SQLite 백업을 만듭니다.',
            'Creates a SQLite backup with memos, calendar items, and Inbox data.',
          )}
          label={t('전체 데이터 백업', 'Back up all data')}
        />
        <FileButton accept=".sqlite3" onChange={onRestoreFileChange}>
          {({ onClick }) => (
            <Row
              action={
                <RowAction disabled={isWorking} onClick={onClick}>
                  {t('파일 선택', 'Choose file')}
                </RowAction>
              }
              description={t(
                '백업 파일로 현재 데이터를 교체합니다.',
                'Replaces current data with a backup file.',
              )}
              label={t('백업 파일 복원', 'Restore backup file')}
            />
          )}
        </FileButton>
        {restoreFile && (
          <Box className="settings-reference-confirmation" role="alert">
            <Text className="settings-reference-row-label">
              {t(
                `'${restoreFile.name}' 파일로 현재 데이터를 교체할까요?`,
                `Replace current data with '${restoreFile.name}'?`,
              )}
            </Text>
            <Text className="settings-reference-row-value">
              {t(
                '현재 로컬 메모, 캘린더, 링크 저장함이 백업 내용으로 바뀝니다.',
                'Your local memos, calendar, and Inbox will be replaced by this backup.',
              )}
            </Text>
            <Group gap={8} mt={10}>
              <Button
                className="settings-reference-save"
                disabled={isWorking}
                onClick={() =>
                  run(async () => {
                    await onRestore(restoreFile);
                    onRestoreFileChange(null);
                  }, t('백업을 복원했습니다.', 'Backup restored.'))
                }
              >
                {t('복원 진행', 'Restore')}
              </Button>
              <Button
                className="settings-reference-cancel"
                disabled={isWorking}
                onClick={() => onRestoreFileChange(null)}
                variant="transparent"
              >
                {t('취소', 'Cancel')}
              </Button>
            </Group>
          </Box>
        )}
      </Section>
      <Section title={t('JSON 내보내기', 'Export JSON')}>
        <Row
          action={
            <RowAction
              disabled={isWorking}
              onClick={() =>
                run(
                  () => onExportJson('subnota-calendar', scheduleData),
                  path =>
                    path ? t('캘린더 데이터를 내보냈습니다.', 'Calendar data exported.') : null,
                )
              }
            >
              {t('내보내기', 'Export')}
            </RowAction>
          }
          description={t(
            '모든 캘린더 항목을 JSON 파일로 저장합니다.',
            'Saves all calendar items to a JSON file.',
          )}
          label={t('캘린더 내보내기', 'Export calendar')}
        />
        <Row
          action={
            <RowAction
              disabled={isWorking}
              onClick={() =>
                run(
                  () => onExportJson('subnota-inbox', inboxData),
                  path =>
                    path ? t('링크 저장함 데이터를 내보냈습니다.', 'Inbox data exported.') : null,
                )
              }
            >
              {t('내보내기', 'Export')}
            </RowAction>
          }
          description={t(
            '링크 저장함 항목을 JSON 파일로 저장합니다.',
            'Saves Inbox items to a JSON file.',
          )}
          label={t('링크 저장함 내보내기', 'Export Inbox')}
        />
      </Section>
    </div>
  );
}
