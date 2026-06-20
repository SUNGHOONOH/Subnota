import { format } from 'date-fns';

import {
  DateMatch,
  formatRelativeDisplayDate,
  parseDates,
} from '../../../lib/dateParser';
import { MemoDateAnchor } from '../../../store/useMemoStore';

export interface HighlightedPiece {
  key: string;
  text: string;
  highlighted: boolean;
}

export const findFocusedDateMatch = (
  matches: DateMatch[],
  selectionStart: number,
  selectionEnd: number,
) => {
  if (selectionStart !== selectionEnd) {
    return null;
  }

  return (
    matches.find(match => {
      const matchEnd = match.index + match.length;
      return selectionStart >= match.index && selectionStart <= matchEnd;
    }) ?? null
  );
};

export const formatDateMatchTooltip = (
  match: DateMatch,
  baseTimestamp: number,
) => {
  const hasTime =
    match.date.getHours() !== 0 ||
    match.date.getMinutes() !== 0 ||
    match.date.getSeconds() !== 0;
  const dateText = formatRelativeDisplayDate(match.date, baseTimestamp);

  return hasTime ? `${dateText} ${format(match.date, 'HH:mm')}` : dateText;
};

export const getDateMatchDismissKey = (match: DateMatch) => {
  return `${match.index}:${match.length}:${match.text}:${match.date.getTime()}`;
};

export const splitHighlightedText = (
  text: string,
  matches: DateMatch[],
): HighlightedPiece[] => {
  const pieces: HighlightedPiece[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.index > cursor) {
      pieces.push({
        key: `plain-${index}`,
        text: text.slice(cursor, match.index),
        highlighted: false,
      });
    }

    pieces.push({
      key: `date-${index}`,
      text: text.slice(match.index, match.index + match.length),
      highlighted: true,
    });
    cursor = match.index + match.length;
  });

  if (cursor < text.length) {
    pieces.push({
      key: 'plain-tail',
      text: text.slice(cursor),
      highlighted: false,
    });
  }

  return pieces;
};

export const reconcileDateTokenAnchors = (
  text: string,
  previousAnchors: MemoDateAnchor[],
  baseTimestamp = Date.now(),
) => {
  const detectedMatches = parseDates(text, baseTimestamp);
  const availableAnchors = previousAnchors.map(anchor => ({
    ...anchor,
    used: false,
  }));

  return detectedMatches.map(match => {
    const exactAnchor = availableAnchors.find(
      anchor =>
        !anchor.used &&
        anchor.text === match.text &&
        anchor.index === match.index &&
        anchor.length === match.length,
    );
    const shiftedAnchor =
      exactAnchor ??
      availableAnchors
        .filter(anchor => !anchor.used && anchor.text === match.text)
        .sort(
          (a, b) =>
            Math.abs(a.index - match.index) - Math.abs(b.index - match.index),
        )[0];
    const anchor = shiftedAnchor ?? {
      baseTimestamp,
      index: match.index,
      length: match.length,
      text: match.text,
      used: false,
      dismissed: false,
    };

    anchor.used = true;

    return {
      baseTimestamp: anchor.baseTimestamp,
      index: match.index,
      length: match.length,
      text: match.text,
      dismissed: anchor.dismissed,
    };
  });
};

export const buildAnchoredDateMatches = (
  text: string,
  anchors: MemoDateAnchor[],
): DateMatch[] => {
  const matches: DateMatch[] = [];

  anchors.forEach(anchor => {
    const parsed = parseDates(anchor.text, anchor.baseTimestamp)[0];

    if (!parsed) {
      return;
    }

    matches.push({
      ...parsed,
      index: anchor.index,
      length: anchor.length,
      text: text.slice(anchor.index, anchor.index + anchor.length),
      dismissed: anchor.dismissed,
    });
  });

  return matches;
};
