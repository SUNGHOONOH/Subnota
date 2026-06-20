import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import {
  CommandLine,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  UserCircle,
  X,
} from '@/components/icons';

import {
  ShortcutSettings,
  keyboardEventToAccelerator,
} from '../../lib/shortcutSettings';

interface ShortcutSaveResult {
  capture: boolean;
  toggle: boolean;
}

interface SettingsModalProps {
  email?: string | null;
  provider?: string | null;
  isOpen: boolean;
  isSignedIn: boolean;
  isSyncing: boolean;
  onClose: () => void;
  onResetShortcuts: () => Promise<ShortcutSaveResult>;
  onSaveShortcuts: (settings: ShortcutSettings) => Promise<ShortcutSaveResult>;
  onSignOut: () => void;
  onSync: () => void;
  shortcuts: ShortcutSettings;
}

type SettingsSection = 'account' | 'shortcuts';

const SHORTCUT_ITEMS: { field: keyof ShortcutSettings; label: string }[] = [
  { field: 'toggleMini', label: 'Mini Subnota 열기' },
  { field: 'capturePage', label: '현재 페이지 저장' },
  { field: 'openSearch', label: '메모 검색' },
];

// Fixed editor formatting shortcuts (markdown). Read-only reference.
const FORMATTING_SHORTCUTS: { accelerator: string; label: string }[] = [
  { accelerator: 'CommandOrControl+B', label: '굵게' },
  { accelerator: 'CommandOrControl+I', label: '이탤릭' },
  { accelerator: 'CommandOrControl+U', label: '밑줄' },
  { accelerator: 'Shift+CommandOrControl+X', label: '취소선' },
  { accelerator: 'Alt+CommandOrControl+C', label: '코드 블록' },
  { accelerator: 'CommandOrControl+K', label: '링크 삽입' },
];

const ACCELERATOR_SYMBOLS: Record<string, string> = {
  alt: '⌥',
  cmd: '⌘',
  cmdorctrl: '⌘',
  command: '⌘',
  commandorcontrol: '⌘',
  control: '⌃',
  ctrl: '⌃',
  meta: '⌘',
  option: '⌥',
  shift: '⇧',
};

const renderAccelerator = (accelerator: string) =>
  accelerator
    .split('+')
    .map(token => token.trim())
    .filter(Boolean)
    .map((token, index) => (
      <kbd className="command-key" key={`${token}-${index}`}>
        {ACCELERATOR_SYMBOLS[token.toLowerCase()] ?? token.toUpperCase()}
      </kbd>
    ));

const PROVIDER_LABELS: Record<string, string> = {
  apple: 'Apple',
  google: 'Google',
  kakao: '카카오',
};

