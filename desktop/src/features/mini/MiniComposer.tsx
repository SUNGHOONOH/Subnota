import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ActionIcon, Kbd, Tooltip, UnstyledButton } from '@mantine/core';
import { ExternalLink } from '@/components/icons';

import { createUuid } from '../../lib/contentHash';
import { MINI_SUBNOTA_CATEGORY } from '../../lib/memoCategory';
import {
  APP_SHORTCUT_FIELDS,
  APP_SHORTCUT_LABELS,
  SHORTCUT_LABELS,
  ShortcutSettings,
  findShortcutConflicts,
  keyboardEventToAccelerator,
  loadAppShortcutSettings,
  loadShortcutSettings,
  saveShortcutSettings,
} from '../../lib/shortcutSettings';
import {
  getLocalWorkspaceOwner,
  upsertLocalMemo,
} from '../../services/local/offlineStore';
import './MiniComposer.scss';

const MINI_DRAFT_KEY = 'subnota.miniComposer.draft.v1';

const miniDraftKey = () => {
  const ownerId = getLocalWorkspaceOwner();
  return `${MINI_DRAFT_KEY}.${ownerId ? `user.${ownerId}` : 'guest'}`;
};

interface MiniRecentInboxItem {
  title: string;
  url: string;
  sourceLabel: string;
}

const MINI_SHORTCUTS: {
  field: 'toggleMini' | 'capturePage';
  label: string;
}[] = [
  { field: 'toggleMini', label: 'Mini Subnota' },
  { field: 'capturePage', label: '웹페이지 저장' },
];

const renderAccelerator = (
  accelerator: string,
  platform: DesktopPlatformFeatures['platform'],
) =>
  accelerator
    .split('+')
    .map(token => token.trim())
    .filter(Boolean)
    .map((token, index) => (
      <Kbd key={`${token}-${index}`} size="xs">
        {formatAcceleratorToken(token, platform)}
      </Kbd>
    ));

const formatAcceleratorToken = (
  token: string,
  platform: DesktopPlatformFeatures['platform'],
) => {
  const normalized = token.toLowerCase();
  if (['cmd', 'command', 'meta'].includes(normalized)) return '⌘';
  if (['cmdorctrl', 'commandorcontrol'].includes(normalized)) {
    return platform === 'macos' ? '⌘' : 'Ctrl';
  }
  if (['control', 'ctrl'].includes(normalized)) {
    return platform === 'macos' ? '⌃' : 'Ctrl';
  }
  if (['alt', 'option'].includes(normalized)) {
    return platform === 'macos' ? '⌥' : 'Alt';
  }
  if (normalized === 'shift') return platform === 'macos' ? '⇧' : 'Shift';
  return token.toUpperCase();
};

const loadMiniDraft = () => {
  try {
    return window.localStorage.getItem(miniDraftKey()) ?? '';
  } catch {
    return '';
  }
};

const saveMiniDraft = (value: string) => {
  try {
    if (value) {
      window.localStorage.setItem(miniDraftKey(), value);
    } else {
      window.localStorage.removeItem(miniDraftKey());
    }
  } catch {
    // Draft persistence is best-effort; memo saving still works without it.
  }
};

