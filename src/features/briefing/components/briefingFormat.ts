import { format, isToday, isTomorrow } from 'date-fns';

import { Memo } from '../../../store/useMemoStore';

export const getMemoTitle = (memo: Memo) => {
  return (
    memo.content
      .split('\n')
      .find(line => line.trim())
      ?.trim() ?? '새 메모'
  );
};

export const formatScheduleLabel = (timestamp?: number) => {
  if (!timestamp) {
    return '일정 없음';
  }

  const date = new Date(timestamp);

  if (isToday(date)) {
    return `오늘 ${format(date, 'HH:mm')}`;
  }

  if (isTomorrow(date)) {
    return `내일 ${format(date, 'HH:mm')}`;
  }

  return format(date, 'M.d HH:mm');
};
