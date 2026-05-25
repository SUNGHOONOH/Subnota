import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  CalendarDays,
  Download,
  LogOut,
  NotebookText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import AuthScreen from '../features/auth/AuthScreen';
import BriefingWorkspace from '../features/briefing/BriefingWorkspace';
import CalendarWorkspace from '../features/calendar/CalendarWorkspace';
import MemoWorkspace from '../features/memo/MemoWorkspace';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import {
  AMBIENT_COOLDOWN_MS,
  AMBIENT_IDLE_DELAY_MS,
  AMBIENT_MAX_RESULT_COUNT,
  AMBIENT_MIN_CHARS,
} from '../lib/constants';
import { createUuid, hashText } from '../lib/contentHash';
import { parseDates } from '../lib/dateParser';
import { getCursorChunkWindow, MemoChunk } from '../lib/memoChunker';
import {
  NetworkSearchResult,
  searchCursorNetwork,
} from '../services/backend/networkService';
import {
  archiveMemo,
  deleteCalendarBlock,
  ensureProfile,
  fetchBriefings,
  fetchCalendarBlocks,
  fetchMemos,
  fetchScheduleInbox,
  fetchTopicMap,
  getSession,
  signOut,
  updateScheduleInboxStatus,
  upsertCalendarBlock,
  upsertMemo,
} from '../services/supabase/data';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import {
  BriefingRow,
  CalendarBlockRow,
  MemoRow,
  ScheduleInboxRow,
  TabKey,
  TopicCluster,
  TopicMemoEdge,
  TopicMembership,
} from '../types';

const SAVE_DELAY_MS = 900;

const getMemoTitle = (content: string) => {
  const firstLine = content
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return '새 메모';
  }

  return firstLine.length > 28 ? `${firstLine.slice(0, 28).trimEnd()}...` : firstLine;
};

