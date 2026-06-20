// Mock the network service so importing useAmbient doesn't pull the supabase
// client — we only want the pure helper.
jest.mock('../src/features/network/services/networkService', () => ({
  searchCursorNetwork: jest.fn(),
}));

import { findClosestTextIndex } from '../src/features/memo/hooks/useAmbient';

describe('findClosestTextIndex', () => {
  it('returns the index of a single occurrence', () => {
    expect(findClosestTextIndex('hello world', 'world', 0)).toBe(6);
  });

  it('clamps to the cursor when the target is not found', () => {
    expect(findClosestTextIndex('hello world', 'xyz', 3)).toBe(3);
    expect(findClosestTextIndex('abc', 'xyz', 100)).toBe(3); // clamp to length
  });

  it('clamps to the cursor when the target is empty/whitespace', () => {
    expect(findClosestTextIndex('hello', '   ', 2)).toBe(2);
  });

  it('picks the occurrence closest to the cursor, not the first', () => {
    // "abc" at indices 0, 4, 8. Cursor at 9 sits inside the last one.
    expect(findClosestTextIndex('abc abc abc', 'abc', 9)).toBe(8);
  });

  it('prefers an occurrence the cursor is inside over earlier ones', () => {
    // occurrences at 0 and 4; cursor 5 is inside [4,7].
    expect(findClosestTextIndex('abc abc', 'abc', 5)).toBe(4);
  });

  it('keeps the earlier occurrence on a distance tie', () => {
    // occurrences at 0 ([0,3]) and 4 ([4,7]); cursor 0 is inside the first.
    expect(findClosestTextIndex('abc abc', 'abc', 0)).toBe(0);
  });

  it('trims the target before matching', () => {
    expect(findClosestTextIndex('one two three', '  two  ', 12)).toBe(4);
  });
});
