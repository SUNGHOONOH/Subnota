import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createUuid, hashText, isUuid } from '../lib/contentHash';
import { categorizeMemo } from '../features/memo/model/categorizeMemo';
import { memoCalendarPersistStorage } from '../shared/storage/memoCalendarPersistStorage';

export type BrickTone = 'ink' | 'clay' | 'olive' | 'steel';
export type MemoSyncStatus = 'pending' | 'synced' | 'failed';
export type MemoScheduleScanStatus = 'pending' | 'scanned' | 'failed';
export type CalendarSyncStatus = 'pending' | 'synced' | 'failed';

export interface MemoDateAnchor {
  baseTimestamp: number;
  index: number;
  length: number;
  text: string;
  dismissed?: boolean;
}

export interface Memo {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  category: string;
  dateAnchors?: MemoDateAnchor[];
  pinned?: boolean;
  scheduledAt?: number;
  deletedAt?: number;
  contentHash?: string;
  syncedContentHash?: string;
  indexedContentHash?: string;
  scheduleScannedHash?: string;
  syncStatus?: MemoSyncStatus;
  scheduleScanStatus?: MemoScheduleScanStatus;
  topicDirty?: boolean;
  lastSyncedAt?: number;
  lastIndexedAt?: number;
  scheduleScannedAt?: number;
  dismissedDates?: string[];
}

export interface CalendarBrick {
  id: string;
  day: number;
  deletedAt?: number;
  note: string;
  order: number;
  scheduledAt?: number;
  syncStatus?: CalendarSyncStatus;
  syncedHash?: string;
  time?: string | null;
  title: string;
  tone: BrickTone;
}

interface MemoState {
  memos: Memo[];
  calendarBricks: CalendarBrick[];
  deletedMemoIds: string[];
  activeCategoryFilter: string | null;
  activeMarkdownEditor: {
    applyCommand: (command: string, args?: Record<string, unknown>) => void;
  } | null;
  markdownActiveCommands: Record<string, boolean>;
  markdownLinkHref: string | null;
  setActiveMarkdownEditor: (
    editor: {
      applyCommand: (command: string, args?: Record<string, unknown>) => void;
    } | null,
  ) => void;
  setMarkdownEditorState: (state: {
    active: Record<string, boolean>;
    linkHref: string | null;
  }) => void;
  addCalendarBrick: (
    brick: Omit<CalendarBrick, 'id' | 'order'> & { order?: number },
  ) => string;
  addMemo: (
    content: string,
    category?: string,
    dateAnchors?: MemoDateAnchor[],
  ) => string;
  addScheduleFromSelection: (text: string, scheduledAt: number) => string;
  deleteMemo: (id: string) => void;
  toggleMemoPinned: (id: string) => void;
  markMemoSynced: (id: string, contentHash: string) => void;
  markMemoDeletedSynced: (id: string) => void;
  markMemoSyncFailed: (id: string) => void;
  markMemoScheduleScanned: (id: string, contentHash: string) => void;
  markMemoIndexed: (id: string, contentHash: string) => void;
  markCalendarBrickSynced: (id: string, syncedHash: string) => void;
  markCalendarBrickSyncFailed: (id: string) => void;
  purgeCalendarBrick: (id: string) => void;
  updateMemo: (
    id: string,
    content: string,
    category?: string,
    dateAnchors?: MemoDateAnchor[],
  ) => void;
  updateMemoScheduledAt: (id: string, scheduledAt: number) => void;
  dismissMemoTooltip: (id: string, dateText: string) => void;
  updateCalendarBrick: (id: string, updates: Partial<CalendarBrick>) => void;
  deleteCalendarBrick: (id: string) => void;
  batchUpdateCalendarBricks: (
    updates: Array<{
      id: string;
      day: number;
      order: number;
      scheduledAt?: number;
    }>,
  ) => void;
  setActiveCategoryFilter: (category: string) => void;
  clearActiveCategoryFilter: () => void;
}