const App = () => {
  const [activeMemoCreatedAt, setActiveMemoCreatedAt] = useState(
    new Date().toISOString(),
  );
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('memo');
  const [ambientQueryChunk, setAmbientQueryChunk] = useState<MemoChunk | null>(
    null,
  );
  const [ambientResult, setAmbientResult] = useState<NetworkSearchResult | null>(
    null,
  );
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlockRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setBooting] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [memos, setMemos] = useState<MemoRow[]>([]);
  const [memoDraft, setMemoDraft] = useState('');
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [networkQueryChunk, setNetworkQueryChunk] = useState<MemoChunk | null>(
    null,
  );
  const [networkResults, setNetworkResults] = useState<NetworkSearchResult[]>(
    [],
  );
  const [scheduleInbox, setScheduleInbox] = useState<ScheduleInboxRow[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>(
    'idle',
  );
  const [session, setSession] = useState<Session | null>(null);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [selectionStart, setSelectionStart] = useState(0);
  const [topicClusters, setTopicClusters] = useState<TopicCluster[]>([]);
  const [topicEdges, setTopicEdges] = useState<TopicMemoEdge[]>([]);
  const [topicMemberships, setTopicMemberships] = useState<TopicMembership[]>(
    [],
  );
  const { canInstall, install, isInstalled } = useInstallPrompt();
  const activeMemoIdRef = useRef<string | null>(null);
  const lastAmbientHashRef = useRef<string | null>(null);
  const lastAmbientRequestAtRef = useRef(0);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    activeMemoIdRef.current = activeMemoId;
  }, [activeMemoId]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const activeMemo = useMemo(
    () => memos.find(memo => memo.id === activeMemoId) ?? null,
    [activeMemoId, memos],
  );
  const dateMatches = useMemo(() => {
    const baseTimestamp = activeMemo?.created_at
      ? new Date(activeMemo.created_at).getTime()
      : new Date(activeMemoCreatedAt).getTime();

    return parseDates(memoDraft, baseTimestamp);
  }, [activeMemo?.created_at, activeMemoCreatedAt, memoDraft]);
  const selectedText = useMemo(() => {
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);

    return memoDraft.slice(start, end).trim();
  }, [memoDraft, selectionEnd, selectionStart]);

  const loadWorkspace = useCallback(
    async (
      targetSession?: Session | null,
      options: { quiet?: boolean } = {},
    ) => {
      const currentSession = targetSession ?? sessionRef.current;

      if (!currentSession) {
        return;
      }

      if (!options.quiet) {
        setRefreshing(true);
      }
      setError(null);

      try {
        await ensureProfile(currentSession.user.id);
        const [nextMemos, nextBlocks, nextInbox, nextBriefings] =
          await Promise.all([
            fetchMemos(currentSession),
            fetchCalendarBlocks(currentSession),
            fetchScheduleInbox(currentSession),
            fetchBriefings(currentSession),
          ]);
        const nextTopicMap = await fetchTopicMap(currentSession).catch(() => ({
          clusters: [],
          edges: [],
          memberships: [],
        }));

        setMemos(nextMemos);
        setCalendarBlocks(nextBlocks);
        setScheduleInbox(nextInbox);
        setBriefings(nextBriefings);
        setTopicClusters(nextTopicMap.clusters);
        setTopicEdges(nextTopicMap.edges);
        setTopicMemberships(nextTopicMap.memberships);

        if (!activeMemoIdRef.current && nextMemos[0]) {
          setActiveMemoId(nextMemos[0].id);
          setMemoDraft(nextMemos[0].content);
          setActiveMemoCreatedAt(nextMemos[0].created_at);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '데이터를 불러오지 못했습니다.');
      } finally {
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    getSession()
      .then(nextSession => {
        if (!mounted) {
          return;
        }
        setSession(nextSession);
        sessionRef.current = nextSession;
        if (nextSession) {
          void loadWorkspace(nextSession, { quiet: true });
        }
      })
      .catch(caught => {
        setError(caught instanceof Error ? caught.message : '세션 확인에 실패했습니다.');
      })
      .finally(() => {
        if (mounted) {
          setBooting(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      sessionRef.current = nextSession;
      if (nextSession) {
        void loadWorkspace(nextSession, { quiet: true });
      } else {
        setMemos([]);
        setCalendarBlocks([]);
        setScheduleInbox([]);
        setBriefings([]);
        setTopicClusters([]);
        setTopicEdges([]);
        setTopicMemberships([]);
        setActiveMemoId(null);
        setMemoDraft('');
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadWorkspace]);

  useEffect(() => {
    if (!session || !activeMemoId || !memoDraft.trim()) {
      setSaveState('idle');
      return;
    }

    if (activeMemo?.content === memoDraft) {
      setSaveState('saved');
      return;
    }

    setSaveState('saving');
    const timeout = window.setTimeout(() => {
      upsertMemo(session, {
        content: memoDraft,
        createdAt: activeMemo?.created_at ?? activeMemoCreatedAt,
        id: activeMemoId,
      })
        .then(savedMemo => {
          if (!savedMemo) {
            return;
          }

          setMemos(previous => {
            const exists = previous.some(memo => memo.id === savedMemo.id);
            const merged = exists
              ? previous.map(memo => (memo.id === savedMemo.id ? savedMemo : memo))
              : [savedMemo, ...previous];

            return merged.sort(
              (a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            );
          });
          setActiveMemoCreatedAt(savedMemo.created_at);
          setSaveState('saved');
        })
        .catch(() => {
          setSaveState('failed');
        });
    }, SAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [activeMemo, activeMemoCreatedAt, activeMemoId, memoDraft, session]);

  useEffect(() => {
    setAmbientQueryChunk(null);
    setAmbientResult(null);

    if (!session || memoDraft.trim().length < AMBIENT_MIN_CHARS) {
      return;
    }

    const queryChunk = getCursorChunkWindow(memoDraft, selectionStart, 0).center;

    if (!queryChunk || queryChunk.text.trim().length < AMBIENT_MIN_CHARS) {
      return;
    }

    const chunkHash = hashText(`${activeMemoId ?? 'draft'}:${queryChunk.text}`);
    const now = Date.now();

    if (
      lastAmbientHashRef.current === chunkHash ||
      now - lastAmbientRequestAtRef.current < AMBIENT_COOLDOWN_MS
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      lastAmbientHashRef.current = chunkHash;
      lastAmbientRequestAtRef.current = Date.now();

      searchCursorNetwork({
        cursorIndex: selectionStart,
        limit: AMBIENT_MAX_RESULT_COUNT,
        memoId: activeMemoId,
        text: memoDraft,
      })
        .then(result => {
          if (result.results[0]) {
            setAmbientQueryChunk(result.queryChunk);
            setAmbientResult(result.results[0]);
          }
        })
        .catch(() => {
          setAmbientQueryChunk(null);
          setAmbientResult(null);
        });
    }, AMBIENT_IDLE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [activeMemoId, memoDraft, selectionStart, session]);

  const startNewMemo = () => {
    const now = new Date().toISOString();
    setActiveMemoId(createUuid());
    setActiveMemoCreatedAt(now);
    setMemoDraft('');
    setAmbientQueryChunk(null);
    setAmbientResult(null);
    setNetworkError(null);
    setNetworkQueryChunk(null);
    setNetworkResults([]);
    setSelectionEnd(0);
    setSelectionStart(0);
    setActiveTab('memo');
    setSaveState('idle');
  };

  const changeMemoDraft = (value: string) => {
    if (!activeMemoId && value.trim()) {
      setActiveMemoId(createUuid());
      setActiveMemoCreatedAt(new Date().toISOString());
    }

    setMemoDraft(value);
    setAmbientQueryChunk(null);
    setAmbientResult(null);
    setNetworkError(null);
    setNetworkQueryChunk(null);
    setNetworkResults([]);
  };

  const selectMemo = (memo: MemoRow) => {
    setActiveMemoId(memo.id);
    setActiveMemoCreatedAt(memo.created_at);
    setMemoDraft(memo.content);
    setAmbientQueryChunk(null);
    setAmbientResult(null);
    setNetworkError(null);
    setNetworkQueryChunk(null);
    setNetworkResults([]);
    setSelectionEnd(0);
    setSelectionStart(0);
    setActiveTab('memo');
  };

  const selectMemoById = (memoId: string) => {
    const targetMemo = memos.find(memo => memo.id === memoId);

    if (targetMemo) {
      selectMemo(targetMemo);
    }
  };

  const selectTextRange = (start: number, end: number) => {
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  const removeActiveMemo = async () => {
    if (!session || !activeMemoId) {
      return;
    }

    const shouldRemove = window.confirm('이 메모를 삭제하시겠습니까?');
    if (!shouldRemove) {
      return;
    }

    if (activeMemo) {
      await archiveMemo(session, activeMemo.id);
      const nextMemos = memos.filter(memo => memo.id !== activeMemo.id);
      setMemos(nextMemos);
      const nextActive = nextMemos[0] ?? null;
      setActiveMemoId(nextActive?.id ?? null);
      setMemoDraft(nextActive?.content ?? '');
      setActiveMemoCreatedAt(nextActive?.created_at ?? new Date().toISOString());
    } else {
      setActiveMemoId(null);
      setMemoDraft('');
    }
  };

  const saveCalendarBlock = async (draft: {
    allDay: boolean;
    color: string;
    id?: string;
    note: string | null;
    order?: number;
    startDate: string;
    title: string;
  }) => {
    if (!session) {
      return;
    }

    const block = await upsertCalendarBlock(session, {
      ...draft,
      id: draft.id ?? createUuid(),
    });
    setCalendarBlocks(previous => {
      const exists = previous.some(item => item.id === block.id);
      return exists
        ? previous.map(item => (item.id === block.id ? block : item))
        : [...previous, block];
    });
  };

  const registerSelectionSchedule = async () => {
    if (!session || !selectedText.trim()) {
      return;
    }

    const selectedMatch = parseDates(selectedText, Date.now())[0];
    const containedMatch =
      selectedMatch ??
      dateMatches.find(match => {
        const start = Math.min(selectionStart, selectionEnd);
        const end = Math.max(selectionStart, selectionEnd);

        return match.index >= start && match.index + match.length <= end;
      });

    if (!containedMatch) {
      window.alert('선택한 문장 안에 날짜 표현이 필요합니다.');
      return;
    }

    await saveCalendarBlock({
      allDay:
        containedMatch.date.getHours() === 0 &&
        containedMatch.date.getMinutes() === 0,
      color: '#66705A',
      note: selectedText,
      startDate: containedMatch.date.toISOString(),
      title: selectedText,
    });
    window.alert('일정이 등록되었습니다.');
  };

  const openNetwork = async () => {
    if (!session) {
      return;
    }

    setNetworkError(null);
    setNetworkQueryChunk(getCursorChunkWindow(memoDraft, selectionStart, 0).center);
    setNetworkResults([]);

    try {
      const result = await searchCursorNetwork({
        cursorIndex: selectionStart,
        limit: 5,
        memoId: activeMemoId,
        text: memoDraft,
      });
      setNetworkQueryChunk(result.queryChunk);
      setNetworkResults(result.results);
      if (result.message && result.results.length === 0) {
        setNetworkError(result.message);
      }
    } catch (caught) {
      setNetworkError(
        caught instanceof Error
          ? caught.message
          : '네트워크 검색에 실패했습니다.',
      );
    }
  };

  const removeCalendarBlock = async (blockId: string) => {
    if (!session || !window.confirm('블럭을 삭제하시겠습니까?')) {
      return;
    }

    await deleteCalendarBlock(session, blockId);
    setCalendarBlocks(previous => previous.filter(block => block.id !== blockId));
  };

  const acceptInboxItem = async (item: ScheduleInboxRow) => {
    if (!session) {
      return;
    }

    await saveCalendarBlock({
      allDay: Boolean(item.all_day),
      color: '#66705A',
      note: item.source_text,
      startDate: item.scheduled_at,
      title: item.title,
    });
    await updateScheduleInboxStatus(session, item.id, 'accepted');
    setScheduleInbox(previous => previous.filter(inbox => inbox.id !== item.id));
  };

  const dismissInboxItem = async (item: ScheduleInboxRow) => {
    if (!session) {
      return;
    }

    await updateScheduleInboxStatus(session, item.id, 'dismissed');
    setScheduleInbox(previous => previous.filter(inbox => inbox.id !== item.id));
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleInstall = async () => {
    if (canInstall) {
      await install();
      return;
    }

    window.alert(
      'Chrome/Edge에서는 주소창의 설치 버튼을 사용하세요. macOS Safari에서는 공유 메뉴 또는 파일 메뉴에서 Dock에 추가를 선택하면 됩니다.',
    );
  };

  if (!isSupabaseConfigured()) {
    return (
      <main className="auth-screen">
        <section className="auth-card standalone-card">
          <h1>환경변수 필요</h1>
          <p>
            <code>pwa/.env.local</code>에 Supabase URL과 anon key를
            설정해야 합니다.
          </p>
        </section>
      </main>
    );
  }

  if (isBooting) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">
          <Sparkles size={22} />
        </div>
        <p>Subnota를 여는 중입니다.</p>
      </main>
    );
  }

  if (!session) {
    return <AuthScreen onSignedIn={() => void loadWorkspace(undefined, { quiet: true })} />;
  }

  return (
    <div className="app-shell">
      <aside className="nav-rail">
        <div className="nav-brand">S</div>
        <button
          aria-label="메모"
          className={activeTab === 'memo' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('memo')}
        >
          <NotebookText size={22} />
          <span>메모</span>
        </button>
        <button
          aria-label="캘린더"
          className={activeTab === 'calendar' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('calendar')}
        >
          <CalendarDays size={22} />
          <span>캘린더</span>
        </button>
        <button
          aria-label="브리핑"
          className={activeTab === 'briefing' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('briefing')}
        >
          <Sparkles size={22} />
          <span>브리핑</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Desktop PWA</p>
            <h1>{activeTab === 'memo' ? '메모' : activeTab === 'calendar' ? '캘린더' : '브리핑'}</h1>
          </div>
          <div className="topbar-actions">
            {error && <span className="topbar-error">{error}</span>}
            <button
              className="ghost-button"
              disabled={isRefreshing}
              onClick={() => void loadWorkspace()}
              type="button"
            >
              <RefreshCw size={16} />
              {isRefreshing ? '동기화 중' : '동기화'}
            </button>
            {!isInstalled && (
              <button
                className="ghost-button"
                onClick={() => void handleInstall()}
                title={canInstall ? '데스크톱 앱으로 설치' : '브라우저 설치 조건을 기다리는 중'}
                type="button"
              >
                <Download size={16} />
                설치
              </button>
            )}
            <button className="ghost-button" onClick={handleSignOut} type="button">
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        </header>

        {activeTab === 'memo' && (
          <MemoWorkspace
            activeMemoId={activeMemoId}
            ambientQueryChunk={ambientQueryChunk}
            ambientResult={ambientResult}
            dateMatches={dateMatches}
            memoDraft={memoDraft}
            memos={memos}
            networkError={networkError}
            networkQueryChunk={networkQueryChunk}
            networkResults={networkResults}
            onChangeDraft={changeMemoDraft}
            onDeleteMemo={() => void removeActiveMemo()}
            onNewMemo={startNewMemo}
            onOpenNetwork={() => void openNetwork()}
            onRegisterSelectionSchedule={() => void registerSelectionSchedule()}
            onSelectMemo={selectMemo}
            onSelectMemoById={selectMemoById}
            onSelectRange={selectTextRange}
            saveState={saveState}
            selectedText={selectedText}
            title={getMemoTitle(memoDraft)}
            topicClusters={topicClusters}
            topicEdges={topicEdges}
            topicMemberships={topicMemberships}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarWorkspace
            blocks={calendarBlocks}
            onDeleteBlock={blockId => void removeCalendarBlock(blockId)}
            onSaveBlock={draft => void saveCalendarBlock(draft)}
          />
        )}

        {activeTab === 'briefing' && (
          <BriefingWorkspace
            briefings={briefings}
            inboxItems={scheduleInbox}
            onAcceptInbox={item => void acceptInboxItem(item)}
            onDismissInbox={item => void dismissInboxItem(item)}
          />
        )}
      </section>
    </div>
  );
};

export default App;
