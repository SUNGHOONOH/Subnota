export type MemoNavAction = 'focus-existing' | 'create-new';

export const decideMemoNavAction = ({
  hasMemoTab,
  isMemoTabFocused,
}: {
  hasMemoTab: boolean;
  isMemoTabFocused: boolean;
}): MemoNavAction => {
  if (!hasMemoTab || isMemoTabFocused) {
    return 'create-new';
  }

  return 'focus-existing';
};
