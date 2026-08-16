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

// The open Tiptap document intentionally is not replaced when a remote merge
// changes the canonical Markdown. Reapply only the latest editor transaction
// (previous -> next) onto that canonical text before persisting the next input.
export const rebaseEditorChangeOntoCanonical = (
  previousEditorContent: string,
  nextEditorContent: string,
  canonicalContent: string,
): MergeResult => {
  const rebased = mergeMemoContent(
    previousEditorContent,
    canonicalContent,
    nextEditorContent,
  );
  if (rebased.ok) return rebased;

  // The inverse direction can place a broad canonical patch when the small
  // editor delta cannot be located. If neither applies, preserve the newest
  // live text and let the caller retain the canonical version as recovery.
  const inverse = mergeMemoContent(
    previousEditorContent,
    nextEditorContent,
    canonicalContent,
  );
  return inverse.ok ? inverse : { ok: false, text: nextEditorContent };
};
