import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { categorizeMemo } from '../services/ml/categorizeMemo';

export type BrickTone = 'ink' | 'clay' | 'olive' | 'steel';

export interface Memo {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  category: string;
  pinned?: boolean;
  scheduledAt?: number;
  deletedAt?: number;
}

export interface CalendarBrick {
  id: string;
  day: number;
  note: string;
  order: number;
  scheduledAt?: number;
  time?: string | null;
  title: string;
  tone: BrickTone;
}

interface MemoState {
  memos: Memo[];
  calendarBricks: CalendarBrick[];
  addCalendarBrick: (
    brick: Omit<CalendarBrick, 'id' | 'order'> & { order?: number },
  ) => string;
  addMemo: (content: string, category?: string) => string;
  addScheduleFromSelection: (text: string, scheduledAt: number) => string;
  deleteMemo: (id: string) => void;
  toggleMemoPinned: (id: string) => void;
  updateMemo: (id: string, content: string, category?: string) => void;
  updateMemoScheduledAt: (id: string, scheduledAt: number) => void;
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
    title: '메모 분류 실험',
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

export const useMemoStore = create<MemoState>()(
  persist(
    set => ({
      memos: [],
      calendarBricks: DEFAULT_BRICKS,

      addCalendarBrick: brick => {
        const id = `brick-${Date.now()}`;
        set(state => {
          const dayBricks = state.calendarBricks.filter(
            b => b.day === brick.day,
          );

          return {
            calendarBricks: [
              ...state.calendarBricks,
              {
                ...brick,
                id,
                order: brick.order ?? dayBricks.length,
              },
            ],
          };
        });
        return id;
      },

      addMemo: (content, category) => {
        const id = Date.now().toString();
        const now = Date.now();
        set(state => ({
          memos: [
            {
              id,
              content,
              createdAt: now,
              updatedAt: now,
              category: category ?? categorizeMemo(content),
            },
            ...state.memos,
          ],
        }));
        return id;
      },

      addScheduleFromSelection: (selectedText, scheduledAt) => {
        const id = Date.now().toString();
        const now = Date.now();
        set(state => ({
          memos: [
            {
              id,
              content: selectedText,
              createdAt: now,
              updatedAt: now,
              category: categorizeMemo(selectedText),
              scheduledAt,
            },
            ...state.memos,
          ],
        }));
        return id;
      },

      deleteMemo: id =>
        set(state => ({ memos: state.memos.filter(m => m.id !== id) })),

      toggleMemoPinned: id =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id
              ? { ...m, pinned: !m.pinned, updatedAt: Date.now() }
              : m,
          ),
        })),

      updateMemo: (id, content, category) =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id
              ? {
                  ...m,
                  content,
                  updatedAt: Date.now(),
                  category: category ?? m.category,
                }
              : m,
          ),
        })),

      updateMemoScheduledAt: (id, scheduledAt) =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id ? { ...m, scheduledAt, updatedAt: Date.now() } : m,
          ),
        })),

      updateCalendarBrick: (id, updates) =>
        set(state => ({
          calendarBricks: state.calendarBricks.map(b =>
            b.id === id ? { ...b, ...updates } : b,
          ),
        })),

      deleteCalendarBrick: id =>
        set(state => ({
          calendarBricks: state.calendarBricks.filter(b => b.id !== id),
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
                }
              : b;
          }),
        })),
    }),
    {
      name: 'memo-calendar-store',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          const s = persisted as any;
          return {
            ...s,
            memos: (s.memos ?? []).map((m: any) => ({
              ...m,
              updatedAt: m.updatedAt ?? m.createdAt ?? Date.now(),
            })),
            calendarBricks: s.calendarBricks ?? DEFAULT_BRICKS,
          };
        }
        return persisted as MemoState;
      },
    },
  ),
);