const DEFAULT_BRICKS: CalendarBrick[] = [
  {
    id: 'b1',
    day: 0,
    note: '다음 주로 넘길 것과 버릴 것을 나누기',
    order: 0,
    title: '주간 정리',
    tone: 'steel',
  },
  {
    id: 'b2',
    day: 1,
    note: '아젠다: 네트워크 탭, 브릭 UX',
    order: 0,
    title: '제품 회의',
    tone: 'ink',
  },
  { id: 'b3', day: 1, note: '', order: 1, title: '액션 아이템', tone: 'clay' },
  { id: 'b4', day: 2, note: '', order: 0, title: '운동', tone: 'olive' },
  {
    id: 'b5',
    day: 3,
    note: 'KNN 느낌의 카테고리 클러스터',
    order: 0,
    title: '노트 분류 실험',
    tone: 'steel',
  },
  { id: 'b6', day: 4, note: '', order: 0, title: '디자인 점검', tone: 'ink' },
  {
    id: 'b7',
    day: 5,
    note: '오늘/내일/YY/MM/DD 기반 요약',
    order: 0,
    title: 'LLM 브리핑 초안',
    tone: 'clay',
  },
  { id: 'b8', day: 6, note: '', order: 0, title: '쉬는 시간', tone: 'olive' },
];

let idSequence = 0;

const createEntityId = (prefix: string) => {
  if (prefix === 'memo' || prefix === 'brick' || prefix === 'schedule') {
    return createUuid();
  }

  idSequence += 1;
  return `${prefix}-${Date.now()}-${idSequence}`;
};

const withLocalMemoMetadata = (
  memo: Memo,
  content: string,
  options: { isNew: boolean },
): Memo => {
  const contentHash = hashText(content);
  const contentChanged = memo.contentHash !== contentHash;

  return {
    ...memo,
    content,
    contentHash,
    syncStatus:
      contentChanged || memo.syncStatus !== 'synced' ? 'pending' : 'synced',
    scheduleScanStatus:
      contentChanged || memo.scheduleScannedHash !== contentHash
        ? 'pending'
        : memo.scheduleScanStatus ?? 'scanned',
    topicDirty: contentChanged || options.isNew ? true : memo.topicDirty ?? false,
  };
};

const getDateKey = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatBrickTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minute = date.getMinutes();

  if (hour === 0 && minute === 0) {
    return null;
  }

  return `${hour.toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')}`;
};

const getScheduleTitle = (text: string) => {
  return (
    text
      .split('\n')
      .find(line => line.trim())
      ?.trim() ?? '일정'
  );
};

const buildScheduleBrick = (
  id: string,
  text: string,
  scheduledAt: number,
  calendarBricks: CalendarBrick[],
  note = '',
): CalendarBrick => {
  const date = new Date(scheduledAt);
  const order = calendarBricks.filter(
    brick =>
      brick.scheduledAt &&
      getDateKey(brick.scheduledAt) === getDateKey(scheduledAt),
  ).length;

  return {
    id,
    day: date.getDay(),
    note,
    order,
    scheduledAt,
    syncStatus: 'pending',
    time: formatBrickTime(scheduledAt),
    title: getScheduleTitle(text),
    tone: 'olive',
  };
};

