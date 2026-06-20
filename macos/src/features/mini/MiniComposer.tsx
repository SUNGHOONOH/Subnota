import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ActionIcon, Kbd, Tooltip, UnstyledButton } from '@mantine/core';
import { ExternalLink } from '@/components/icons';

import { createUuid } from '../../lib/contentHash';
import { MINI_SUBNOTA_CATEGORY } from '../../lib/memoCategory';
import {
  ShortcutSettings,
  keyboardEventToAccelerator,
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
      <Kbd key={`${token}-${index}`} size="xs">
        {ACCELERATOR_SYMBOLS[token.toLowerCase()] ?? token.toUpperCase()}
      </Kbd>
    ));

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
    const removeRecentInboxListener = window.electronAPI?.onMiniRecentInbox?.((items) => {
      setRecentInboxItems(items.slice(0, 2));
    });
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
  }, []);

  useEffect(() => {
    if (!recordingField) {
      return undefined;
    }

    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setRecordingField(null);
        setStatus('단축키 변경을 취소했습니다.');
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

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recordingField, shortcuts]);

  const changeText = (value: string) => {
    setText(value);
    saveMiniDraft(value);
  };

  const close = () => window.electronAPI?.closeMini?.();

  const save = () => {
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
    upsertLocalMemo(
      {
        category: MINI_SUBNOTA_CATEGORY,
        content,
        created_at: now,
        id: createUuid(),
      },
      'pending',
      ownerId,
    );
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
      save();
    }
  };

  return (
    <div className="mini-composer">
      <header className="mini-composer__header">
        <span className="mini-composer__title">Mini Subnota</span>
        <div className="mini-composer__header-actions">
          <span className="mini-composer__hint">⌘↵ 저장 · Esc 닫기</span>
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
        {MINI_SHORTCUTS.map(item => (
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
                renderAccelerator(shortcuts[item.field])
              )}
            </span>
          </UnstyledButton>
        ))}
      </section>
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
                <span className="mini-composer__recent-text">{item.title || item.url}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mini-composer__recent-empty">아직 저장된 항목이 없습니다.</p>
        )}
      </section>
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
