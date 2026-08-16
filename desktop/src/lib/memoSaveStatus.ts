import type { MemoRow, MemoSaveState } from '../types';

export interface MemoSavePresentation {
  label: string;
  text: string;
}

export const resolveMemoSavePresentation = (
  memo: Pick<MemoRow, 'local_sync_status'>,
  localSaveState?: MemoSaveState,
): MemoSavePresentation => {
  if (localSaveState === 'saving-local') {
    return { label: '로컬에 저장 중', text: '… 저장 중' };
  }
  if (localSaveState === 'local-failed') {
    return { label: '로컬 저장 실패', text: '! 로컬 저장 실패' };
  }
  if (memo.local_sync_status === 'synced') {
    return { label: '클라우드에 동기화됨', text: '☁︎ 저장됨' };
  }
  if (memo.local_sync_status === 'failed') {
    return {
      label: '로컬에 저장됨 · 동기화 실패',
      text: '! 저장됨 · 동기화 실패',
    };
  }
  return { label: '로컬에 저장됨', text: '✓ 저장됨' };
};
