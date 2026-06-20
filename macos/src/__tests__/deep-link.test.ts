import { describe, expect, it } from 'vitest';
import { parseSubnotaUrl } from '../deep-link';

describe('parseSubnotaUrl', () => {
  it('parses a memo link with text', () => {
    expect(parseSubnotaUrl('subnota://memo?text=hello%20world')).toEqual({
      kind: 'memo',
      text: 'hello world',
    });
  });

  it('parses a memo link with empty text', () => {
    expect(parseSubnotaUrl('subnota://memo')).toEqual({ kind: 'memo', text: '' });
  });

  it('parses a capture link with url and title', () => {
    expect(
      parseSubnotaUrl(
        'subnota://capture?url=https%3A%2F%2Fexample.com&title=Example',
      ),
    ).toEqual({
      kind: 'capture',
      url: 'https://example.com',
      title: 'Example',
    });
  });

  it('parses a capture link without a title', () => {
    expect(parseSubnotaUrl('subnota://capture?url=https%3A%2F%2Fexample.com')).toEqual({
      kind: 'capture',
      url: 'https://example.com',
      title: '',
    });
  });

  it('rejects a capture link without a url', () => {
    expect(parseSubnotaUrl('subnota://capture?title=Example')).toBeNull();
  });

  it('rejects unknown actions', () => {
    expect(parseSubnotaUrl('subnota://unknown?text=x')).toBeNull();
  });

  it('rejects non-subnota schemes', () => {
    expect(parseSubnotaUrl('https://example.com/memo?text=x')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseSubnotaUrl('not a url')).toBeNull();
  });
});