const GoogleMark = () => (
  <svg height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

const KakaoMark = () => (
  <svg fill="#3C1E1E" height="15" viewBox="0 0 24 24" width="15" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.707 4.8 4.27 6.054-.277.946-.997 3.425-1.144 3.945-.184.646.216.638.455.48 1.883-1.248 3.018-2.008 4.225-2.81 1.077.29 2.222.446 3.414.446 4.97 0 9-3.185 9-7.115C21 6.185 16.97 3 12 3z" />
  </svg>
);

const ProviderBadge = ({ provider }: { provider?: string | null }) => {
  if (provider === 'google') {
    return <span className="provider-badge"><GoogleMark /></span>;
  }
  if (provider === 'kakao') {
    return <span className="provider-badge kakao"><KakaoMark /></span>;
  }
  return <span className="provider-badge"><Mail size={15} /></span>;
};

const SettingsModal = ({
  email,
  provider,
  isOpen,
  isSignedIn,
  isSyncing,
  onClose,
  onResetShortcuts,
  onSaveShortcuts,
  onSignOut,
  onSync,
  shortcuts,
}: SettingsModalProps) => {
  const [section, setSection] = useState<SettingsSection>('account');
  const [draft, setDraft] = useState(shortcuts);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [recordingField, setRecordingField] = useState<
    keyof ShortcutSettings | null
  >(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDraft(shortcuts);
      setFeedback(null);
      setRecordingField(null);
      setQuery('');
    }
  }, [isOpen, shortcuts]);

  // While recording a shortcut, capture the next modifier combo from the window.
  useEffect(() => {
    if (!recordingField) {
      return undefined;
    }

    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setRecordingField(null);
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        return;
      }

      const accelerator = keyboardEventToAccelerator(event, {
        requireModifier: true,
      });
      if (!accelerator) {
        return;
      }

      event.preventDefault();
      setFeedback(null);
      setDraft(previous => ({ ...previous, [recordingField]: accelerator }));
      setRecordingField(null);
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recordingField]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredShortcuts = useMemo(
    () =>
      normalizedQuery
        ? SHORTCUT_ITEMS.filter(item =>
            item.label.toLowerCase().includes(normalizedQuery),
          )
        : SHORTCUT_ITEMS,
    [normalizedQuery],
  );
  const filteredFormatting = useMemo(
    () =>
      normalizedQuery
        ? FORMATTING_SHORTCUTS.filter(item =>
            item.label.toLowerCase().includes(normalizedQuery),
          )
        : FORMATTING_SHORTCUTS,
    [normalizedQuery],
  );

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);

    try {
      const result = await onSaveShortcuts(draft);
      setFeedback(
        result.capture && result.toggle
          ? '단축키를 저장했습니다.'
          : '일부 전역 단축키 등록에 실패했습니다. 다른 키 조합을 사용해 주세요.',
      );
    } catch {
      setFeedback('단축키를 저장하지 못했습니다. 다른 키 조합을 사용해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await onResetShortcuts();
      setFeedback(
        result.capture && result.toggle
          ? '기본 단축키로 되돌렸습니다.'
          : '기본 전역 단축키 등록에 실패했습니다.',
      );
    } catch {
      setFeedback('기본 단축키로 되돌리지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const providerLabel = provider ? PROVIDER_LABELS[provider] : null;
  const accountStatus = isSignedIn
    ? `${providerLabel ? `${providerLabel} · ` : ''}${email ?? '로그인됨'}`
    : '로그인이 되어있지 않습니다.';

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      withCloseButton={false}
      padding={0}
      size="auto"
      centered
      overlayProps={{ backgroundOpacity: 0.35 }}
      styles={{ content: { backgroundColor: 'transparent', boxShadow: 'none' } }}
    >
      <section aria-label="설정" className="settings-window" role="dialog">
        <aside className="settings-nav">
          <p className="settings-nav-heading">옵션</p>
          <button
            className={
              section === 'account'
                ? 'settings-nav-item active'
                : 'settings-nav-item'
            }
            onClick={() => setSection('account')}
            type="button"
          >
            <UserCircle size={18} />
            계정
          </button>
          <button
            className={
              section === 'shortcuts'
                ? 'settings-nav-item active'
                : 'settings-nav-item'
            }
            onClick={() => setSection('shortcuts')}
            type="button"
          >
            <CommandLine size={18} />
            단축키
          </button>
        </aside>

        <div className="settings-main">
          <header className="settings-main-header">
            <h2>{section === 'account' ? '계정' : '단축키'}</h2>
            <button
              aria-label="설정 닫기"
              className="icon-button"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </header>

          <div className="settings-main-body">
            {section === 'account' ? (
              <div className="settings-card">
                <div className="settings-card-row">
                  <div className="settings-account-id">
                    {isSignedIn && <ProviderBadge provider={provider} />}
                    <div>
                      <h3>내 계정</h3>
                      <p>{accountStatus}</p>
                    </div>
                  </div>
                  {isSignedIn ? (
                    <div className="settings-card-actions">
                      <button
                        className="secondary-button"
                        disabled={isSyncing}
                        onClick={onSync}
                        type="button"
                      >
                        <RefreshCw size={16} />
                        {isSyncing ? '동기화 중' : '동기화'}
                      </button>
                      <button
                        className="secondary-button"
                        onClick={onSignOut}
                        type="button"
                      >
                        <LogOut size={16} />
                        로그아웃
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="command-palette">
                <div className="command-input">
                  <Search size={16} />
                  <input
                    aria-label="단축키 검색"
                    onChange={event => setQuery(event.target.value)}
                    placeholder="단축키 검색"
                    value={query}
                  />
                </div>

                <div className="command-list">
                  {filteredShortcuts.length === 0 &&
                  filteredFormatting.length === 0 ? (
                    <p className="command-empty">일치하는 단축키가 없습니다.</p>
                  ) : (
                    <>
                      {filteredShortcuts.length > 0 && (
                        <>
                          <p className="command-group-label">전역 단축키</p>
                          {filteredShortcuts.map(item => (
                            <button
                              className={
                                recordingField === item.field
                                  ? 'command-item recording'
                                  : 'command-item'
                              }
                              key={item.field}
                              onClick={() =>
                                setRecordingField(current =>
                                  current === item.field ? null : item.field,
                                )
                              }
                              type="button"
                            >
                              <span className="command-item-label">{item.label}</span>
                              <span className="command-shortcut">
                                {recordingField === item.field ? (
                                  <em>키를 누르세요…</em>
                                ) : (
                                  renderAccelerator(draft[item.field])
                                )}
                              </span>
                            </button>
                          ))}
                        </>
                      )}

                      {filteredFormatting.length > 0 && (
                        <>
                          <p className="command-group-label">서식 (마크다운)</p>
                          {filteredFormatting.map(item => (
                            <div className="command-item static" key={item.label}>
                              <span className="command-item-label">{item.label}</span>
                              <span className="command-shortcut">
                                {renderAccelerator(item.accelerator)}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>

                {feedback && <p className="settings-feedback">{feedback}</p>}

                <div className="settings-actions">
                  <button
                    className="secondary-button"
                    disabled={isSaving}
                    onClick={() => void handleReset()}
                    type="button"
                  >
                    기본값
                  </button>
                  <button
                    className="primary-button"
                    disabled={isSaving}
                    onClick={() => void handleSave()}
                    type="button"
                  >
                    {isSaving ? '저장 중' : '저장'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </Modal>
  );
};

export default SettingsModal;
