import type { ReactElement } from 'react';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ExpandableRow,
  Row,
  RowAction,
  Section,
} from '../features/settings/SettingsPrimitives';

const render = (node: ReactElement) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

describe('SettingsPrimitives', () => {
  it('keeps the settings row and card DOM primitives', () => {
    const markup = render(
      <Section title="Writing" description="Description">
        <Row
          action={<RowAction>Done</RowAction>}
          description="Value"
          label="Label"
        />
      </Section>,
    );

    expect(markup).toContain('settings-reference-group');
    expect(markup).toContain('settings-reference-card');
    expect(markup).toContain('settings-reference-row');
    expect(markup).toContain('settings-reference-link');
  });

  it('renders collapsed and expanded rows through the same primitive boundary', () => {
    const collapsed = render(
      <ExpandableRow
        expanded={false}
        language="ko"
        label="언어"
        onClose={() => undefined}
        onOpen={() => undefined}
        value="한국어"
      >
        <input />
      </ExpandableRow>,
    );
    const expanded = render(
      <ExpandableRow
        expanded
        language="en"
        label="Language"
        onClose={() => undefined}
        onOpen={() => undefined}
        value="English"
      >
        <input />
      </ExpandableRow>,
    );

    expect(collapsed).toContain('한국어');
    expect(collapsed).toContain('편집');
    expect(expanded).toContain('settings-reference-expanded');
    expect(expanded).toContain('Done');
    expect(expanded).not.toContain('settings-reference-link');
  });
});
