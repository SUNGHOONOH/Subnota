import { diff_match_patch } from 'diff-match-patch';

export interface MergeResult {
  ok: boolean;
  text: string;
}

// 3-way merge: apply the server's changes since the shared base onto the
// local text — the same approach Obsidian Sync uses for markdown files.
// ok=false means at least one patch could not be placed (overlapping edits);
// callers should fall back to conflict-copy preservation instead.
export const mergeMemoContent = (
  base: string,
  local: string,
  server: string,
): MergeResult => {
  const dmp = new diff_match_patch();
  const patches = dmp.patch_make(base, server);
  const [text, applied] = dmp.patch_apply(patches, local);
  return { ok: applied.every(Boolean), text };
};