// Compact quick-capture surface rendered inside the floating Mini Subnota panel
// window. Writes a local-first MiniSubnota memo and dismisses the panel.
const MiniComposer = () => {
  const platformFeatures = window.electronAPI?.getPlatformFeatures?.();
  const platform = platformFeatures?.platform ?? 'macos';
  const capturePageEnabled = platformFeatures?.captureShortcut !== false;
  const visibleShortcuts = capturePageEnabled
    ? MINI_SHORTCUTS
    : MINI_SHORTCUTS.filter(item => item.field !== 'capturePage');
  const showsRecentCaptures =
    platformFeatures?.recentCapturesInTray !== false;
  const [text, setText] = useState(loadMiniDraft);
  const [status, setStatus] = useState<string | null>(null);
  const [recentInboxItems, setRecentInboxItems] = useState<MiniRecentInboxItem[]>([]);
  const [shortcuts, setShortcuts] = useState(loadShortcutSettings);
  const [recordingField, setRecordingField] = useState<
    'toggleMini' | 'capturePage' | null
  >(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();

    const removePrefillListener = window.electronAPI?.onMiniPrefill?.((prefill) => {
      setText(prefill);
      saveMiniDraft(prefill);
      setStatus(null);
      requestAnimationFrame(() => {
        const element = textareaRef.current;
        if (element) {
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
        }
      });
    });
    const removeRecentInboxListener = showsRecentCaptures
      ? window.electronAPI?.onMiniRecentInbox?.((items) => {
          setRecentInboxItems(items.slice(0, 2));
        })
      : undefined;
    const removeStatusListener = window.electronAPI?.onMiniStatus?.((message) => {
      setStatus(message);
    });
    const removeShortcutListener =
      window.electronAPI?.onShortcutSettingsChanged?.((nextSettings) => {
        setShortcuts(saveShortcutSettings(nextSettings));
      });

    return () => {
      removePrefillListener?.();
      removeRecentInboxListener?.();
      removeStatusListener?.();
      removeShortcutListener?.();
    };
  }, [showsRecentCaptures]);

  // 녹화 중에는 OS 등록을 내린다. 켜 둔 채로는 현재 Mini 단축키를 누르는
  // 순간 창이 토글돼 버려서 자기 단축키를 다시 지정할 수 없다.
  // 창은 blur되면 숨겨지므로(mini-subnota.ts), 아래 blur 취소가 없으면
  // 단축키가 내려간 채 남아 Mini를 다시 열 수 없게 된다.
  useEffect(() => {
    if (!recordingField) {
      return undefined;
    }
    void window.electronAPI?.suspendGlobalShortcuts?.(true);
    return () => {
      void window.electronAPI?.suspendGlobalShortcuts?.(false);
    };
  }, [recordingField]);

  useEffect(() => {
    if (!recordingField) {
      return undefined;
    }

    const cancel = () => {
      setRecordingField(null);
      setStatus('단축키 변경을 취소했습니다.');
    };

    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        // 전파를 끊지 않으면 입력창의 Esc 처리가 이어 실행돼 Mini까지 닫힌다.
        event.stopPropagation();
        cancel();
        return;
      }

      const accelerator = keyboardEventToAccelerator(event, {
        requireModifier: true,
      });
      if (!accelerator) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const requested: ShortcutSettings = {
        ...shortcuts,
        [recordingField]: accelerator,
      };

      // 여기서 openSearch까지 함께 본다. 앱 내부 단축키라 OS 등록에는
      // 실패하지 않으므로, 막지 않으면 메모 검색이 조용히 죽는다.
      const appShortcuts = loadAppShortcutSettings();
      const reservedAppShortcuts = APP_SHORTCUT_FIELDS.map(field => ({
        accelerator: appShortcuts[field],
        label: APP_SHORTCUT_LABELS[field],
      }));
      const conflict = findShortcutConflicts(requested, {
        fields: capturePageEnabled
          ? ['toggleMini', 'capturePage', 'openSearch']
          : ['toggleMini', 'openSearch'],
        labels: SHORTCUT_LABELS,
        reserved: reservedAppShortcuts,
      })[recordingField];
      if (conflict) {
        setStatus(`'${conflict}'에 이미 할당된 조합입니다. 다른 조합을 눌러 주세요.`);
        return;
      }

      const changedField = recordingField;
      setRecordingField(null);

      void window.electronAPI
        ?.setGlobalShortcuts?.(requested)
        .then(result => {
          const accepted = saveShortcutSettings(result.settings);
          setShortcuts(accepted);
          setStatus(
            accepted[changedField] === accelerator
              ? '단축키를 변경했습니다.'
              : '단축키를 등록하지 못했습니다. 다른 조합을 사용해 주세요.',
          );
        })
        .catch(() => {
          setStatus('단축키를 등록하지 못했습니다. 다른 조합을 사용해 주세요.');
        });
    };

    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', handler, true);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', handler, true);
    };
  }, [capturePageEnabled, recordingField, shortcuts]);

  const changeText = (value: string) => {
    setText(value);
    saveMiniDraft(value);
  };

  const close = () => window.electronAPI?.closeMini?.();

  const save = async () => {
    const content = text.trim();
    if (!content) {
      setStatus('저장할 메모가 없습니다.');
      return;
    }
    const ownerId = getLocalWorkspaceOwner();
    if (!ownerId) {
      setStatus('메모를 저장하려면 먼저 메인 Subnota에서 로그인해 주세요.');
      return;
    }

    const now = new Date().toISOString();
    try {
      await upsertLocalMemo(
        {
          category: MINI_SUBNOTA_CATEGORY,
          content,
          created_at: now,
          id: createUuid(),
        },
        'pending',
        ownerId,
      );
    } catch {
      setStatus('로컬 저장에 실패했습니다. 다시 시도해 주세요.');
      return;
    }
    window.electronAPI?.notifyMiniSaved?.();
    setText('');
    saveMiniDraft('');
    close();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <div className="mini-composer">
      <header className="mini-composer__header">
        <span className="mini-composer__title">Mini Subnota</span>
        <div className="mini-composer__header-actions">
          <span className="mini-composer__hint">
            {platform === 'macos' ? '⌘↵' : 'Ctrl+Enter'} 저장 · Esc 닫기
          </span>
          <Tooltip label="Main Subnota 열기" openDelay={500} position="bottom">
            <ActionIcon
              aria-label="Main Subnota 열기"
              className="mini-composer__main-button"
              onClick={() => window.electronAPI?.showMainWindow?.()}
              size={28}
              variant="subtle"
            >
              <ExternalLink size={15} />
            </ActionIcon>
          </Tooltip>
        </div>
      </header>
      <textarea
        ref={textareaRef}
        aria-label="빠른 메모 입력"
        className="mini-composer__input"
        onChange={(event) => changeText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="떠오른 생각을 적어보세요…"
        value={text}
      />
      <section className="mini-composer__shortcuts" aria-label="전역 단축키">
        {visibleShortcuts.map(item => (
          <UnstyledButton
            className={
              recordingField === item.field
                ? 'mini-composer__shortcut recording'
                : 'mini-composer__shortcut'
            }
            key={item.field}
            onClick={() => {
              setRecordingField(current =>
                current === item.field ? null : item.field,
              );
              setStatus('새 단축키를 누르세요. Esc로 취소할 수 있습니다.');
            }}
          >
            <span>{item.label}</span>
            <span className="mini-composer__shortcut-keys">
              {recordingField === item.field ? (
                <em>입력 대기…</em>
              ) : (
                renderAccelerator(shortcuts[item.field], platform)
              )}
            </span>
          </UnstyledButton>
        ))}
      </section>
      {showsRecentCaptures && (
        <section className="mini-composer__recent" aria-label="최근 수집함">
          <div className="mini-composer__recent-title">최근 수집함</div>
          {recentInboxItems.length > 0 ? (
            <div className="mini-composer__recent-list">
              {recentInboxItems.map((item) => (
                <button
                  className="mini-composer__recent-item"
                  key={item.url}
                  onClick={() => void window.electronAPI?.openExternal?.(item.url)}
                  title={item.title || item.url}
                  type="button"
                >
                  <span className="mini-composer__recent-source">
                    {item.sourceLabel || 'Link'}
                  </span>
                  <span className="mini-composer__recent-text">
                    {item.title || item.url}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mini-composer__recent-empty">아직 저장된 항목이 없습니다.</p>
          )}
        </section>
      )}
      <footer className="mini-composer__footer">
        <span className="mini-composer__status" role="status">
          {status}
        </span>
        <button className="mini-composer__save" onClick={save} type="button">
          메모 저장
        </button>
      </footer>
    </div>
  );
};

export default MiniComposer;