export const useMemoStore = create<MemoState>()(
  persist(
    set => ({
      memos: [],
      calendarBricks: DEFAULT_BRICKS,
      deletedMemoIds: [],
      activeCategoryFilter: null,
      activeMarkdownEditor: null,
      markdownActiveCommands: {},
      markdownLinkHref: null,

      addCalendarBrick: brick => {
        const id = createEntityId('brick');
        set(state => {
          const dayBricks = state.calendarBricks.filter(
            b => !b.deletedAt && b.day === brick.day,
          );

          return {
            calendarBricks: [
              ...state.calendarBricks,
              {
                ...brick,
                id,
                order: brick.order ?? dayBricks.length,
                syncStatus: 'pending',
              },
            ],
          };
        });
        return id;
      },

      addMemo: (content, category, dateAnchors) => {
        const id = createEntityId('memo');
        const now = Date.now();
        const contentHash = hashText(content);
        set(state => ({
          memos: [
            {
              id,
              content,
              contentHash,
              createdAt: now,
              dateAnchors,
              updatedAt: now,
              category: category ?? categorizeMemo(content),
              scheduleScanStatus: 'pending',
              syncStatus: 'pending',
              topicDirty: true,
            },
            ...state.memos,
          ],
        }));
        return id;
      },

      addScheduleFromSelection: (selectedText, scheduledAt) => {
        const id = createEntityId('schedule');
        set(state => ({
          calendarBricks: [
            ...state.calendarBricks,
            buildScheduleBrick(
              id,
              selectedText,
              scheduledAt,
              state.calendarBricks,
            ),
          ],
        }));
        return id;
      },

      deleteMemo: id =>
        set(state => {
          const memo = state.memos.find(m => m.id === id);
          const preservedBrick =
            memo?.scheduledAt &&
            buildScheduleBrick(
              createEntityId('schedule'),
              memo.content,
              memo.scheduledAt,
              state.calendarBricks,
              memo.content,
            );

          return {
            calendarBricks: preservedBrick
              ? [...state.calendarBricks, preservedBrick]
              : state.calendarBricks,
            deletedMemoIds: isUuid(id)
              ? [...new Set([...state.deletedMemoIds, id])]
              : state.deletedMemoIds,
            memos: state.memos.filter(m => m.id !== id),
          };
        }),

      toggleMemoPinned: id =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id
              ? {
                  ...m,
                  pinned: !m.pinned,
                  syncStatus: 'pending',
                  updatedAt: Date.now(),
                }
              : m,
          ),
        })),

      markMemoSynced: (id, contentHash) =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id
              ? {
                  ...m,
                  contentHash,
                  lastSyncedAt: Date.now(),
                  syncedContentHash: contentHash,
                  syncStatus: 'synced',
                }
              : m,
          ),
        })),

      markMemoDeletedSynced: id =>
        set(state => ({
          deletedMemoIds: state.deletedMemoIds.filter(memoId => memoId !== id),
        })),

      markMemoSyncFailed: id =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id ? { ...m, syncStatus: 'failed' } : m,
          ),
        })),

      markMemoScheduleScanned: (id, contentHash) =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id
              ? {
                  ...m,
                  contentHash,
                  scheduleScannedAt: Date.now(),
                  scheduleScannedHash: contentHash,
                  scheduleScanStatus: 'scanned',
                }
              : m,
          ),
        })),

      markMemoIndexed: (id, contentHash) =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id
              ? {
                  ...m,
                  contentHash,
                  indexedContentHash: contentHash,
                  lastIndexedAt: Date.now(),
                }
              : m,
          ),
        })),

      updateMemo: (id, content, category, dateAnchors) =>
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== id) {
              return m;
            }

            return {
              ...withLocalMemoMetadata(
                {
                  ...m,
                  dateAnchors: dateAnchors ?? m.dateAnchors,
                  updatedAt: Date.now(),
                  category: category ?? m.category,
                },
                content,
                { isNew: false },
              ),
            };
          }),
        })),

      updateMemoScheduledAt: (id, scheduledAt) =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id
              ? {
                  ...m,
                  scheduledAt,
                  syncStatus: 'pending',
                  updatedAt: Date.now(),
                }
              : m,
          ),
        })),

      dismissMemoTooltip: (id, dateText) =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id
              ? {
                  ...m,
                  dismissedDates: [...new Set([...(m.dismissedDates ?? []), dateText])],
                  syncStatus: 'pending',
                  updatedAt: Date.now(),
                }
              : m,
          ),
        })),

      updateCalendarBrick: (id, updates) =>
        set(state => ({
          calendarBricks: state.calendarBricks.map(b =>
            b.id === id
              ? { ...b, ...updates, syncStatus: b.deletedAt ? b.syncStatus : 'pending' }
              : b,
          ),
        })),

      deleteCalendarBrick: id =>
        set(state => ({
          calendarBricks: state.calendarBricks
            .map(b =>
              b.id === id && isUuid(b.id) && (b.syncedHash || b.syncStatus)
                ? { ...b, deletedAt: Date.now(), syncStatus: 'pending' as const }
                : b,
            )
            .filter(b => b.id !== id || (isUuid(b.id) && (b.syncedHash || b.syncStatus))),
        })),

      batchUpdateCalendarBricks: updates =>
        set(state => ({
          calendarBricks: state.calendarBricks.map(b => {
            const u = updates.find(x => x.id === b.id);
            return u
              ? {
                  ...b,
                  day: u.day,
                  order: u.order,
                  scheduledAt: u.scheduledAt ?? b.scheduledAt,
                  syncStatus: b.deletedAt ? b.syncStatus : 'pending',
                }
              : b;
          }),
        })),

      markCalendarBrickSynced: (id, syncedHash) =>
        set(state => ({
          calendarBricks: state.calendarBricks.map(b =>
            b.id === id
              ? {
                  ...b,
                  syncStatus: 'synced',
                  syncedHash,
                }
              : b,
          ),
        })),

      markCalendarBrickSyncFailed: id =>
        set(state => ({
          calendarBricks: state.calendarBricks.map(b =>
            b.id === id ? { ...b, syncStatus: 'failed' } : b,
          ),
        })),

      purgeCalendarBrick: id =>
        set(state => ({
          calendarBricks: state.calendarBricks.filter(b => b.id !== id),
        })),

      setActiveCategoryFilter: category =>
        set(() => ({ activeCategoryFilter: category })),

      clearActiveCategoryFilter: () =>
        set(() => ({ activeCategoryFilter: null })),
      setActiveMarkdownEditor: editor =>
        set(() => ({ activeMarkdownEditor: editor })),
      setMarkdownEditorState: ({ active, linkHref }) =>
        set(() => ({
          markdownActiveCommands: active,
          markdownLinkHref: linkHref,
        })),
    }),
    {
      name: 'memo-calendar-store',
      version: 6,
      storage: memoCalendarPersistStorage,
      partialize: state => {
        const rest: Partial<typeof state> = { ...state };
        delete rest.activeMarkdownEditor;
        delete rest.markdownActiveCommands;
        delete rest.markdownLinkHref;
        return rest;
      },
      migrate: (persisted: any, version: number) => {
        const s = (persisted ?? {}) as any;
        let memos: Memo[] = s.memos ?? [];
        let calendarBricks: CalendarBrick[] =
          s.calendarBricks ?? DEFAULT_BRICKS;

        if (version < 2) {
          memos = memos.map((m: any) => ({
            ...m,
            updatedAt: m.updatedAt ?? m.createdAt ?? Date.now(),
          }));
        }

        if (version < 3) {
          const migratedScheduleBricks = memos
            .filter((memo: Memo) => memo.scheduledAt)
            .map((memo: Memo) =>
              buildScheduleBrick(
                `schedule-from-memo-${memo.id}`,
                memo.content,
                memo.scheduledAt ?? Date.now(),
                calendarBricks,
                memo.content,
              ),
            )
            .filter(
              (brick: CalendarBrick) =>
                !calendarBricks.some(
                  (existingBrick: CalendarBrick) =>
                    existingBrick.id === brick.id,
                ),
            );

          calendarBricks = [...calendarBricks, ...migratedScheduleBricks];
          memos = memos.map((memo: Memo) =>
            memo.scheduledAt ? { ...memo, scheduledAt: undefined } : memo,
          );
        }

        if (version < 4) {
          const seenMemoIds = new Set<string>();
          memos = memos.filter(memo => memo.content.trim());
          memos = memos.map(memo => {
            if (!seenMemoIds.has(memo.id)) {
              seenMemoIds.add(memo.id);
              return memo;
            }

            const nextMemo = { ...memo, id: createEntityId('memo') };
            seenMemoIds.add(nextMemo.id);
            return nextMemo;
          });
        }

        if (version < 5) {
          memos = memos.map(memo => {
            const contentHash = memo.contentHash ?? hashText(memo.content);

            return {
              ...memo,
              id: isUuid(memo.id) ? memo.id : createUuid(),
              contentHash,
              scheduleScanStatus: memo.scheduleScanStatus ?? 'pending',
              syncStatus: memo.syncStatus ?? 'pending',
              topicDirty: memo.topicDirty ?? Boolean(memo.content.trim()),
            };
          });
        }

        if (version < 6) {
          calendarBricks = calendarBricks.map(brick => ({
            ...brick,
            id: isUuid(brick.id) ? brick.id : createUuid(),
            syncStatus: brick.syncStatus ?? (brick.scheduledAt ? 'pending' : undefined),
            syncedHash: isUuid(brick.id) ? brick.syncedHash : undefined,
          }));
        }

        return {
          ...s,
          memos,
          calendarBricks,
          deletedMemoIds: s.deletedMemoIds ?? [],
        } as MemoState;
      },
    },
  ),
);
