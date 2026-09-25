import { useState } from 'react';
import { SegmentedControl } from '@mantine/core';

import type { MemoFolderMode } from '../../../types';
import { AUTOMATIC_FOLDER_MIN_SEEDS } from '../folderOrganization';

export interface MemoFolderFormValue {
  mode: MemoFolderMode;
  name: string;
}

interface MemoFolderFormProps {
  initialMode: MemoFolderMode;
  initialName?: string;
  onCancel: () => void;
  onSubmit: (value: MemoFolderFormValue) => void | Promise<void>;
  submitLabel: string;
  t: (korean: string, english: string) => string;
}

/** 폴더를 만드는 모든 입구(＋, 폴더 제안, Topics)가 같은 폼을 쓴다. */
const MemoFolderForm = ({
  initialMode,
  initialName = '',
  onCancel,
  onSubmit,
  submitLabel,
  t,
}: MemoFolderFormProps) => {
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<MemoFolderMode>(initialMode);

  return (
    <form
      className="memo-folder-form"
      onKeyDown={event => {
        if (event.key === 'Escape') onCancel();
      }}
      onSubmit={event => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed) void onSubmit({ mode, name: trimmed });
      }}
    >
      <input
        aria-label={t('폴더 이름', 'Folder name')}
        autoFocus
        maxLength={80}
        onChange={event => setName(event.target.value)}
        placeholder={t('폴더 이름', 'Folder name')}
        value={name}
      />
      <SegmentedControl<MemoFolderMode>
        aria-label={t('폴더 방식', 'Folder mode')}
        className="memo-folder-mode"
        data={[
          { label: t('수동', 'Manual'), value: 'manual' },
          { label: t('자동', 'Automatic'), value: 'automatic' },
        ]}
        fullWidth
        onChange={setMode}
        size="xs"
        value={mode}
      />
      <p className="memo-folder-mode-help">
        {mode === 'manual'
          ? t('직접 넣은 메모만 담아요.', 'Holds only the notes you add.')
          : t(
              `직접 넣은 메모가 ${AUTOMATIC_FOLDER_MIN_SEEDS}개가 되면, 비슷한 미분류 메모를 자동으로 모아요.`,
              `Once you add ${AUTOMATIC_FOLDER_MIN_SEEDS} notes yourself, similar unfiled notes are gathered automatically.`,
            )}
      </p>
      <div className="memo-folder-form-actions">
        <button className="memo-folder-form-cancel" onClick={onCancel} type="button">
          {t('취소', 'Cancel')}
        </button>
        <button
          className="memo-folder-form-submit"
          disabled={!name.trim()}
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

export default MemoFolderForm;
