import { describe, it, expect, vi, beforeEach } from 'vitest'
import { copyCodeToClipboard } from '../lib/copy-code'

describe('copyCodeToClipboard', () => {
  let copyText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    copyText = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('window', { electronAPI: { copyText } })
  })

  it('writes the code text to the clipboard and returns true', async () => {
    const code = 'const x = 1\nconsole.log(x)'
    const result = await copyCodeToClipboard(code)
    expect(result).toBe(true)
    expect(copyText).toHaveBeenCalledWith(code)
  })

  it('returns false and does not write to clipboard when code is empty string', async () => {
    const result = await copyCodeToClipboard('')
    expect(result).toBe(false)
    expect(copyText).not.toHaveBeenCalled()
  })

  it('preserves whitespace and newlines exactly', async () => {
    const code = '  function foo() {\n    return 42\n  }\n'
    await copyCodeToClipboard(code)
    expect(copyText).toHaveBeenCalledWith(code)
  })

  it('returns false when the clipboard bridge rejects the write', async () => {
    copyText.mockRejectedValueOnce(new Error('Clipboard unavailable'))

    const result = await copyCodeToClipboard('markdown')

    expect(result).toBe(false)
  })

  it('returns false when the clipboard bridge cannot write the text', async () => {
    copyText.mockResolvedValueOnce(false)

    const result = await copyCodeToClipboard('markdown')

    expect(result).toBe(false)
  })
})
