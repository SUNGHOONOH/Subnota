import { describe, expect, it } from 'vitest';
import { Schema } from '@tiptap/pm/model';

import { buildDecorations } from '../components/tiptap-extension/date-highlight-extension';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
  },
  marks: {
    bold: {},
  },
});

describe('date highlight decorations', () => {
  it('텍스트 노드 오프셋을 문서 위치로 매핑한다', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('회의 3월 6일')]),
    ]);

    const decorations = buildDecorations(doc).find();

    expect(decorations).toHaveLength(1);
    // 문단 콘텐츠는 pos 1부터, "3월 6일"은 오프셋 3에서 시작한다.
    expect(decorations[0].from).toBe(4);
    expect(decorations[0].to).toBe(9);
  });

  it('마크 경계로 쪼개진 날짜도 하나로 인식한다', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('3월', [schema.mark('bold')]),
        schema.text(' 6일 회의'),
      ]),
    ]);

    const decorations = buildDecorations(doc).find();

    expect(decorations).toHaveLength(1);
    expect(decorations[0].from).toBe(1);
    expect(decorations[0].to).toBe(6); // "3월 6일"
  });
});
