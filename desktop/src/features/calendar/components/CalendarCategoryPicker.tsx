import type { RefObject } from 'react';

import { ColorPicker, Popover } from '@mantine/core';
import { ChevronDown, Plus, Trash2 } from '@/components/icons';

import type { CalendarCategoryRow } from '../../../types';
import { CALENDAR_COLOR_PRESETS } from '../calendarCategories';
import { DEFAULT_COLOR, hexToRgba } from '../calendarUtils';

type CategoryMenuMode = 'create' | 'list';
type Translate = (korean: string, english: string) => string;

interface CalendarCategoryPickerProps {
  categories: CalendarCategoryRow[];
  categoryPickerRef: RefObject<HTMLDivElement | null>;
  categoryMenuMode: CategoryMenuMode;
  deleteCategoryId: string | null;
  isCategoryMenuOpen: boolean;
  isCustomColorPickerOpen: boolean;
  newCategoryColor: string;
  newCategoryName: string;
  selectedCategoryId: string | null;
  selectedColor: string;
  onChangeCategoryMenuMode: (mode: CategoryMenuMode) => void;
  onChangeCustomColorPickerOpen: (open: boolean) => void;
  onChangeNewCategoryColor: (color: string) => void;
  onChangeNewCategoryName: (name: string) => void;
  onChangeDeleteCategoryId: (id: string | null) => void;
  onCreateCategory: () => void;
  onDeleteCategory: () => void;
  onSelectCategory: (category: CalendarCategoryRow | null) => void;
  onToggleMenu: () => void;
  translate: Translate;
}

