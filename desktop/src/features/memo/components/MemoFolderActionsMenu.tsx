import { Menu } from '@mantine/core';

import {
  Folder,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
} from '../../../components/icons';
import type { MemoFolder, MemoFolderMode } from '../../../types';

interface MemoFolderActionsMenuProps {
  folder: MemoFolder;
  onCreateMemoInFolder: (folderId: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onEditFolder: () => void;
  onUpdateFolderMode: (folderId: string, mode: MemoFolderMode) => Promise<void>;
  t: (korean: string, english: string) => string;
}

const MemoFolderActionsMenu = ({
  folder,
  onCreateMemoInFolder,
  onDeleteFolder,
  onEditFolder,
  onUpdateFolderMode,
  t,
}: MemoFolderActionsMenuProps) => (
  <Menu position="bottom-end" shadow="md" width={184}>
    <Menu.Target>
      <button
        aria-label={t(`${folder.name} 폴더 메뉴`, `${folder.name} folder menu`)}
        className="memo-folder-more"
        type="button"
      >
        <MoreHorizontal size={15} />
      </button>
    </Menu.Target>
    <Menu.Dropdown>
      <Menu.Item
        leftSection={<Plus size={15} />}
        onClick={() => void onCreateMemoInFolder(folder.id)}
      >
        {t('이 폴더에 새 메모', 'New note in this folder')}
      </Menu.Item>
      <Menu.Item
        leftSection={folder.mode === 'automatic' ? <Folder size={15} /> : <Sparkles size={15} />}
        onClick={() => void onUpdateFolderMode(
          folder.id,
          folder.mode === 'automatic' ? 'manual' : 'automatic',
        )}
      >
        {folder.mode === 'automatic'
          ? t('수동 폴더로 변경', 'Make manual')
          : t('자동 폴더로 변경', 'Make automatic')}
      </Menu.Item>
      <Menu.Item onClick={onEditFolder}>
        {t('이름과 설명 변경', 'Edit name and description')}
      </Menu.Item>
      <Menu.Item
        color="red"
        leftSection={<Trash2 size={15} />}
        onClick={() => {
          if (window.confirm(t(
            '폴더만 삭제합니다. 메모는 삭제되지 않습니다.',
            'Delete this folder? Its notes will stay.',
          ))) void onDeleteFolder(folder.id);
        }}
      >
        {t('폴더 삭제', 'Delete folder')}
      </Menu.Item>
    </Menu.Dropdown>
  </Menu>
);

export default MemoFolderActionsMenu;
