import { Menu } from '@mantine/core';
import {
  Check,
  Folder,
  Pin,
  PinSolid,
  Trash2,
} from '@/components/icons';
import type {
  MemoFolder,
  MemoFolderMembership,
} from '../../../types';

export interface MemoContextMenuProps {
  folders: MemoFolder[];
  folderMemberships: MemoFolderMembership[];
  memoMenu: { id: string; x: number; y: number };
  onClose: () => void;
  onDeleteMemoById: (memoId: string) => void;
  onToggleMemoFolder: (folderId: string, memoId: string) => Promise<void>;
  onTogglePinMemo?: (memoId: string) => void;
  pinnedMemoIds: string[];
  t: (korean: string, english: string) => string;
}

const MemoContextMenu = ({
  folders,
  folderMemberships,
  memoMenu,
  onClose,
  onDeleteMemoById,
  onToggleMemoFolder,
  onTogglePinMemo,
  pinnedMemoIds,
  t,
}: MemoContextMenuProps) => (
  <Menu
    opened
    onClose={onClose}
    position="bottom-start"
    offset={2}
    width={160}
    shadow="md"
  >
    <Menu.Target>
      <div
        style={{
          position: 'fixed',
          left: memoMenu.x,
          top: memoMenu.y,
          width: 0,
          height: 0,
        }}
      />
    </Menu.Target>
    <Menu.Dropdown>
      {onTogglePinMemo && (
        <Menu.Item
          leftSection={
            pinnedMemoIds.includes(memoMenu.id) ? (
              <PinSolid size={16} />
            ) : (
              <Pin size={16} />
            )
          }
          onClick={() => {
            const target = memoMenu.id;
            onClose();
            onTogglePinMemo(target);
          }}
        >
          {pinnedMemoIds.includes(memoMenu.id)
            ? t('고정 해제', 'Unpin')
            : t('고정', 'Pin')}
        </Menu.Item>
      )}
      {folders.length > 0 && (
        <>
          <Menu.Divider />
          <Menu.Label>{t('폴더', 'Folders')}</Menu.Label>
          {folders.map(folder => {
            const isAssigned = folderMemberships.some(
              membership =>
                membership.folderId === folder.id &&
                membership.memoId === memoMenu.id,
            );
            const isAssignedElsewhere = folderMemberships.some(
              membership =>
                membership.memoId === memoMenu.id &&
                membership.folderId !== folder.id,
            );
            return (
              <Menu.Item
                disabled={!isAssigned && isAssignedElsewhere}
                key={folder.id}
                leftSection={
                  isAssigned ? <Check size={15} /> : <Folder size={15} />
                }
                onClick={() => {
                  const memoId = memoMenu.id;
                  onClose();
                  void onToggleMemoFolder(folder.id, memoId);
                }}
              >
                {isAssignedElsewhere && !isAssigned
                  ? t(
                      `${folder.name} · 먼저 기존 폴더에서 제거`,
                      `${folder.name} · remove from current folder first`,
                    )
                  : folder.name}
              </Menu.Item>
            );
          })}
        </>
      )}
      <Menu.Divider />
      <Menu.Item
        color="red"
        leftSection={<Trash2 size={16} />}
        onClick={() => {
          const target = memoMenu.id;
          onClose();
          if (window.confirm(t('이 메모를 삭제하시겠습니까?', 'Delete this note?'))) {
            onDeleteMemoById(target);
          }
        }}
      >
        {t('삭제', 'Delete')}
      </Menu.Item>
    </Menu.Dropdown>
  </Menu>
);

export default MemoContextMenu;
