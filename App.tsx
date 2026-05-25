import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import Navigation from './src/app/Navigation';
import AuthScreen from './src/features/auth/AuthScreen';
import { supabase } from './src/services/supabase/client';
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
