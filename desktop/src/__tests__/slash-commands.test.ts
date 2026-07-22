import { describe, expect, it } from 'vitest';
import {
  filterSlashCommands,
  SLASH_COMMANDS,
} from '../components/tiptap-ui/slash-command-menu/slash-commands';

describe('slash commands', () => {
  it('정확히 10개의 블록 명령을 제공한다', () => {
    expect(SLASH_COMMANDS.map(command => command.label)).toEqual([
      '제목',
      '목록',
      '번호 목록',
      '체크리스트',
      '인용',
      '코드',
      '구분선',
      '표',
      '이미지',
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
});
