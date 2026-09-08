import { createPortal } from 'react-dom';
import DateSchedulePopover from './DateSchedulePopover';
import ScheduleConfirmPopover from './ScheduleConfirmPopover';
import type { MemoSplitEditorState } from './MemoSplitWorkspace';

export interface MemoSplitScheduleConfirmState {
  anchor: {
    left: number;
    top: number;
    width: number;
  };
  editorId: string;
  date: Date;
  allDay: boolean;
  title: string;
  label: string;
  selectionEnd: number;
  selectionStart: number;
}

interface MemoSplitScheduleOverlayProps {
  datePickerSeed: Date | null;
  editor: MemoSplitEditorState;
  onApplyDate: (
    editor: MemoSplitEditorState,
    date: Date,
    allDay: boolean,
  ) => void;
  onChangeDate: (editor: MemoSplitEditorState) => void;
  onCloseConfirm: () => void;
  onCloseDatePicker: () => void;
  onConfirm: (editor: MemoSplitEditorState) => void;
  openDatePickerEditorId: string | null;
  scheduleConfirm: MemoSplitScheduleConfirmState | null;
  confirmLabel: string;
}

const MemoSplitScheduleOverlay = ({
  datePickerSeed,
  editor,
  onApplyDate,
  onChangeDate,
  onCloseConfirm,
  onCloseDatePicker,
  onConfirm,
  openDatePickerEditorId,
  scheduleConfirm,
  confirmLabel,
}: MemoSplitScheduleOverlayProps) => (
  <>
    {openDatePickerEditorId === editor.id ? (
      <div className="date-schedule-floating split-date-schedule-floating">
        <DateSchedulePopover
          confirmLabel={confirmLabel}
          initialDate={datePickerSeed ?? undefined}
          onApplyDate={(date, allDay) => onApplyDate(editor, date, allDay)}
          onClose={onCloseDatePicker}
        />
      </div>
    ) : scheduleConfirm?.editorId === editor.id &&
      typeof document !== 'undefined' ? (
      createPortal(
        <div
          className="schedule-confirm-floating"
          style={{
            left:
              scheduleConfirm.anchor.left + scheduleConfirm.anchor.width / 2,
            top: scheduleConfirm.anchor.top - 6,
          }}
        >
          <ScheduleConfirmPopover
            label={scheduleConfirm.label}
            onChangeDate={() => onChangeDate(editor)}
            onClose={onCloseConfirm}
            onConfirm={() => onConfirm(editor)}
          />
        </div>,
        document.body,
      )
    ) : null}
  </>
);

export default MemoSplitScheduleOverlay;
