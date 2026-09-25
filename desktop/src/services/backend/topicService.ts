import { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../supabase/client';

const getBackendUrl = () =>
  (import.meta.env.VITE_MEMO_BACKEND_URL ?? '').trim();

/** A full topic rebuild is deliberately user-triggered; normal topic updates run
 * incrementally in the backend after a memo changes. */
export const regenerateTopics = async (session: Session) => {
  const backendUrl = getBackendUrl();
  if (!backendUrl) throw new Error('VITE_MEMO_BACKEND_URL is not configured.');
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');

  const request = (token: string) =>
    fetch(`${backendUrl.replace(/\/$/, '')}/topic-discovery/regenerate`, {
      headers: { Authorization: `Bearer ${token}` },
      method: 'POST',
    });

  let response = await request(session.access_token);
  if (response.status === 401) {
    const {
      data: { session: refreshedSession },
    } = await supabase.auth.refreshSession();
    if (refreshedSession?.access_token) {
      response = await request(refreshedSession.access_token);
    }
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = ((await response.json()) as { detail?: string }).detail ?? '';
    } catch {
      // Keep the HTTP status fallback below.
    }
    throw new Error(detail || `Topic regeneration failed: ${response.status}`);
  }
};
