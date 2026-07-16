// Drains the offline write queue when connectivity or focus returns. Peer
// local-first apps (Notion, Obsidian, Joplin, Linear) all re-sync on reconnect;
// without this, edits made offline stay pending until an app restart or screen
// change. `drain` should no-op when there is no session. Returns a cleanup fn.
export const registerReconnectSync = (drain: () => Promise<void>): (() => void) => {
  let inFlight = false;
  const run = () => {
    if (inFlight || !navigator.onLine) return;
    inFlight = true;
    void drain().finally(() => {
      inFlight = false;
    });
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') run();
  };
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisibility);
  };
};
