import type { FormEvent, RefObject } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { List } from '@/components/icons';

import DateScheduleField from '../../memo/components/DateScheduleField';
import type { AnchoredPlacement } from '../../../lib/anchoredPlacement';
import type {
  CalendarBlockRow,
  CalendarCategoryRow,
  ScheduleInboxRow,
} from '../../../types';
import CalendarCategoryPicker from './CalendarCategoryPicker';

type CategoryMenuMode = 'create' | 'list';
type Translate = (korean: string, english: string) => string;

interface CalendarEventEditorModalProps {
  anchoredModalRef: RefObject<HTMLFormElement | null>;
  anchoredPlacement: AnchoredPlacement | null;
  categories: CalendarCategoryRow[];
  categoryMenuMode: CategoryMenuMode;
  categoryPickerRef: RefObject<HTMLDivElement | null>;
  deleteCategoryId: string | null;
  editingBlock: CalendarBlockRow | null;
  editingSuggestion: ScheduleInboxRow | null;
  isCategoryMenuOpen: boolean;
  isCustomColorPickerOpen: boolean;
  isEditorOpen: boolean;
  newCategoryColor: string;
  newCategoryName: string;
  note: string;
  selectedCategoryId: string | null;
  selectedColor: string;
  selectedDate: string;
  shouldReduceMotion: boolean | null;
  sourceMemoId: string | null;
  time: string;
  title: string;
  onChangeCategoryMenuMode: (mode: CategoryMenuMode) => void;
  onChangeCustomColorPickerOpen: (open: boolean) => void;
  onChangeDateTime: (date: Date, allDay: boolean) => void;
  onChangeDeleteCategoryId: (id: string | null) => void;
  onChangeNewCategoryColor: (color: string) => void;
  onChangeNewCategoryName: (name: string) => void;
  onChangeNote: (note: string) => void;
  onChangeTitle: (title: string) => void;
  onCreateCategory: () => void;
  onDeleteBlock: (block: CalendarBlockRow) => void;
  onDeleteCategory: () => void;
  onDeleteSuggestion: (suggestion: ScheduleInboxRow) => void;
  onOpenSourceMemo: (memoId: string) => void;
  onCancel: () => void;
  onSelectCategory: (category: CalendarCategoryRow | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleCategoryMenu: () => void;
  translate: Translate;
}

export default function CalendarEventEditorModal({
  anchoredModalRef,
  anchoredPlacement,
  categories,
  categoryMenuMode,
  categoryPickerRef,
  deleteCategoryId,
  editingBlock,
  editingSuggestion,
  isCategoryMenuOpen,
  isCustomColorPickerOpen,
  isEditorOpen,
  newCategoryColor,
  newCategoryName,
  note,
  selectedCategoryId,
  selectedColor,
  selectedDate,
  shouldReduceMotion,
  sourceMemoId,
  time,
  title,
  onChangeCategoryMenuMode,
  onChangeCustomColorPickerOpen,
  onChangeDateTime,
  onChangeDeleteCategoryId,
  onChangeNewCategoryColor,
  onChangeNewCategoryName,
  onChangeNote,
  onChangeTitle,
  onCreateCategory,
  onDeleteBlock,
  onDeleteCategory,
  onDeleteSuggestion,
  onOpenSourceMemo,
  onCancel,
  onSelectCategory,
  onSubmit,
  onToggleCategoryMenu,
  translate: t,
}: CalendarEventEditorModalProps) {
  return (
    <AnimatePresence>
      {isEditorOpen && (
        <motion.div
          animate={{ opacity: 1 }}
          className={`modal-backdrop${anchoredPlacement ? ' anchored' : ''}`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          role="presentation"
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.14, ease: 'easeOut' }
          }
        >
          <motion.form
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            className={
              anchoredPlacement
                ? `cal-modal anchored ${anchoredPlacement.side}`
                : 'cal-modal'
            }
            exit={
              anchoredPlacement
                ? { opacity: 0, scale: 0.96 }
                : { opacity: 0, scale: 0.99, y: -6 }
            }
            initial={
              anchoredPlacement
                ? {
                    opacity: 0,
                    scale: 0.94,
                    x: anchoredPlacement.side === 'right' ? -6 : 6,
                  }
                : { opacity: 0, scale: 0.99, y: -8 }
            }
            onSubmit={onSubmit}
            ref={anchoredModalRef}
            style={
              anchoredPlacement
                ? {
                    left: anchoredPlacement.left,
                    position: 'fixed',
                    top: anchoredPlacement.top,
                    width: anchoredPlacement.width,
                    ['--cal-modal-tail-top' as string]:
                      `${anchoredPlacement.tailTop}px`,
                  }
                : undefined
            }
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.18, ease: 'easeOut' }
            }
          >
            <header className="cal-modal-head">
              <input
                aria-label={t('일정 제목', 'Event title')}
                autoFocus
                className="cal-modal-title"
                onChange={event => onChangeTitle(event.target.value)}
                placeholder={
                  editingSuggestion
                    ? t('일정 제안', 'Schedule suggestion')
                    : editingBlock
                      ? t('일정 수정', 'Edit event')
                      : t('새 일정', 'New event')
                }
                value={title}
              />
              <div className="cal-modal-head-actions">
                {!editingSuggestion && (
                  <CalendarCategoryPicker
                    categories={categories}
                    categoryMenuMode={categoryMenuMode}
                    categoryPickerRef={categoryPickerRef}
                    deleteCategoryId={deleteCategoryId}
                    isCategoryMenuOpen={isCategoryMenuOpen}
                    isCustomColorPickerOpen={isCustomColorPickerOpen}
                    newCategoryColor={newCategoryColor}
                    newCategoryName={newCategoryName}
                    onChangeCategoryMenuMode={onChangeCategoryMenuMode}
                    onChangeCustomColorPickerOpen={onChangeCustomColorPickerOpen}
                    onChangeDeleteCategoryId={onChangeDeleteCategoryId}
                    onChangeNewCategoryColor={onChangeNewCategoryColor}
                    onChangeNewCategoryName={onChangeNewCategoryName}
                    onCreateCategory={onCreateCategory}
                    onDeleteCategory={onDeleteCategory}
                    onSelectCategory={onSelectCategory}
                    onToggleMenu={onToggleCategoryMenu}
                    selectedCategoryId={selectedCategoryId}
                    selectedColor={selectedColor}
                    translate={t}
                  />
                )}
              </div>
            </header>

            <div className="cal-modal-rows">
              <div className="cal-modal-row">
                <DateScheduleField
                  allDay={!time}
                  date={new Date(`${selectedDate}T${time || '00:00'}:00`)}
                  label={null}
                  onChange={onChangeDateTime}
                />
              </div>
              <div className="cal-modal-row">
                <List aria-hidden="true" className="cal-modal-row-icon" size={15} />
                <textarea
                  aria-label={t('메모', 'Note')}
                  onChange={event => onChangeNote(event.target.value)}
                  placeholder={t('메모 추가', 'Add a note')}
                  value={note}
                />
              </div>
            </div>
            {sourceMemoId && (
              <button
                className="cal-btn ghost cal-source-note-btn"
                onClick={() => onOpenSourceMemo(sourceMemoId)}
                type="button"
              >
                {t('원본 노트 열기', 'Open source memo')}
              </button>
            )}
            <footer className="cal-modal-foot">
              {editingSuggestion ? (
                <button
                  className="cal-modal-delete-text"
                  onClick={() => onDeleteSuggestion(editingSuggestion)}
                  type="button"
                >
                  {t('삭제', 'Delete')}
                </button>
              ) : editingBlock ? (
                <button
                  className="cal-modal-delete-text"
                  onClick={() => onDeleteBlock(editingBlock)}
                  type="button"
                >
                  {t('삭제', 'Delete')}
                </button>
              ) : null}
              <p className="cal-modal-hint">
                {editingSuggestion
                  ? t(
                      '시간을 비우면 종일 · 원본 메모는 그대로',
                      'Clear the time for all day · source memo stays unchanged',
                    )
                  : t('시간을 비우면 종일', 'Clear the time for all day')}
              </p>
              <div className="cal-modal-actions">
                <button className="cal-btn ghost" onClick={onCancel} type="button">
                  {t('취소', 'Cancel')}
                </button>
                <button className="cal-btn primary" type="submit">
                  {editingSuggestion ? t('등록', 'Add') : t('저장', 'Save')}
                </button>
              </div>
            </footer>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
