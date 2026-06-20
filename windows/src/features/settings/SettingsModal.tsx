import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { Modal } from '@mantine/core';
import { LogOut, Settings, X } from '@/components/icons';

import {
  ShortcutSettings,
  keyboardEventToAccelerator,
} from '../../lib/shortcutSettings';

interface SettingsModalProps {
  email?: string | null;
  isOpen: boolean;
  isSignedIn: boolean;
  onClose: () => void;
  onResetShortcuts: () => Promise<void>;
  onSaveShortcuts: (settings: ShortcutSettings) => Promise<void>;
  onSignOut: () => void;
  shortcuts: ShortcutSettings;
}

const SettingsModal = ({
  email,
  isOpen,
  isSignedIn,
  onClose,
  onResetShortcuts,
  onSaveShortcuts,
  onSignOut,
  shortcuts,
}: SettingsModalProps) => {
  const [draft, setDraft] = useState(shortcuts);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(shortcuts);
      setFeedback(null);
    }
  }, [isOpen, shortcuts]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await onSaveShortcuts(draft);
      setFeedback('단축키를 저장했습니다.');
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
      await onResetShortcuts();
      setFeedback('기본 단축키로 되돌렸습니다.');
    } catch {
      setFeedback('기본 단축키로 되돌리지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const captureShortcut = (
    field: keyof ShortcutSettings,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
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
    setDraft(previous => ({ ...previous, [field]: accelerator }));
  };

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
      <section aria-label="설정" className="settings-modal" role="dialog">
        <header className="modal-titlebar">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>설정</h2>
          </div>
          <button aria-label="설정 닫기" className="icon-button" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        <div className="settings-section">
          <div>
            <h3>계정</h3>
            <p>
              {isSignedIn
                ? email ?? '로그인됨'
                : '로그인 필요'}
            </p>
          </div>
          {isSignedIn ? (
            <button className="secondary-button" onClick={onSignOut} type="button">
              <LogOut size={16} />
              로그아웃
            </button>
          ) : null}
        </div>

        <form className="settings-section shortcut-form" onSubmit={handleSubmit}>
          <div className="shortcut-form-heading">
            <div>
              <h3>단축키</h3>
              <p>직접 입력하거나 입력칸에서 조합키를 누릅니다.</p>
            </div>
            <Settings size={18} />
          </div>

          <label>
            <span>메모 검색</span>
            <input
              onKeyDown={event => captureShortcut('openSearch', event)}
              onChange={event =>
                setDraft(previous => ({ ...previous, openSearch: event.target.value }))
              }
              value={draft.openSearch}
            />
          </label>

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
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? '저장 중' : '저장'}
            </button>
          </div>
        </form>
      </section>
    </Modal>
  );
};

export default SettingsModal;
