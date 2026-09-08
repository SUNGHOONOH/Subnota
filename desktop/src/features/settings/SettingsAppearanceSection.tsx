import { Group, NumberInput, Slider } from '@mantine/core';

import type { AppSettings } from '../../lib/appSettings';
import { DARK_MODE_ENABLED } from '../../lib/constants';
import {
  ExpandableRow,
  Row,
  RowAction,
  Section,
} from './SettingsPrimitives';

interface SettingsAppearanceSectionProps {
  appSettings: AppSettings;
  expandedRow: string | null;
  isDark: boolean;
  onAppSettingsChange: (patch: Partial<AppSettings>) => void;
  onSetExpandedRow: (row: string | null) => void;
  onToggleTheme: () => void;
  translate: (korean: string, english: string) => string;
}

export default function SettingsAppearanceSection({
  appSettings,
  expandedRow,
  isDark,
  onAppSettingsChange,
  onSetExpandedRow,
  onToggleTheme,
  translate: t,
}: SettingsAppearanceSectionProps) {
  const expandable = (row: string) => ({
    expanded: expandedRow === row,
    language: appSettings.uiLanguage,
    onClose: () => onSetExpandedRow(null),
    onOpen: () => onSetExpandedRow(row),
  });

  return (
    <div className="settings-reference-sections">
      {DARK_MODE_ENABLED && (
        <Section title={t('테마', 'Theme')}>
          <Row
            action={<RowAction onClick={onToggleTheme}>{t('전환', 'Switch')}</RowAction>}
            description={t('Subnota 전체 테마 설정과 동일하게 저장됩니다.', 'Uses the same setting across Subnota.')}
            label={isDark ? t('다크 모드', 'Dark mode') : t('라이트 모드', 'Light mode')}
          />
        </Section>
      )}
      <Section title={t('편집기 타이포그래피', 'Editor typography')}>
        <ExpandableRow
          label={t('글자 크기', 'Font size')}
          value={`${appSettings.fontSize}px`}
          {...expandable('fontSize')}
        >
          <Group align="center" gap={18} wrap="nowrap">
            <Slider
              flex={1}
              label={value => `${value}px`}
              max={24}
              min={12}
              onChange={fontSize => onAppSettingsChange({ fontSize })}
              value={appSettings.fontSize}
            />
            <NumberInput
              max={24}
              min={12}
              onChange={value =>
                typeof value === 'number' && onAppSettingsChange({ fontSize: value })
              }
              suffix=" px"
              value={appSettings.fontSize}
              w={110}
            />
          </Group>
        </ExpandableRow>
        <ExpandableRow
          label={t('줄 간격', 'Line height')}
          value={appSettings.lineHeight.toFixed(1)}
          {...expandable('lineHeight')}
        >
          <Slider
            label={value => value.toFixed(1)}
            max={2.2}
            min={1.2}
            onChange={lineHeight => onAppSettingsChange({ lineHeight })}
            step={0.1}
            value={appSettings.lineHeight}
          />
        </ExpandableRow>
      </Section>
    </div>
  );
}
