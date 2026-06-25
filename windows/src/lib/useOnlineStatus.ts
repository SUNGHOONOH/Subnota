import { useEffect, useState } from 'react';

// Tracks browser online/offline state so the UI can explain that a
// network-only feature (요약/검색) is unavailable while offline, and recover
// automatically once the connection returns.
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
};
