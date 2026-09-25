import type { Session } from '@supabase/supabase-js';

import { getSession } from '../../services/supabase/data';

export const BOOT_SYNC_TIMEOUT_MS = 8000;

export const waitForBootSync = async (syncPromise: Promise<void>) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      syncPromise,
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, BOOT_SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const getInitialSession = async (): Promise<Session | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    // Auth storage/네트워크가 지연돼도 로컬 우선 화면 진입을 막지 않는다.
    return await Promise.race([
      getSession(),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), BOOT_SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};
