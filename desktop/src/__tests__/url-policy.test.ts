import { describe, expect, it } from 'vitest';

import {
  normalizeExternalUrl,
  normalizeOAuthAuthorizeUrl,
  normalizeWebUrl,
} from '../lib/url-policy';

describe('URL policy', () => {
  it('accepts normal web URLs and rejects privileged or local schemes', () => {
    expect(normalizeWebUrl('https://example.com/path')).toBe(
      'https://example.com/path',
    );
    expect(normalizeWebUrl('file:///Users/example/private.md')).toBeNull();
    expect(normalizeWebUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeWebUrl('https://user:pass@example.com')).toBeNull();
  });

  it('allows mailto only for generic external links', () => {
    expect(normalizeExternalUrl('mailto:hello@example.com')).toBe(
      'mailto:hello@example.com',
    );
    expect(normalizeWebUrl('mailto:hello@example.com')).toBeNull();
  });

  it('requires the exact configured Supabase OAuth origin and path', () => {
    const configured = 'https://project.supabase.co';
    expect(
      normalizeOAuthAuthorizeUrl(
        'https://project.supabase.co/auth/v1/authorize?provider=google',
        configured,
      ),
    ).toBe(
      'https://project.supabase.co/auth/v1/authorize?provider=google',
    );
    expect(
      normalizeOAuthAuthorizeUrl(
        'https://attacker.example/auth/v1/authorize',
        configured,
      ),
    ).toBeNull();
    expect(
      normalizeOAuthAuthorizeUrl(
        'https://project.supabase.co/other/auth/v1/authorize',
        configured,
      ),
    ).toBeNull();
  });

  it('allows configured localhost HTTP only in development mode', () => {
    const url = 'http://localhost:54321/auth/v1/authorize';
    expect(
      normalizeOAuthAuthorizeUrl(url, 'http://localhost:54321', {
        allowLocalHttp: true,
      }),
    ).toBe(url);
    expect(
      normalizeOAuthAuthorizeUrl(url, 'http://localhost:54321'),
    ).toBeNull();
  });
});
