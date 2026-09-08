import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/auth/useAuthSessionBootstrap.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('auth session bootstrap boundary', () => {
  it('keeps App with auth bootstrap wiring only', () => {
    expect(appSource).toContain(
      "import { useAuthSessionBootstrap } from './features/auth/useAuthSessionBootstrap';",
    );
    expect(appSource).toContain('useAuthSessionBootstrap({');
    expect(appSource).not.toContain('supabase.auth.onAuthStateChange');
  });

  it('hydrates local workspace before checking the initial session', () => {
    expect(source.indexOf('void applyLocalWorkspace();')).toBeLessThan(
      source.indexOf('getInitialSession()'),
    );
    expect(source).toContain('await activateSession(nextSession, { migrateLegacy: true });');
    expect(source).toContain('deactivateSession();');
  });

  it('keeps the Supabase configuration fallback visible and non-blocking', () => {
    expect(source).toContain('if (!isSupabaseConfigured())');
    expect(source).toContain('setBooting(false);');
    expect(source).toContain('최초 로그인에는 온라인 연결과 Supabase 설정이 필요합니다.');
  });

  it('routes auth events through the decision table', () => {
    expect(source).toContain('const decision = decideAuthEvent({');
    expect(source).toContain("if (decision.action === 'deactivate')");
    expect(source).toContain("if (decision.action === 'update')");
    expect(source).toContain("if (decision.action === 'activate')");
  });

  it('invalidates pending work and unsubscribes on cleanup', () => {
    expect(source).toContain('sessionActivationIdRef.current += 1;');
    expect(source).toContain('workspaceLoadIdRef.current += 1;');
    expect(source).toContain('data.subscription.unsubscribe();');
  });

  it('uses one effect with stable lifecycle dependencies', () => {
    expect(source.match(/useEffect\(/g)).toHaveLength(1);
    expect(source).toContain('activateSession,');
    expect(source).toContain('deactivateSession,');
  });

  it('keeps App translation lookup stable so auth bootstrap cannot restore on every render', () => {
    expect(appSource).toContain(
      'const uiLanguageRef = useRef(appSettings.uiLanguage);',
    );
    expect(appSource).toContain('const t = useCallback(');
    expect(appSource).toContain('localize(uiLanguageRef.current, korean, english)');
  });
});
