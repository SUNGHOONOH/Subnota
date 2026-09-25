import type { ReactNode } from 'react';
import {
  Anchor,
  Box,
  Button,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';

import type { AppSettings } from '../../lib/appSettings';
import { localize } from '../../lib/uiLanguage';

export function RowAction({
  children,
  className,
  color,
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Anchor
      aria-disabled={disabled ? 'true' : undefined}
      c={color}
      className={
        className
          ? `settings-reference-link ${className}`
          : 'settings-reference-link'
      }
      component="button"
      onClick={disabled ? undefined : onClick}
      type="button"
    >
      {children}
    </Anchor>
  );
}

export function Row({
  action,
  description,
  label,
}: {
  action?: ReactNode;
  description?: ReactNode;
  label: ReactNode;
}) {
  // 구분선을 행이 직접 그리지 않는다. 묶음 카드가 자식 사이에만 선을 넣어
  // 마지막 행 아래 선이 남지 않게 한다(.settings-reference-card > * + *).
  return (
    <Group
      align="flex-start"
      className="settings-reference-row"
      gap={24}
      justify="space-between"
      wrap="nowrap"
    >
      <Box miw={0}>
        <Text className="settings-reference-row-label">{label}</Text>
        {description && (
          <Text className="settings-reference-row-value">{description}</Text>
        )}
      </Box>
      {action}
    </Group>
  );
}

export function Section({
  children,
  description,
  title,
}: {
  children?: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <section className="settings-reference-group">
      <Title className="settings-reference-section-title" order={3}>
        {title}
      </Title>
      {description && (
        <Text className="settings-reference-section-description">
          {description}
        </Text>
      )}
      <div className="settings-reference-card">{children}</div>
    </section>
  );
}

export function ExpandableRow({
  children,
  expanded,
  language,
  label,
  onClose,
  onOpen,
  value,
}: {
  children: ReactNode;
  expanded: boolean;
  language: AppSettings['uiLanguage'];
  label: string;
  onClose: () => void;
  onOpen: () => void;
  value: string;
}) {
  if (!expanded) {
    return (
      <Row
        action={<RowAction onClick={onOpen}>{localize(language, '편집', 'Edit')}</RowAction>}
        description={value}
        label={label}
      />
    );
  }

  return (
    <Stack
      className="settings-reference-expanded"
      gap={16}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <Text className="settings-reference-row-label">{label}</Text>
      {children}
      <Group gap={8}>
        <Button className="settings-reference-save" onClick={onClose}>
          {localize(language, '완료', 'Done')}
        </Button>
      </Group>
    </Stack>
  );
}