export default function CalendarCategoryPicker({
  categories,
  categoryPickerRef,
  categoryMenuMode,
  deleteCategoryId,
  isCategoryMenuOpen,
  isCustomColorPickerOpen,
  newCategoryColor,
  newCategoryName,
  selectedCategoryId,
  selectedColor,
  onChangeCategoryMenuMode,
  onChangeCustomColorPickerOpen,
  onChangeNewCategoryColor,
  onChangeNewCategoryName,
  onChangeDeleteCategoryId,
  onCreateCategory,
  onDeleteCategory,
  onSelectCategory,
  onToggleMenu,
  translate: t,
}: CalendarCategoryPickerProps) {
  return (
    <div className="cal-category-picker" ref={categoryPickerRef}>
      <button
        aria-expanded={isCategoryMenuOpen}
        aria-haspopup="menu"
        aria-label={t('일정 색상 및 카테고리', 'Event color and category')}
        className="cal-category-trigger"
        onClick={onToggleMenu}
        type="button"
      >
        <span
          aria-hidden="true"
          className="cal-category-color-dot"
          style={{
            backgroundColor: selectedCategoryId ? selectedColor : DEFAULT_COLOR,
          }}
        />
        <ChevronDown size={14} />
      </button>

      {isCategoryMenuOpen && (
        <div
          aria-label={t('카테고리 및 색상', 'Categories and colors')}
          className="cal-category-menu"
          role="menu"
        >
          {categoryMenuMode === 'list' ? (
            <>
              <div className="cal-category-menu-head">
                <strong>{t('카테고리', 'Categories')}</strong>
                <button
                  aria-label={t('새 카테고리', 'New category')}
                  className="cal-category-add-icon"
                  onClick={() => {
                    onChangeCategoryMenuMode('create');
                    onChangeCustomColorPickerOpen(false);
                    onChangeDeleteCategoryId(null);
                  }}
                  type="button"
                >
                  <Plus size={15} />
                </button>
              </div>
              <button
                aria-checked={selectedCategoryId === null}
                className={`cal-category-option${selectedCategoryId === null ? ' selected' : ''}`}
                onClick={() => onSelectCategory(null)}
                role="menuitemradio"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="cal-category-color-dot"
                  style={{ backgroundColor: DEFAULT_COLOR }}
                />
                <span>{t('기본', 'Default')}</span>
                {selectedCategoryId === null && <b aria-hidden="true">✓</b>}
              </button>
              {categories.map(category => (
                <div className="cal-category-row" key={category.id}>
                  <button
                    aria-checked={selectedCategoryId === category.id}
                    className={`cal-category-option${selectedCategoryId === category.id ? ' selected' : ''}`}
                    onClick={() => onSelectCategory(category)}
                    role="menuitemradio"
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="cal-category-color-dot"
                      style={{ backgroundColor: category.color }}
                    />
                    <span>{category.name}</span>
                    {selectedCategoryId === category.id && (
                      <b aria-hidden="true">✓</b>
                    )}
                  </button>
                  <button
                    aria-label={t(
                      `${category.name} 카테고리 삭제`,
                      `Delete ${category.name} category`,
                    )}
                    className="cal-category-delete"
                    onClick={() => onChangeDeleteCategoryId(category.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {deleteCategoryId && (
                <div className="cal-category-delete-confirm" role="alert">
                  <p>
                    {t(
                      '삭제하면 해당 일정은 기본 초록색으로 바뀝니다.',
                      'Deleting it changes its events to the default green.',
                    )}
                  </p>
                  <div>
                    <button
                      className="cal-category-confirm-cancel"
                      onClick={() => onChangeDeleteCategoryId(null)}
                      type="button"
                    >
                      {t('취소', 'Cancel')}
                    </button>
                    <button
                      className="cal-category-confirm-delete"
                      onClick={onDeleteCategory}
                      type="button"
                    >
                      {t('삭제', 'Delete')}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="cal-category-create">
              <div className="cal-category-menu-head">
                <button
                  className="cal-category-back"
                  onClick={() => onChangeCategoryMenuMode('list')}
                  type="button"
                >
                  ←
                </button>
                <strong>{t('새 카테고리', 'New category')}</strong>
              </div>
              <input
                aria-label={t('카테고리 이름', 'Category name')}
                autoFocus
                className="cal-category-name-input"
                maxLength={40}
                onChange={event => onChangeNewCategoryName(event.target.value)}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  onCreateCategory();
                }}
                placeholder={t('카테고리 이름', 'Category name')}
                value={newCategoryName}
              />
              <div
                aria-label={t('카테고리 색상', 'Category color')}
                className="cal-category-color-grid"
              >
                {CALENDAR_COLOR_PRESETS.map(preset => (
                  <button
                    aria-label={t(
                      `${preset.label} 색상`,
                      `${preset.labelEn} color`,
                    )}
                    className={`cal-category-swatch${newCategoryColor === preset.color ? ' selected' : ''}`}
                    key={preset.color}
                    onClick={() => {
                      onChangeNewCategoryColor(preset.color);
                      onChangeCustomColorPickerOpen(false);
                    }}
                    style={{ backgroundColor: preset.color }}
                    type="button"
                  />
                ))}
                <Popover
                  onChange={onChangeCustomColorPickerOpen}
                  opened={isCustomColorPickerOpen}
                  position="bottom-end"
                  shadow="md"
                  withinPortal={false}
                >
                  <Popover.Target>
                    <button
                      aria-expanded={isCustomColorPickerOpen}
                      aria-haspopup="dialog"
                      aria-label={t('사용자 지정 색상', 'Custom color')}
                      className="cal-category-custom-swatch"
                      onClick={() =>
                        onChangeCustomColorPickerOpen(!isCustomColorPickerOpen)
                      }
                      type="button"
                    />
                  </Popover.Target>
                  <Popover.Dropdown className="cal-category-color-popover">
                    <ColorPicker
                      format="hex"
                      hueLabel={t('색조', 'Hue')}
                      onChange={color => onChangeNewCategoryColor(color.toUpperCase())}
                      saturationLabel={t('채도와 명도', 'Saturation and lightness')}
                      size="sm"
                      value={newCategoryColor}
                    />
                    <div className="cal-category-color-controls">
                      <span
                        aria-label={t('선택한 색상 미리보기', 'Selected color preview')}
                        className="cal-category-color-preview"
                        role="img"
                        style={{ backgroundColor: newCategoryColor }}
                      />
                      <input
                        aria-label={t('선택한 RGBA 색상', 'Selected RGBA color')}
                        className="cal-category-color-rgba"
                        readOnly
                        value={hexToRgba(newCategoryColor)}
                      />
                      <button
                        className="cal-category-color-confirm"
                        onClick={() => onChangeCustomColorPickerOpen(false)}
                        type="button"
                      >
                        {t('확인', 'Done')}
                      </button>
                    </div>
                  </Popover.Dropdown>
                </Popover>
              </div>
              <button
                className="cal-category-create-submit"
                disabled={!newCategoryName.trim()}
                onClick={onCreateCategory}
                type="button"
              >
                {t('추가', 'Add')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
