import type { ChangeEvent } from 'react';

import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';

import SubnotaSpinner from '../../components/SubnotaSpinner';

type Translate = (korean: string, english: string) => string;

interface SettingsDeleteAccountDialogProps {
  deleteConfirmation: string;
  deleteError: string | null;
  deleteWord: string;
  isDeletingAccount: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onChangeConfirmation: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  translate: Translate;
}

export default function SettingsDeleteAccountDialog({
  deleteConfirmation,
  deleteError,
  deleteWord,
  isDeletingAccount,
  isOpen,
  onCancel,
  onChangeConfirmation,
  onClose,
  onSubmit,
  translate: t,
}: SettingsDeleteAccountDialogProps) {
  return (
    <Modal
      centered
      closeOnClickOutside={!isDeletingAccount}
      closeOnEscape={!isDeletingAccount}
      onClose={onClose}
      opened={isOpen}
      overlayProps={{ backgroundOpacity: 0.42, blur: 2 }}
      padding="md"
      radius="md"
      shadow="sm"
      size={380}
      title={t('계정 삭제', 'Delete account')}
      withCloseButton={!isDeletingAccount}
    >
      <Stack gap={10}>
        <Text size="sm">
          {t(
            '계정과 저장된 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.',
            'Deletes your account and saved data. This cannot be undone.',
          )}
        </Text>
        <Text c="dimmed" size="xs">
          {t(
            `계속하려면 아래에 ‘${deleteWord}’를 입력하세요.`,
            `Type '${deleteWord}' below to continue.`,
          )}
        </Text>
        <TextInput
          autoComplete="off"
          autoFocus
          disabled={isDeletingAccount}
          aria-label={t('계정 삭제 확인', 'Confirm account deletion')}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChangeConfirmation(event.currentTarget.value)
          }
          placeholder={deleteWord}
          size="sm"
          value={deleteConfirmation}
        />
        {deleteError && (
          <Text c="red" role="alert" size="xs">
            {deleteError}
          </Text>
        )}
        <Group gap="xs" justify="flex-end" mt={2}>
          <Button
            disabled={isDeletingAccount}
            onClick={onCancel}
            size="sm"
            variant="subtle"
          >
            {t('취소', 'Cancel')}
          </Button>
          <Button
            color="red"
            disabled={deleteConfirmation.trim() !== deleteWord || isDeletingAccount}
            leftSection={isDeletingAccount ? <SubnotaSpinner size={16} /> : undefined}
            onClick={onSubmit}
            size="sm"
          >
            {isDeletingAccount
              ? t('삭제 중…', 'Deleting…')
              : deleteError
                ? t('다시 시도', 'Try again')
                : t('삭제', 'Delete')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
