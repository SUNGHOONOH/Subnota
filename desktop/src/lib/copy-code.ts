export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    return await window.electronAPI.copyText(text)
  } catch {
    return false
  }
}

export const copyCodeToClipboard = copyTextToClipboard
