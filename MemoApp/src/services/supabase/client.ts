import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

const supabaseUrl = typeof SUPABASE_URL === 'string' ? SUPABASE_URL : '';
const supabaseAnonKey =
  typeof SUPABASE_ANON_KEY === 'string' ? SUPABASE_ANON_KEY : '';
const fallbackSupabaseUrl = 'https://example.supabase.co';

export const supabase = createClient(supabaseUrl || fallbackSupabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: false,
    flowType: 'implicit',
    persistSession: true,
    storage: AsyncStorage,
  },
});

export const isSupabaseConfigured = () => {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
};
