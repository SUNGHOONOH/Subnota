import { useEffect, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  FileButton,
  Group,
  Kbd,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { MoonStarIcon } from '@/components/tiptap-icons/moon-star-icon';
import { SunIcon } from '@/components/tiptap-icons/sun-icon';
import { APP_HOTKEYS } from '../../hooks/useAppHotkeys';
import { AppSettings, CloseBehavior } from '../../lib/appSettings';
import {
  DEFAULT_SHORTCUT_SETTINGS,
  ShortcutSettings,
} from '../../lib/shortcutSettings';

interface ShortcutSaveResult {
  capture: boolean;
  toggle: boolean;
}

interface SettingsModalProps {
  appSettings: AppSettings;
  desktopPreferences: {
    closeBehavior: CloseBehavior;
    launchAtLogin: boolean;
  };
  email?: string | null;
  failedSyncCount: number;
  inboxData: unknown[];
  isOnline: boolean;
  isOpen: boolean;
  isSignedIn: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingSyncCount: number;
  provider?: string | null;
  scheduleData: unknown[];
  shortcuts: ShortcutSettings;
  storageInfo: { databasePath: string; size: number } | null;
  onAppSettingsChange: (settings: AppSettings) => void;
  onBackup: () => Promise<string | null>;
  onCheckUpdates: () => Promise<string>;
  onChooseStorage: () => Promise<void>;
  onClose: () => void;
  onDesktopPreferencesChange: (preferences: {
    closeBehavior: CloseBehavior;
    launchAtLogin: boolean;
  }) => Promise<void>;
  onExportJson: (name: string, value: unknown) => Promise<string | null>;
  onOpenStorage: () => Promise<void>;
  onPasswordReset: () => Promise<void>;
  onResetShortcuts: () => Promise<ShortcutSaveResult | void>;
  onRestore: (file: File) => Promise<void>;
  onSaveShortcuts: (
    settings: ShortcutSettings,
  ) => Promise<ShortcutSaveResult | void>;
  onSignOut: () => void;
  onSync: () => void;
}

const EDITABLE_SHORTCUTS: Array<{
  field: keyof ShortcutSettings;
  label: string;
}> = [
  { field: 'toggleMini', label: 'Mini Subnota 열기' },
  { field: 'capturePage', label: '현재 페이지 저장' },
  { field: 'openSearch', label: '메모 검색' },
];

const PROVIDER_LABELS: Record<string, string> = {
  email: '이메일',
  google: 'Google',
  kakao: '카카오',
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const Hotkey = ({ value }: { value: string }) => (
  <Group gap={4} wrap="nowrap">
    {value.split('+').map((key, index) => (
      <Kbd key={`${key}-${index}`}>
        {key === 'mod' || key === 'CommandOrControl' ? '⌘/Ctrl' : key}
      </Kbd>
    ))}
  </Group>
);

const Section = ({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) => (
  <Paper p="lg" radius="xl" shadow="xs">
    <Stack gap="md">
      <div>
        <Title order={4} style={{ textWrap: 'balance' }}>
          {title}
        </Title>
        {description && (
          <Text c="dimmed" mt={4} size="sm" style={{ textWrap: 'pretty' }}>
            {description}
          </Text>
        )}
      </div>
      {children}
    </Stack>
  </Paper>
);

export default function SettingsModal(props: SettingsModalProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [shortcutDraft, setShortcutDraft] = useState(props.shortcuts);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isWorking, setWorking] = useState(false);

  useEffect(() => {
    if (props.isOpen) {
      setShortcutDraft(props.shortcuts);
      setFeedback(null);
    }
  }, [props.isOpen, props.shortcuts]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setWorking(true);
    setFeedback(null);
    try {
      await action();
      setFeedback(success);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : '요청을 완료하지 못했습니다.',
      );
    } finally {
      setWorking(false);
    }
  };

  const updateAppSettings = (patch: Partial<AppSettings>) =>
    props.onAppSettingsChange({ ...props.appSettings, ...patch });

  const updateDesktopPreferences = (
    patch: Partial<SettingsModalProps['desktopPreferences']>,
  ) =>
    run(
      () =>
        props.onDesktopPreferencesChange({
          ...props.desktopPreferences,
          ...patch,
        }),
      '일반 설정을 저장했습니다.',
    );

  const isDark =
    colorScheme === 'dark' ||
    document.documentElement.classList.contains('dark');
  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setColorScheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    window.localStorage?.setItem('subnota.theme', next);
  };

  return (
    <Modal
      centered
      onClose={props.onClose}
      opened={props.isOpen}
      padding={0}
      size={980}
      title={null}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.38, blur: 3 }}
      radius="xl"
    >
      <Tabs
        defaultValue="general"
        orientation="vertical"
        styles={{
          list: { padding: 16, width: 210 },
          panel: { minWidth: 0 },
          root: { minHeight: 650 },
          tab: { minHeight: 42 },
        }}
      >
        <Tabs.List>
          <Text fw={700} mb="sm" px="sm" size="lg">
            설정
          </Text>
          <Tabs.Tab value="general">일반</Tabs.Tab>
          <Tabs.Tab value="appearance">화면 및 편집기</Tabs.Tab>
          <Tabs.Tab value="sync">동기화 및 저장소</Tabs.Tab>
          <Tabs.Tab value="backup">백업 및 데이터</Tabs.Tab>
          <Tabs.Tab value="hotkeys">단축키</Tabs.Tab>
          <Tabs.Tab value="account">계정</Tabs.Tab>
          <Tabs.Tab value="about">정보</Tabs.Tab>
        </Tabs.List>

        <Box flex={1}>
          <ScrollArea h={650} p="xl">
            <Tabs.Panel value="general">
              <Stack gap="lg">
                <Title order={2}>일반</Title>
                <Section title="시작 및 종료">
                  <Switch
                    checked={props.desktopPreferences.launchAtLogin}
                    label="시스템 시작 시 자동 실행"
                    onChange={event =>
                      void updateDesktopPreferences({
                        launchAtLogin: event.currentTarget.checked,
                      })
                    }
                  />
                  <Stack gap={6}>
                    <Text fw={500} size="sm">
                      창 닫기 동작
                    </Text>
                    <SegmentedControl
                      data={[
                        { label: '앱 종료', value: 'quit' },
                        { label: '트레이로 최소화', value: 'tray' },
                      ]}
                      onChange={value =>
                        void updateDesktopPreferences({
                          closeBehavior: value as CloseBehavior,
                        })
                      }
                      value={props.desktopPreferences.closeBehavior}
                    />
                  </Stack>
                  <Switch
                    checked={props.appSettings.restoreWorkspace}
                    label="마지막 작업 공간 복원"
                    onChange={event =>
                      updateAppSettings({
                        restoreWorkspace: event.currentTarget.checked,
                      })
                    }
                  />
                  <Switch
                    checked={props.appSettings.autoCheckUpdates}
                    label="업데이트 자동 확인"
                    onChange={event =>
                      updateAppSettings({
                        autoCheckUpdates: event.currentTarget.checked,
                      })
                    }
                  />
                </Section>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="appearance">
              <Stack gap="lg">
                <Title order={2}>화면 및 편집기</Title>
                <Section title="테마">
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>{isDark ? '다크 모드' : '라이트 모드'}</Text>
                      <Text c="dimmed" size="sm">
                        기존 Subnota 테마 설정과 동일하게 저장됩니다.
                      </Text>
                    </div>
                    <ActionIcon
                      aria-label="테마 전환"
                      onClick={toggleTheme}
                      radius="xl"
                      size={42}
                      variant="light"
                    >
                      {isDark ? <MoonStarIcon /> : <SunIcon />}
                    </ActionIcon>
                  </Group>
                </Section>
                <Section title="편집기 타이포그래피">
                  <Group align="end" grow>
                    <Stack gap={6}>
                      <Text fw={500} size="sm">글자 크기</Text>
                      <Slider
                        label={value => `${value}px`}
                        min={12}
                        max={24}
                        onChange={fontSize => updateAppSettings({ fontSize })}
                        value={props.appSettings.fontSize}
                      />
                    </Stack>
                    <NumberInput
                      max={24}
                      min={12}
                      onChange={value =>
                        typeof value === 'number' &&
                        updateAppSettings({ fontSize: value })
                      }
                      suffix=" px"
                      value={props.appSettings.fontSize}
                    />
                  </Group>
                  <Stack gap={6}>
                    <Text fw={500} size="sm">줄 간격</Text>
                    <Slider
                      label={value => value.toFixed(1)}
                      min={1.2}
                      max={2.2}
                      step={0.1}
                      onChange={lineHeight => updateAppSettings({ lineHeight })}
                      value={props.appSettings.lineHeight}
                    />
                  </Stack>
                </Section>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="sync">
              <Stack gap="lg">
                <Title order={2}>동기화 및 저장소</Title>
                <Section title="동기화 상태">
                  <Group justify="space-between">
                    <Group>
                      <Badge color={props.isOnline ? 'green' : 'gray'} variant="light">
                        {props.isOnline ? '온라인' : '오프라인'}
                      </Badge>
                      {props.isSyncing && <Badge color="blue">동기화 중</Badge>}
                    </Group>
                    <Button
                      disabled={!props.isSignedIn || !props.isOnline}
                      loading={props.isSyncing}
                      onClick={props.onSync}
                      variant="light"
                    >
                      지금 동기화
                    </Button>
                  </Group>
                  <Group grow>
                    <Paper bg="var(--mantine-color-default-hover)" p="md" radius="lg">
                      <Text c="dimmed" size="xs">마지막 동기화</Text>
                      <Text fw={600} mt={4}>
                        {props.lastSyncAt
                          ? new Date(props.lastSyncAt).toLocaleString()
                          : '기록 없음'}
                      </Text>
                    </Paper>
                    <Paper bg="var(--mantine-color-default-hover)" p="md" radius="lg">
                      <Text c="dimmed" size="xs">동기화 큐</Text>
                      <Group gap="xs" mt={4}>
                        <Badge color="yellow" variant="light">
                          대기 {props.pendingSyncCount}
                        </Badge>
                        <Badge color="red" variant="light">
                          실패 {props.failedSyncCount}
                        </Badge>
                      </Group>
                    </Paper>
                  </Group>
                </Section>
                <Section
                  description="위치를 변경하면 데이터베이스를 새 폴더로 복사한 뒤 앱 화면을 다시 불러옵니다."
                  title="로컬 저장소"
                >
                  <TextInput
                    label="SQLite 데이터베이스"
                    readOnly
                    value={props.storageInfo?.databasePath ?? '불러오는 중…'}
                  />
                  <Group justify="space-between">
                    <Text c="dimmed" size="sm">
                      사용량 {formatBytes(props.storageInfo?.size ?? 0)}
                    </Text>
                    <Group>
                      <Button
                        onClick={() =>
                          void run(props.onChooseStorage, '저장소 위치를 변경했습니다.')
                        }
                        variant="default"
                      >
                        위치 변경
                      </Button>
                      <Button
                        onClick={() =>
                          void run(props.onOpenStorage, '저장소 폴더를 열었습니다.')
                        }
                        variant="light"
                      >
                        폴더 열기
                      </Button>
                    </Group>
                  </Group>
                </Section>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="backup">
              <Stack gap="lg">
                <Title order={2}>백업 및 데이터</Title>
                <Section
                  description="메모, 일정, Inbox가 포함된 SQLite 백업 파일을 생성하거나 복원합니다."
                  title="전체 백업"
                >
                  <Group>
                    <Button
                      loading={isWorking}
                      onClick={() =>
                        void run(props.onBackup, '전체 백업을 생성했습니다.')
                      }
                    >
                      전체 데이터 백업
                    </Button>
                    <FileButton
                      accept=".sqlite3"
                      onChange={file => {
                        if (file) {
                          void run(
                            () => props.onRestore(file),
                            '백업을 복원했습니다.',
                          );
                        }
                      }}
                    >
                      {fileButtonProps => (
                        <Button {...fileButtonProps} color="orange" variant="light">
                          백업 파일 복원
                        </Button>
                      )}
                    </FileButton>
                  </Group>
                </Section>
                <Section title="JSON 내보내기">
                  <Group>
                    <Button
                      onClick={() =>
                        void run(
                          () => props.onExportJson('subnota-calendar', props.scheduleData),
                          '일정 데이터를 내보냈습니다.',
                        )
                      }
                      variant="default"
                    >
                      전체 일정 내보내기
                    </Button>
                    <Button
                      onClick={() =>
                        void run(
                          () => props.onExportJson('subnota-inbox', props.inboxData),
                          'Inbox 데이터를 내보냈습니다.',
                        )
                      }
                      variant="default"
                    >
                      Inbox 내보내기
                    </Button>
                  </Group>
                </Section>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="hotkeys">
              <Stack gap="lg">
                <Title order={2}>단축키</Title>
                <Section title="앱 단축키">
                  <Table verticalSpacing="sm">
                    <Table.Tbody>
                      {APP_HOTKEYS.map(item => (
                        <Table.Tr key={item.accelerator}>
                          <Table.Td>{item.label}</Table.Td>
                          <Table.Td ta="right">
                            <Hotkey value={item.accelerator} />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Section>
                <Section
                  description="아래 3개는 운영체제에 등록되는 글로벌 단축키입니다."
                  title="글로벌 단축키"
                >
                  {EDITABLE_SHORTCUTS.map(item => (
                    <Group justify="space-between" key={item.field}>
                      <Text>{item.label}</Text>
                      <TextInput
                        onChange={event =>
                          setShortcutDraft(current => ({
                            ...current,
                            [item.field]: event.currentTarget.value,
                          }))
                        }
                        value={shortcutDraft[item.field]}
                        w={240}
                      />
                    </Group>
                  ))}
                  <Divider />
                  <Group justify="flex-end">
                    <Button
                      onClick={() =>
                        void run(async () => {
                          await props.onResetShortcuts();
                          setShortcutDraft(DEFAULT_SHORTCUT_SETTINGS);
                        }, '기본 단축키로 복원했습니다.')
                      }
                      variant="default"
                    >
                      기본값 복원
                    </Button>
                    <Button
                      onClick={() =>
                        void run(
                          () => props.onSaveShortcuts(shortcutDraft),
                          '단축키를 저장했습니다.',
                        )
                      }
                    >
                      단축키 저장
                    </Button>
                  </Group>
                </Section>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="account">
              <Stack gap="lg">
                <Title order={2}>계정</Title>
                <Section title="내 계정">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>{props.email ?? '로그인되지 않음'}</Text>
                      <Text c="dimmed" size="sm">
                        {PROVIDER_LABELS[props.provider ?? 'email'] ??
                          props.provider ??
                          '이메일'}{' '}
                        로그인
                      </Text>
                    </div>
                    {props.isSignedIn && (
                      <Badge color="green" variant="light">연결됨</Badge>
                    )}
                  </Group>
                  <Group>
                    <Button
                      disabled={!props.isSignedIn || !props.email}
                      onClick={() =>
                        void run(
                          props.onPasswordReset,
                          '비밀번호 재설정 메일을 보냈습니다.',
                        )
                      }
                      variant="default"
                    >
                      비밀번호 재설정
                    </Button>
                    <Button
                      color="red"
                      disabled={!props.isSignedIn}
                      onClick={props.onSignOut}
                      variant="light"
                    >
                      로그아웃
                    </Button>
                  </Group>
                </Section>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="about">
              <Stack gap="lg">
                <Title order={2}>정보</Title>
                <Section title="Subnota">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>버전 {__APP_VERSION__}</Text>
                      <Text c="dimmed" size="sm">
                        로컬 우선 메모·일정 워크스페이스
                      </Text>
                    </div>
                    <Button
                      onClick={() =>
                        void run(async () => {
                          const message = await props.onCheckUpdates();
                          setFeedback(message);
                        }, '업데이트 확인을 완료했습니다.')
                      }
                      variant="light"
                    >
                      업데이트 확인
                    </Button>
                  </Group>
                </Section>
              </Stack>
            </Tabs.Panel>

            {feedback && (
              <Text c="dimmed" mt="lg" role="status" size="sm">
                {feedback}
              </Text>
            )}
          </ScrollArea>
        </Box>
      </Tabs>
    </Modal>
  );
}
