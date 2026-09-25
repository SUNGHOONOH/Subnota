import { Group } from '@mantine/core';

import type { AppSettings } from '../../lib/appSettings';
import { getUiDateLocale, localize } from '../../lib/uiLanguage';
import {
  Row,
  RowAction,
  Section,
} from './SettingsPrimitives';

type Translate = (korean: string, english: string) => string;
type RunAction = <T>(
  action: () => Promise<T>,
  success: string | ((result: T) => string | null),
) => void;

interface SettingsSyncSectionProps {
  appLanguage: AppSettings['uiLanguage'];
  embeddingStatus: LocalEmbeddingStatusBridge | null;
  failedSyncCount: number;
  isOnline: boolean;
  isSignedIn: boolean;
  isSyncing: boolean;
  isWorking: boolean;
  lastSyncAt: string | null;
  onChooseStorage: () => Promise<unknown>;
  onDeleteEmbeddingModel: () => Promise<LocalEmbeddingStatusBridge | null>;
  onDownloadEmbeddingModel: () => Promise<LocalEmbeddingStatusBridge | null>;
  onOpenStorage: () => Promise<unknown>;
  onSync: () => void;
  pendingSyncCount: number;
  run: RunAction;
  storageInfo: { databasePath: string; size: number } | null;
  translate: Translate;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const embeddingModelText = (
  status: LocalEmbeddingStatusBridge | null,
  language: AppSettings['uiLanguage'],
) => {
  if (!status) return localize(language, '상태를 확인하는 중...', 'Checking status…');
  if (status.state === 'ready') {
    return `${localize(language, '준비됨', 'Ready')} · ${formatBytes(status.downloadedBytes)}`;
  }
  if (status.state === 'downloading') {
    return `${localize(language, '받는 중', 'Downloading')} · ${formatBytes(status.downloadedBytes)} / ${formatBytes(status.totalBytes)}`;
  }
  if (status.state === 'loading') return localize(language, '모델을 여는 중...', 'Loading model…');
  if (status.state === 'failed') return status.error ?? localize(language, '받지 못했습니다.', 'Download failed.');
  return `${localize(language, '받지 않음', 'Not downloaded')} · ${localize(language, '약', 'about')} ${formatBytes(status.totalBytes)}`;
};

const embeddingModelDescription = (
  status: LocalEmbeddingStatusBridge | null,
  language: AppSettings['uiLanguage'],
) => {
  const isBusy =
    !status || status.state === 'loading' || status.state === 'downloading';
  const text = embeddingModelText(status, language);
  return isBusy ? (
    <>
      <span aria-hidden="true" className="inline-busy" />
      {text}
    </>
  ) : (
    text
  );
};

export default function SettingsSyncSection({
  appLanguage,
  embeddingStatus,
  failedSyncCount,
  isOnline,
  isSignedIn,
  isSyncing,
  isWorking,
  lastSyncAt,
  onChooseStorage,
  onDeleteEmbeddingModel,
  onDownloadEmbeddingModel,
  onOpenStorage,
  onSync,
  pendingSyncCount,
  run,
  storageInfo,
  translate: t,
}: SettingsSyncSectionProps) {
  return (
    <div className="settings-reference-sections">
      <Section title={t('동기화 상태', 'Sync status')}>
        <Row
          action={
            <RowAction
              className="settings-sync-action"
              disabled={!isSignedIn || !isOnline || isSyncing}
              onClick={onSync}
            >
              {isSyncing ? (
                <>
                  <span aria-hidden="true" className="inline-busy" />
                  {t('동기화 중...', 'Syncing…')}
                </>
              ) : (
                t('지금 동기화', 'Sync now')
              )}
            </RowAction>
          }
          description={
            lastSyncAt
              ? `${t('마지막 동기화', 'Last synced')} ${new Date(lastSyncAt).toLocaleString(getUiDateLocale(appLanguage))}`
              : t('동기화 기록 없음', 'No sync history')
          }
          label={isOnline ? t('온라인', 'Online') : t('오프라인', 'Offline')}
        />
        <Row
          description={t(
            `대기 ${pendingSyncCount} · 실패 ${failedSyncCount}`,
            `${pendingSyncCount} pending · ${failedSyncCount} failed`,
          )}
          label={t('동기화 큐', 'Sync queue')}
        />
      </Section>
      <Section
        description={t(
          '위치를 변경하면 데이터베이스를 새 폴더로 복사한 뒤 앱을 다시 불러옵니다.',
          'Copies the database to a new folder, then reloads the app.',
        )}
        title={t('로컬 저장소', 'Local storage')}
      >
        <Row
          action={
            <Group gap={18} wrap="nowrap">
              <RowAction
                onClick={() =>
                  run(
                    onChooseStorage,
                    info =>
                      info
                        ? t('저장소 위치를 변경했습니다.', 'Storage location changed.')
                        : null,
                  )
                }
              >
                {t('위치 변경', 'Change location')}
              </RowAction>
              <RowAction
                onClick={() =>
                  run(
                    onOpenStorage,
                    t('저장소 폴더를 열었습니다.', 'Opened the storage folder.'),
                  )
                }
              >
                {t('폴더 열기', 'Open folder')}
              </RowAction>
            </Group>
          }
          description={`${storageInfo?.databasePath ?? t('불러오는 중...', 'Loading…')} · ${formatBytes(storageInfo?.size ?? 0)} ${t('사용', 'used')}`}
          label={t('SQLite 데이터베이스', 'SQLite database')}
        />
      </Section>
      <Section
        description={t(
          '연관 문장 검색에 쓰는 파일입니다. 지우면 다음 검색 때 다시 받습니다.',
          'This file powers related-passage search. It downloads again on your next search if removed.',
        )}
        title={t('검색 모델', 'Search model')}
      >
        <Row
          action={
            embeddingStatus?.state === 'ready' ? (
              <RowAction
                disabled={isWorking}
                onClick={() =>
                  run(async () => onDeleteEmbeddingModel(), t('검색 모델을 삭제했습니다.', 'Search model deleted.'))
                }
              >
                {t('삭제', 'Delete')}
              </RowAction>
            ) : embeddingStatus?.state === 'absent' ||
              embeddingStatus?.state === 'failed' ? (
              <RowAction
                disabled={isWorking}
                onClick={() =>
                  run(async () => onDownloadEmbeddingModel(), t('검색 모델을 받았습니다.', 'Search model downloaded.'))
                }
              >
                {t('다운로드', 'Download')}
              </RowAction>
            ) : null
          }
          description={embeddingModelDescription(embeddingStatus, appLanguage)}
          label={t('로컬 임베딩 모델', 'Local embedding model')}
        />
      </Section>
    </div>
  );
}
