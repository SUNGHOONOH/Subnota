import { describe, expect, it } from 'vitest';
import { joinNoteContent, splitNoteContent } from '../lib/noteTitle';

describe('noteTitle split/join', () => {
  it('첫 줄을 제목으로, 나머지를 본문으로 나눈다', () => {
    expect(splitNoteContent('3분기 로드맵 초안\n# 3분기 로드맵\n본문')).toEqual({
      body: '# 3분기 로드맵\n본문',
      title: '3분기 로드맵 초안',
    });
  });

  it('개행 없는 콘텐츠는 전체가 제목이다', () => {
    expect(splitNoteContent('한 줄 메모')).toEqual({
      body: '',
      title: '한 줄 메모',
    });
  });

  it('split → join 왕복이 안정적이다', () => {
    const content = '제목\n본문 첫 줄\n\n본문 둘째 줄';
    const { body, title } = splitNoteContent(content);
    expect(joinNoteContent(title, body)).toBe(content);
  });

  it('제목이 비어도 본문 첫 줄이 제목으로 튀어오르지 않는다', () => {
    const joined = joinNoteContent('', '본문만 있는 노트');
    expect(splitNoteContent(joined)).toEqual({
      body: '본문만 있는 노트',
      title: '',
    });
  });

  it('제목과 본문이 모두 비면 빈 콘텐츠(초안 유지)다', () => {
    expect(joinNoteContent('', '')).toBe('');
  });

  it('제목의 개행은 공백으로 바꾼다', () => {
    expect(splitNoteContent(joinNoteContent('줄1\n줄2', '본문')).title).toBe(
      '줄1 줄2',
    );
  });
});
