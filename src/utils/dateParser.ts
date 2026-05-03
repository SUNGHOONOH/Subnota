import { addDays, format, startOfToday } from 'date-fns';

export interface DateMatch {
  text: string;
  date: Date;
  index: number;
  length: number;
}

const PATTERNS = [
  {
    regex: /오늘/g,
    resolve: () => startOfToday(),
  },
  {
    regex: /내일/g,
    resolve: () => addDays(startOfToday(), 1),
  },
  {
    regex: /모레/g,
    resolve: () => addDays(startOfToday(), 2),
  },
  {
    // 3월 6일, 12월 25일 등
    regex: /(\d{1,2})월\s*(\d{1,2})일/g,
    resolve: (match: RegExpExecArray) => {
      const month = parseInt(match[1], 10) - 1;
      const day = parseInt(match[2], 10);
      const date = new Date();
      date.setMonth(month);
      date.setDate(day);
      return date;
    },
  },
  {
    // 3.6, 12.25 등
    regex: /(\d{1,2})\.(\d{1,2})/g,
    resolve: (match: RegExpExecArray) => {
      const month = parseInt(match[1], 10) - 1;
      const day = parseInt(match[2], 10);
      const date = new Date();
      date.setMonth(month);
      date.setDate(day);
      return date;
    },
  },
];

export const parseDates = (text: string): DateMatch[] => {
  const matches: DateMatch[] = [];
  
  PATTERNS.forEach((pattern) => {
    let match;
    // Reset regex index for global search
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      matches.push({
        text: match[0],
        date: pattern.resolve(match),
        index: match.index,
        length: match[0].length,
      });
    }
  });

  // Sort by index and remove overlapping matches
  return matches.sort((a, b) => a.index - b.index);
};

export const formatDisplayDate = (date: Date): string => {
  return format(date, 'yyyy년 M월 d일');
};
