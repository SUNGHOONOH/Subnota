import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { ExternalLink, X } from '@/components/icons';
import SubnotaMark from '../../components/SubnotaMark';

import { createUuid } from '../../lib/contentHash';
import { MINI_SUBNOTA_CATEGORY } from '../../lib/memoCategory';
import { joinNoteContent } from '../../lib/noteTitle';
import {
  loadShortcutSettings,
  saveShortcutSettings,
} from '../../lib/shortcutSettings';
import {
  getLocalWorkspaceOwner,
  upsertLocalMemo,
} from '../../services/local/offlineStore';
import './MiniComposer.scss';
import EmptyState from '../../components/EmptyState';
import { localize, useUiLanguage } from '../../lib/uiLanguage';

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

// 툴팁은 키캡을 그릴 수 없으니 같은 표기를 한 줄 문자열로 만든다.
const formatAcceleratorLabel = (
  accelerator: string,
  platform: DesktopPlatformFeatures['platform'],
) =>
  accelerator
    .split('+')
    .map(token => formatAcceleratorToken(token.trim(), platform))
    .filter(Boolean)
    .join(platform === 'macos' ? '' : '+');

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

const englishMiniStatus = (message: string) => {
  const known: Record<string, string> = {
    '현재 페이지를 확인하는 중입니다.': 'Checking the current page…',
    '링크를 담는 중입니다.': 'Saving link…',
    '현재 페이지 저장은 macOS에서만 지원됩니다.': 'Saving the current page is available on macOS only.',
    '웹페이지 주소만 저장할 수 있습니다. 브라우저 내부 페이지나 로컬 파일은 지원하지 않습니다.': 'Only web page addresses can be saved. Browser-internal pages and local files are not supported.',
    '링크와 메타데이터를 저장했습니다. 본문 요약은 제한적입니다.': 'Link and metadata saved. The page summary is limited.',
    '링크는 저장했습니다. 요약은 생성하지 못했습니다.': 'Link saved, but a summary could not be created.',
    '링크를 저장했습니다. 요약을 준비 중입니다.': 'Link saved. Preparing its summary.',
    '링크 저장함에 저장됨': 'Saved to Inbox',
  };
  if (known[message]) return known[message];
  if (message.startsWith('지원하는 브라우저의 현재 페이지를 찾지 못했습니다.')) {
    return 'Could not find the current page in a supported browser. Try Safari, Chrome, Arc, Edge, or Brave.';
  }
  if (message.startsWith('브라우저 정보를 가져오지 못했습니다')) {
    return 'Could not read the browser information.';
  }
  return message;
};

