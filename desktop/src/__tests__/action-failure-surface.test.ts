import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('사용자가 누른 것이 실패하면 그 자리에서 알린다', () => {
  // 낙관적 업데이트라 화면은 성공한 것처럼 보이고, 실패하면 조용히 원복된다.
  // 알리지 않으면 "지웠는데 왜 다시 생겼지"가 된다.
  it('직접 행동 실패는 다이얼로그로 알린다', () => {
    for (const message of [
      '메모를 삭제하지 못했습니다.',
      '일정을 저장하지 못했습니다.',
      '일정을 삭제하지 못했습니다.',
      '완료 표시를 저장하지 못했습니다.',
      '좋아요를 저장하지 못했습니다.',
      '링크를 삭제하지 못했습니다.',
    ]) {
      expect(app).toContain(`window.alert('${message}`);
    }
  });

  // "로컬"·"수집 항목"은 내부 용어다. 사용자가 보는 이름으로 말한다.
  it('내부 용어를 쓰지 않는다', () => {
    expect(app).not.toContain('로컬에 삭제하지 못했습니다');
    expect(app).not.toContain('로컬에 저장하지 못했습니다');
    expect(app).not.toContain('수집 항목을 로컬에서');
  });
});

describe('웹 클리핑은 다이얼로그를 띄우지 않는다', () => {
  // 같은 함수를 수동 저장과 클리핑이 같이 쓴다. 구분하지 않으면 브라우저를
  // 보는 중에 Subnota 모달이 튀어나온다.
  it('호출자를 구분해 수동 저장에서만 알린다', () => {
    expect(app).toContain("{ source = 'clip' }: { source?: 'clip' | 'manual' } = {}");
    expect(app).toContain("if (source === 'manual') window.alert(message);");
    expect(app).toContain("saveInboxUrl(url, { source: 'manual' })");
  });

  // 클리핑 경로는 인자를 주지 않는다 — 기본값이 'clip'이다.
  it('클리핑 경로는 기본값을 쓴다', () => {
    expect(app).toContain('saveInboxUrlRef.current(url)');
  });
});

describe('배경에서 복구되는 실패는 조용히 넘긴다', () => {
  it('왜 조용한지 코드에 남긴다', () => {
    expect(app).toContain('사용자가 할 수 있는 일이 없어 조용히 넘긴다');
    expect(app).toContain('탭을 다시 열면 재조회된다');
  });

  // `setError`가 로그인 화면 전용이라는 사실이 코드에서 보여야, 다음 사람이
  // "메시지를 넣었으니 보이겠지"라고 오해하지 않는다.
  it('error 상태가 로그인 화면 전용임을 못박는다', () => {
    const declaration = app.slice(
      app.indexOf('const [error, setError]') - 400,
      app.indexOf('const [error, setError]'),
    );

    expect(declaration).toContain('로그인 화면에서만');
    expect(declaration).toContain('window.alert');
  });
});
