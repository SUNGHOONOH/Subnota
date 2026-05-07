export interface BriefingInput {
  date: string;
  memos: string[];
}

export interface BriefingResult {
  title: string;
  summary: string;
  scheduleHints: string[];
}

export const createDailyBriefing = async (
  input: BriefingInput,
): Promise<BriefingResult> => {
  return {
    title: `${input.date} briefing`,
    summary: 'LLM provider integration will be connected here.',
    scheduleHints: input.memos.slice(0, 3),
  };
};
