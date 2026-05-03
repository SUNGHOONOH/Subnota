import { create } from 'zustand';

interface Memo {
  id: string;
  content: string;
  createdAt: number;
}

interface MemoState {
  memos: Memo[];
  addMemo: (content: string) => void;
  deleteMemo: (id: string) => void;
}

export const useMemoStore = create<MemoState>((set) => ({
  memos: [],
  addMemo: (content) => set((state) => ({
    memos: [
      { id: Date.now().toString(), content, createdAt: Date.now() },
      ...state.memos,
    ],
  })),
  deleteMemo: (id) => set((state) => ({
    memos: state.memos.filter((memo) => memo.id !== id),
  })),
}));
