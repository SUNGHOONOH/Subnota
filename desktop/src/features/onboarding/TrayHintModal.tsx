import { Modal } from '@mantine/core';

import { loadShortcutSettings } from '../../lib/shortcutSettings';
import { localize, useUiLanguage } from '../../lib/uiLanguage';

/**
 * Windows에서 창을 닫아 트레이로 내려가는 첫 순간에 한 번만 뜬다.
 *
 * Windows 11은 새 트레이 아이콘을 작업 표시줄의 `⌃` 오버플로 안에 넣는다.
 * 사용자가 직접 꺼내 고정하기 전까지는 보이지 않아서, 창을 닫으면 앱이 그냥
 * 사라진 것처럼 느낀다. macOS 메뉴 바는 늘 보이므로 없던 문제다.
 *
 * 아이콘 고정법보다 **단축키를 먼저** 알린다. 고정을 안 해도 앱을 계속 쓸 수
 * 있다는 것이 여기서 가장 중요한 정보다 — 고정은 선택이고 단축키는 대안이다.
 */
interface TrayHintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TrayHintModal = ({ isOpen, onClose }: TrayHintModalProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const toggleMini = loadShortcutSettings().toggleMini;

  return (
    <Modal centered onClose={onClose} opened={isOpen} shadow="sm" size="sm" title={null} withCloseButton>
      <div className="tray-hint">
        <h2 className="tray-hint-title">
          {t('Subnota는 계속 실행 중입니다', 'Subnota is still running')}
        </h2>
        <p className="tray-hint-body">
          {language === 'en' ? (
            <>Press <kbd className="tray-hint-key">{toggleMini}</kbd> any time to open Quick Subnota.</>
          ) : (
            <><kbd className="tray-hint-key">{toggleMini}</kbd> 를 누르면 언제든 Quick Subnota가 열립니다.</>
          )}
        </p>
        <p className="tray-hint-body">
          {t(
            '작업 표시줄 오른쪽 ⌃ 를 누르면 Subnota 아이콘이 있습니다. 밖으로 끌어다 놓으면 항상 보이게 고정됩니다.',
            'The Subnota icon lives under ⌃ at the right end of the taskbar. Drag it out to keep it visible.',
          )}
        </p>
        <button className="tray-hint-cta" onClick={onClose} type="button">
          {t('알겠어요', 'Got it')}
        </button>
      </div>
    </Modal>
  );
};

export default TrayHintModal;