// Compact quick-capture surface rendered inside the floating Quick Subnota panel
// window. Writes a local-first MiniSubnota memo and dismisses the panel.
const MiniComposer = () => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const platformFeatures = window.electronAPI?.getPlatformFeatures?.();
  const platform = platformFeatures?.platform ?? 'macos';
  const capturePageEnabled = platformFeatures?.captureShortcut !== false;
  // 자동 조회가 되는 곳에서만 "현재" 페이지라고 말한다. Windows에서 그렇게
  // 부르면 앱이 보고 있는 페이지를 안다는 거짓 약속이 된다.
  const capturesCurrentPage =
    platformFeatures?.nativeCurrentPageCapture !== false;
  const showsRecentCaptures =
    platformFeatures?.recentCapturesInTray !== false;
  const [text, setText] = useState(loadMiniDraft);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [recentInboxItems, setRecentInboxItems] = useState<MiniRecentInboxItem[]>([]);
  // 단축키는 표시만 한다. 바꾸는 것은 설정의 ShortcutRecorder 담당 —
  // 캡처 창 안에서 전역 단축키를 재녹화하려면 등록을 잠시 내렸다 올려야 해서,
  // 그 왕복이 창의 절반과 버그 하나를 잡아먹고 있었다.
  const [shortcuts, setShortcuts] = useState(loadShortcutSettings);
  // null이면 링크 모드가 아니다. 빈 문자열은 "칸은 떠 있고 아직 안 넣음".
  // 클립보드로 미리 채우지 않는다 — 몇 시간 전에 복사한 것이 들어와 있으면
  // 사용자가 확인을 멈추고 엉뚱한 링크를 저장하게 된다.
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

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
    const removeModeListener = window.electronAPI?.onMiniMode?.(({ mode, status: modeStatus }) => {
      setLinkUrl(mode === 'link' ? '' : null);
      if (modeStatus) {
        setStatus(language === 'en' ? englishMiniStatus(modeStatus) : modeStatus);
      }
      if (mode === 'link') {
        requestAnimationFrame(() => linkInputRef.current?.focus());
      }
    });
    const removeStatusListener = window.electronAPI?.onMiniStatus?.((message) => {
      setStatus(language === 'en' ? englishMiniStatus(message) : message);
    });
    const removeShortcutListener =
      window.electronAPI?.onShortcutSettingsChanged?.((nextSettings) => {
        setShortcuts(saveShortcutSettings(nextSettings));
      });

    return () => {
      removeModeListener?.();
      removePrefillListener?.();
      removeRecentInboxListener?.();
      removeStatusListener?.();
      removeShortcutListener?.();
    };
  }, [language, showsRecentCaptures]);

  const changeText = (value: string) => {
    setText(value);
    saveMiniDraft(value);
    // 창은 blur돼도 숨기만 하고 언마운트되지 않아, 한 번 뜬 문구가 다음
    // 프리필까지 남는다. 다시 쓰기 시작했다면 그 문구는 이미 지난 일이다.
    setStatus(null);
  };

  const close = () => window.electronAPI?.closeMini?.();

  // 링크 저장은 메인 창의 수집함 경로를 그대로 탄다. Mini는 넘기기만 한다.
  const saveLink = () => {
    const url = (linkUrl ?? '').trim();
    if (!url) return;
    window.electronAPI?.saveMiniLink?.(url);
    setLinkUrl(null);
    close();
  };

  const save = async () => {
    // 저장 중 재진입은 같은 초안을 두 번 쓰게 만든다. 나머지 흐름은 그대로.
    if (isSaving) {
      return;
    }
    const content = text.trim();
    if (!content) {
      setStatus(t('저장할 메모가 없습니다.', 'There is no memo to save.'));
      return;
    }
    const ownerId = getLocalWorkspaceOwner();
    if (!ownerId) {
      setStatus(t('메모를 저장하려면 먼저 메인 Subnota에서 로그인해 주세요.', 'Sign in to the main Subnota app before saving a memo.'));
      return;
    }
    const activeOwnerId = await window.electronAPI?.getActiveWorkspaceOwner?.();
    if (activeOwnerId !== ownerId) {
      setStatus(t('계정을 확인할 수 없어 저장하지 않았습니다. 메인 Subnota를 열어 주세요.', 'Your account could not be verified, so this memo was not saved. Open the main Subnota app.'));
      return;
    }

    const now = new Date().toISOString();
    setSaving(true);
    try {
      await upsertLocalMemo(
        {
          category: MINI_SUBNOTA_CATEGORY,
          // 노트의 제목은 content 첫 줄이다. Mini는 제목 칸이 없는 한 장짜리
          // 입력이라, 그대로 저장하면 쓴 것이 전부 제목으로 들어간다.
          // 제목은 비우고 본문부터 시작한다.
          content: joinNoteContent('', content),
          created_at: now,
          id: createUuid(),
        },
        'pending',
        ownerId,
      );
    } catch {
      setStatus(t('로컬 저장에 실패했습니다. 다시 시도해 주세요.', 'Could not save on this device. Try again.'));
      return;
    } finally {
      setSaving(false);
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
        <Tooltip
          label={`${t('Quick Subnota 열고 닫기', 'Open or close Quick Subnota')} · ${formatAcceleratorLabel(shortcuts.toggleMini, platform)}`}
          openDelay={500}
          position="bottom-start"
        >
          <span className="mini-composer__brand">
            <SubnotaMark className="mini-composer__mark" size={15} />
            <span className="mini-composer__title">Quick Subnota</span>
          </span>
        </Tooltip>
        <div className="mini-composer__header-actions">
          <Tooltip label={t('Main Subnota 열기', 'Open main Subnota')} openDelay={500} position="bottom">
            <ActionIcon
              aria-label={t('Main Subnota 열기', 'Open main Subnota')}
              className="mini-composer__main-button"
              onClick={() => window.electronAPI?.showMainWindow?.()}
              size={28}
              variant="subtle"
            >
              <ExternalLink size={15} />
            </ActionIcon>
          </Tooltip>
          {/* Esc만 두면 마우스로 쓰던 사람은 닫을 방법이 없다. 단축키는
              툴팁으로 알리고, 버튼은 손이 마우스에 있을 때의 길로 남긴다. */}
          <Tooltip label={t('닫기', 'Close') + ' · Esc'} openDelay={500} position="bottom">
            <ActionIcon
              aria-label={t('닫기', 'Close')}
              className="mini-composer__close-button"
              onClick={close}
              size={28}
              variant="subtle"
            >
              <X size={15} />
            </ActionIcon>
          </Tooltip>
        </div>
      </header>
      {linkUrl !== null && (
        <div className="mini-composer__link">
          <input
            ref={linkInputRef}
            aria-label={t('저장할 링크', 'Link to save')}
            className="mini-composer__link-input"
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveLink();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setLinkUrl(null);
              }
            }}
            placeholder={t('링크 붙여넣기', 'Paste a link')}
            type="url"
            value={linkUrl}
          />
          <div className="mini-composer__link-actions">
            <button
              className="mini-composer__secondary"
              onClick={() => setLinkUrl(null)}
              type="button"
            >
              {t('취소', 'Cancel')}
            </button>
            <button
              className="mini-composer__save"
              disabled={linkUrl.trim().length === 0}
              onClick={saveLink}
              type="button"
            >
              {t('저장', 'Save')}
            </button>
          </div>
        </div>
      )}
      <textarea
        ref={textareaRef}
        aria-label={t('빠른 메모 입력', 'Quick memo input')}
        className="mini-composer__input"
        onChange={(event) => changeText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('떠오른 생각을 적어보세요…', 'Write down what is on your mind…')}
        value={text}
      />
      <section
        className="mini-composer__recent"
        aria-label={showsRecentCaptures ? t('최근 링크', 'Recent links') : undefined}
      >
        {/* 두 저장 동작은 최근 링크 머리글과 같은 줄, 오른쪽 끝에 선다.
            머리글은 최근 링크를 내보내지 않는 플랫폼에서 빠지지만 이 줄
            자체는 남는다 — 여기 버튼이 사라지면 저장할 방법이 없어진다. */}
        <div className="mini-composer__recent-head">
          {showsRecentCaptures && (
            <div className="mini-composer__recent-title">{t('최근 링크', 'Recent links')}</div>
          )}
          <div className="mini-composer__actions">
            {capturePageEnabled && (
              <Tooltip
                label={`${capturesCurrentPage ? t('현재 페이지 저장', 'Save current page') : t('페이지 저장', 'Save a page')} · ${formatAcceleratorLabel(shortcuts.capturePage, platform)}`}
                openDelay={400}
                position="bottom"
              >
                <button
                  className="mini-composer__secondary"
                  onClick={() => window.electronAPI?.captureCurrentPage?.()}
                  type="button"
                >
                  {capturesCurrentPage
                    ? t('현재 페이지 저장', 'Save current page')
                    : t('페이지 저장', 'Save a page')}
                </button>
              </Tooltip>
            )}
            <Tooltip
              label={`${t('메모 저장', 'Save memo')} · ${platform === 'macos' ? '⌘↵' : 'Ctrl+Enter'}`}
              openDelay={400}
              position="bottom"
            >
              <button
                className="mini-composer__save"
                disabled={isSaving}
                onClick={save}
                type="button"
              >
                {t('메모 저장', 'Save memo')}
              </button>
            </Tooltip>
          </div>
        </div>
        {showsRecentCaptures &&
          (recentInboxItems.length > 0 ? (
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
            <EmptyState
              size="inline"
              title={t('아직 저장된 링크가 없습니다', 'No saved links yet')}
              tone="start"
            />
          ))}
      </section>
      {/* 상태는 버튼과 자리를 다투지 않도록 제 줄을 갖는다. 예전에는 한 줄
          안에서 ellipsis로 잘려, 정작 조치가 필요한 충돌·실패 문구가 안 보였다.
          로컬 저장은 보통 한 프레임이면 끝나므로 "저장 중…"은 400ms 뒤에야
          CSS로 드러난다 — 빠른 저장에서는 사실상 보이지 않는다. */}
      <p className="mini-composer__status" role="status">
        {isSaving ? (
          <em className="mini-composer__saving">{t('저장 중…', 'Saving…')}</em>
        ) : (
          status
        )}
      </p>
    </div>
  );
};

export default MiniComposer;
