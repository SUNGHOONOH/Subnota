import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  NativeModules,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import Navigation from './src/app/Navigation';
import { navigateToInbox } from './src/app/navigationRef';
import AuthScreen from './src/features/auth/AuthScreen';
import { emitInboxItemSaved } from './src/features/inbox/inboxEvents';
import { supabase } from './src/services/supabase/client';
import { createInboxSession } from './src/services/backend/inboxService';
import { recordMenuBarInboxSave } from './src/services/native/subnotaMenuBar';
import {
  completeOAuthCallback,
  isSupabaseAuthCallback,
} from './src/services/supabase/oauth';
import { syncLocalData } from './src/services/supabase/syncService';
import { useMemoStore } from './src/store/useMemoStore';

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
      })
      .finally(() => setIsAuthReady(true));
  }, []);

  useEffect(() => {
    const handleAuthCallback = async (url: string | null) => {
      if (!url || !isSupabaseAuthCallback(url)) {
        return;
      }

      try {
        await completeOAuthCallback(url);
        const {
          data: { session: nextSession },
        } = await supabase.auth.getSession();
        setSession(nextSession);
      } catch (error) {
        Alert.alert(
          'Google 로그인 실패',
          error instanceof Error
            ? error.message
            : '로그인 callback을 처리하지 못했습니다.',
        );
      }
    };

    Linking.getInitialURL().then(handleAuthCallback).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => {
      handleAuthCallback(event.url).catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const runInitialSync = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession) {
        return;
      }

      syncLocalData({ force: true }).catch(() => undefined);
    };

    const unsubscribeHydration = useMemoStore.persist.hasHydrated()
      ? undefined
      : useMemoStore.persist.onFinishHydration(runInitialSync);

    if (useMemoStore.persist.hasHydrated()) {
      runInitialSync();
    }

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'background') {
        syncLocalData({ force: true }).catch(() => undefined);
        return;
      }

      if (nextState === 'active') {
        syncLocalData().catch(() => undefined);
      }
    });
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        syncLocalData({ force: true }).catch(() => undefined);
      }
    });

    return () => {
      unsubscribeHydration?.();
      subscription.remove();
      authSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const captureKeys = new Set<string>();
    const handleUrl = async (url: string | null) => {
      if (!url) {
        return;
      }

      const parsed = new URL(url);
      if (parsed.protocol !== 'subnota:' || parsed.hostname !== 'capture') {
        return;
      }

      const captureUrl = parsed.searchParams.get('url');
      if (!captureUrl) {
        // Opens the app from Mini Subnota without creating an inbox item.
        navigateToInbox();
        return;
      }

      const captureKey = `${captureUrl}:${parsed.searchParams.get('title') ?? ''}`;
      if (captureKeys.has(captureKey)) {
        return;
      }
      captureKeys.add(captureKey);

      try {
        const item = await createInboxSession({
          rawSharedText: parsed.searchParams.get('title'),
          selectedText: parsed.searchParams.get('selectedText'),
          url: captureUrl,
        });
        emitInboxItemSaved(item);
        recordMenuBarInboxSave(item);
        if (Platform.OS !== 'macos') {
          Alert.alert('수집함에 저장됨', '공유한 링크를 Subnota 수집함에 저장했습니다.');
        }
      } catch {
        Alert.alert('저장 실패', '공유한 링크를 저장하지 못했습니다.');
      }
    };

    Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => {
      handleUrl(event.url).catch(() => undefined);
    });

    return () => {
      subscription.remove();
      captureKeys.clear();
    };
  }, [session]);

  useEffect(() => {
    if (!session || Platform.OS !== 'ios') {
      return;
    }

    const consumePendingShares = async () => {
      const module = NativeModules.SubnotaShareInboxModule as
        | {
            consumePendingShares?: () => Promise<
              Array<{
                rawSharedText?: string;
                selectedText?: string;
                url?: string;
                userNote?: string;
              }>
            >;
          }
        | undefined;

      const payloads = await module?.consumePendingShares?.();
      if (!payloads?.length) {
        return;
      }

      for (const payload of payloads) {
        if (!payload.url) {
          continue;
        }

        await createInboxSession({
          rawSharedText: payload.rawSharedText,
          selectedText: payload.selectedText,
          url: payload.url,
          userNote: payload.userNote,
        });
      }

      Alert.alert('수집함에 저장됨', `${payloads.length}개의 공유 항목을 저장했습니다.`);
    };

    consumePendingShares().catch(() => undefined);
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        consumePendingShares().catch(() => undefined);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [session]);

  if (!isAuthReady) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <View style={styles.loadingScreen}>
            <ActivityIndicator color="#1D1D1F" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        {session ? <Navigation /> : <AuthScreen />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
    flex: 1,
    justifyContent: 'center',
  },
});

export default App;
