import { CalendarDays, X } from '@/components/icons';
import { localize, useUiLanguage } from '../../../lib/uiLanguage';

interface ScheduleConfirmPopoverProps {
  // 감지된 숫자 날짜 문구 (예: "2026.07.23" 또는 "2026.07.23 14:00").
  label: string;
  onConfirm: () => void;
  onChangeDate: () => void;
  onClose: () => void;
}

// 선택 문장에서 날짜가 감지됐을 때, 바로 저장하지 않고 감지 결과를 한 줄로
// 보여주는 컴팩트 확인 바. 날짜 칩을 누르면 피커로 날짜를 바꾼다.
const ScheduleConfirmPopover = ({
  label,
  onConfirm,
  onChangeDate,
  onClose,
}: ScheduleConfirmPopoverProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  return (
    <div className="schedule-confirm-bar" role="group" aria-label={t('일정 등록 확인', 'Confirm schedule')}>
      <button
        className="schedule-confirm-date"
        onClick={onChangeDate}
        title={t('날짜 변경', 'Change date')}
        type="button"
      >
        <span className="schedule-confirm-date-text">{label}</span>
        <CalendarDays size={13} />
      </button>
      <button
        className="schedule-confirm-submit"
        onClick={onConfirm}
        type="button"
      >
        {t('등록', 'Add')}
      </button>
      <button
        aria-label={t('닫기', 'Close')}
        className="schedule-confirm-x"
        onClick={onClose}
        type="button"
      >
        <X size={13} />
      </button>
    </div>
  );
};

export default ScheduleConfirmPopover;
