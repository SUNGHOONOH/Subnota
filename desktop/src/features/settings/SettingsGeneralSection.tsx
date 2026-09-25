import {
  Row,
  Section,
  ExpandableRow,
} from './SettingsPrimitives';
import { SegmentedControl, Switch } from '@mantine/core';

import type { AppSettings, CloseBehavior } from '../../lib/appSettings';

interface SettingsGeneralSectionProps {
  appSettings: AppSettings;
  desktopPreferences: {
    closeBehavior: CloseBehavior;
    launchAtLogin: boolean;
  };
  expandedRow: string | null;
  onAppSettingsChange: (patch: Partial<AppSettings>) => void;
  onDesktopPreferencesChange: (
    patch: Partial<SettingsGeneralSectionProps['desktopPreferences']>,
  ) => void;
  onSetExpandedRow: (row: string | null) => void;
  translate: (korean: string, english: string) => string;
}

export default function SettingsGeneralSection({
  appSettings,
  desktopPreferences,
  expandedRow,
  onAppSettingsChange,
  onDesktopPreferencesChange,
  onSetExpandedRow,
  translate: t,
}: SettingsGeneralSectionProps) {
  return (
    <div className="settings-reference-sections">
      <Section title={t('언어', 'Language')}>
        <Row
          action={
            <SegmentedControl
              className="settings-reference-segmented"
              data={[
                { label: '한국어', value: 'ko' },
                { label: 'English', value: 'en' },
              ]}
              onChange={value =>
                onAppSettingsChange({
                  uiLanguage: value as AppSettings['uiLanguage'],
                })
              }
              value={appSettings.uiLanguage}
            />
          }
          description={t(
            '화면 언어를 바꿉니다. 날짜 표시는 기기 지역 설정을 따릅니다.',
            'Changes the display language. Date formats follow your device region.',
          )}
          label={t('화면 언어', 'Display language')}
        />
      </Section>
      <Section title={t('시작 및 창', 'Startup & window')}>
        <Row
          action={
            <Switch
              checked={desktopPreferences.launchAtLogin}
              className="settings-reference-switch"
              onChange={event =>
                onDesktopPreferencesChange({
                  launchAtLogin: event.currentTarget.checked,
                })
              }
              offLabel="OFF"
              onLabel="ON"
              size="sm"
              withThumbIndicator={false}
            />
          }
          description={t(
            '로그인할 때 Subnota를 자동으로 엽니다.',
            'Opens Subnota when you sign in to this computer.',
          )}
          label={t('로그인 시 자동 실행', 'Launch at login')}
        />
        <ExpandableRow
          expanded={expandedRow === 'closeBehavior'}
          label={t('창 닫기 동작', 'When closing the window')}
          language={appSettings.uiLanguage}
          onClose={() => onSetExpandedRow(null)}
          onOpen={() => onSetExpandedRow('closeBehavior')}
          value={
            desktopPreferences.closeBehavior === 'tray'
              ? t('트레이로 최소화', 'Minimize to tray')
              : t('앱 종료', 'Quit app')
          }
        >
          <SegmentedControl
            className="settings-reference-segmented"
            data={[
              { label: t('앱 종료', 'Quit app'), value: 'quit' },
              { label: t('트레이로 최소화', 'Minimize to tray'), value: 'tray' },
            ]}
            onChange={value =>
              onDesktopPreferencesChange({
                closeBehavior: value as CloseBehavior,
              })
            }
            value={desktopPreferences.closeBehavior}
          />
        </ExpandableRow>
        <Row
          action={
            <Switch
              checked={appSettings.restoreWorkspace}
              className="settings-reference-switch"
              onChange={event =>
                onAppSettingsChange({
                  restoreWorkspace: event.currentTarget.checked,
                })
              }
              offLabel="OFF"
              onLabel="ON"
              size="sm"
              withThumbIndicator={false}
            />
          }
          description={t(
            '앱을 열 때 마지막 작업 공간으로 돌아갑니다.',
            'Returns to your last workspace when you open the app.',
          )}
          label={t('마지막 작업 공간 복원', 'Restore last workspace')}
        />
      </Section>
      <Section title={t('알림 및 업데이트', 'Notifications & updates')}>
        <Row
          action={
            <Switch
              checked={appSettings.clipNotifications}
              className="settings-reference-switch"
              onChange={event =>
                onAppSettingsChange({
                  clipNotifications: event.currentTarget.checked,
                })
              }
              offLabel="OFF"
              onLabel="ON"
              size="sm"
              withThumbIndicator={false}
            />
          }
          description={t(
            '꺼도 메뉴바 표시는 그대로 남습니다.',
            'The menu bar indicator remains visible when this is off.',
          )}
          label={t('링크를 저장하면 알림', 'Notify when a link is saved')}
        />
        <Row
          action={
            <Switch
              checked={appSettings.autoCheckUpdates}
              className="settings-reference-switch"
              onChange={event =>
                onAppSettingsChange({
                  autoCheckUpdates: event.currentTarget.checked,
                })
              }
              offLabel="OFF"
              onLabel="ON"
              size="sm"
              withThumbIndicator={false}
            />
          }
          description={t(
            '새 버전이 있으면 알려줍니다.',
            'Lets you know when a new version is available.',
          )}
          label={t('업데이트 자동 확인', 'Check for updates automatically')}
        />
      </Section>
      <Section title={t('메모 작성', 'Writing')}>
        <Row
          action={
            <Switch
              checked={appSettings.ambientAutoSearchEnabled}
              className="settings-reference-switch"
              onChange={event =>
                onAppSettingsChange({
                  ambientAutoSearchEnabled: event.currentTarget.checked,
                })
              }
              offLabel="OFF"
              onLabel="ON"
              size="sm"
              withThumbIndicator={false}
            />
          }
          description={t(
            '입력을 멈추면 자동으로 연관 문장을 검색합니다. 꺼져 있으면 편집기 하단 버튼으로 직접 검색합니다.',
            'Searches related passages after you pause typing. When off, use the button at the bottom of the editor.',
          )}
          label={t('연관 문장 자동 검색', 'Automatic related-passage search')}
        />
      </Section>
    </div>
  );
}
