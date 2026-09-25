import { Button } from '@mantine/core';
import {
  ArrowPathIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  InformationCircleIcon,
  SwatchIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

import type { AppSettings } from '../../lib/appSettings';
import { localize } from '../../lib/uiLanguage';

type IconComponent = typeof Cog6ToothIcon;

export const SETTINGS_SECTIONS: Array<{
  enLabel: string;
  icon: IconComponent;
  id: string;
  label: string;
}> = [
  { enLabel: 'General', icon: Cog6ToothIcon, id: 'general', label: '일반' },
  {
    enLabel: 'Appearance & editor',
    icon: SwatchIcon,
    id: 'appearance',
    label: '화면 및 편집기',
  },
  {
    enLabel: 'Sync & storage',
    icon: ArrowPathIcon,
    id: 'sync',
    label: '동기화 및 저장소',
  },
  {
    enLabel: 'Backup & data',
    icon: CircleStackIcon,
    id: 'backup',
    label: '백업 및 데이터',
  },
  { enLabel: 'Shortcuts', icon: CommandLineIcon, id: 'hotkeys', label: '단축키' },
  { enLabel: 'Account', icon: UserCircleIcon, id: 'account', label: '계정' },
  { enLabel: 'About', icon: InformationCircleIcon, id: 'about', label: '정보' },
];

interface SettingsNavProps {
  active: string;
  language: AppSettings['uiLanguage'];
  onSelect: (id: string) => void;
}

const SettingsNav = ({ active, language, onSelect }: SettingsNavProps) => (
  <aside className="settings-reference-sidebar">
    <h2 className="settings-reference-sidebar-title">
      {localize(language, '설정', 'Settings')}
    </h2>
    <nav className="settings-reference-nav">
      {SETTINGS_SECTIONS.map(section => {
        const Icon = section.icon;
        return (
          <Button
            className="settings-reference-nav-button"
            data-active={active === section.id ? '' : undefined}
            key={section.id}
            leftSection={<Icon />}
            onClick={() => onSelect(section.id)}
            variant="transparent"
          >
            {localize(language, section.label, section.enLabel)}
          </Button>
        );
      })}
    </nav>
  </aside>
);

export default SettingsNav;
