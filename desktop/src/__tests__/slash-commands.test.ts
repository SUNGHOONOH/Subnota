import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import {
  filterSlashCommands,
  parseSlashQuery,
  SLASH_COMMANDS,
} from '../components/tiptap-ui/slash-command-menu/slash-commands';

describe('slash commands', () => {
  it('링크를 포함한 본문 블록 명령을 제공한다', () => {
    expect(SLASH_COMMANDS.map(command => command.label)).toEqual([
      '제목',
      '목록',
      '번호 목록',
      '체크리스트',
      '인용',
      '코드',
      '구분선',
      '링크',
    ]);
  });

  it('빈 검색어는 전체를 반환한다', () => {
    expect(filterSlashCommands('')).toHaveLength(SLASH_COMMANDS.length);
  });

  it('한국어 라벨로 필터링한다', () => {
    expect(filterSlashCommands('체크').map(command => command.id)).toEqual([
      'task-list',
    ]);
  });

  it('영문 키워드로도 필터링한다', () => {
    const ids = filterSlashCommands('code').map(command => command.id);
    expect(ids).toContain('code-block');
  });

  it('일치 없음이면 빈 배열', () => {
    expect(filterSlashCommands('없는명령')).toEqual([]);
  });

  it('커서 직전의 최신 슬래시 검색어와 삭제 시작 위치를 계산한다', () => {
    expect(parseSlashQuery('기존 제목 /번호', 12)).toEqual({
      anchorPos: 9,
      query: '번호',
    });
    expect(parseSlashQuery('기존 제목 /제목', 12)?.query).toBe('제목');
    expect(parseSlashQuery('기존 제목 /', 10)?.query).toBe('');
    expect(parseSlashQuery('기존 제목 /번호 목록 ', 15)).toBeNull();
  });

  it.each([
    ['목록', 'bullet-list', 'bulletList'],
    ['번호', 'ordered-list', 'orderedList'],
  ])('제목 블록 안에서도 %s 명령으로 목록으로 전환한다', (_query, id, nodeName) => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: {
        type: 'doc',
        content: [{
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: `/${_query}` }],
        }],
      },
    });
    const commandEnd = 2 + _query.length;
    editor.commands.setTextSelection(commandEnd);

    const command = SLASH_COMMANDS.find(item => item.id === id);
    expect(command).toBeDefined();
    editor.chain().deleteRange({ from: 1, to: commandEnd }).run();
    command?.run(editor);

    expect(editor.state.doc.firstChild?.type.name).toBe(nodeName);
    editor.destroy();
  });
});
