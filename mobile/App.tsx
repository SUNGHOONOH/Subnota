import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  NativeModules,
  Platform,
  StyleSheet,
  View,
  Text,
  TextInput,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import Navigation from './src/app/Navigation';
import AuthScreen from './src/features/auth/AuthScreen';
import { emitInboxItemSaved } from './src/features/inbox/inboxEvents';
import { supabase } from './src/shared/supabase/client';
import { saveInboxSession } from './src/features/inbox/services/inboxApi';
import {
  recordMenuBarInboxSave,
  resizeWindowForLogin,
  restoreWindowAfterLogin,
} from './src/shared/native/subnotaMenuBar';
import {
  completeOAuthCallback,
  isSupabaseAuthCallback,
} from './src/features/auth/services/oauth';
import { syncLocalData } from './src/app/sync/syncService';
import { useMemoStore } from './src/store/useMemoStore';
import { appStorage } from './src/shared/storage/appStorage';

const DEFAULT_FONT = Platform.OS === 'macos' ? 'Apple SD Gothic Neo' : undefined;

if (DEFAULT_FONT) {
  const DefaultText = Text as typeof Text & { defaultProps?: { style?: object } };
  const DefaultTextInput = TextInput as typeof TextInput & {
    defaultProps?: { style?: object };
  };

  if (DefaultText.defaultProps) {
    DefaultText.defaultProps.style = {
      fontFamily: DEFAULT_FONT,
      ...DefaultText.defaultProps.style,
    };
  } else {
    DefaultText.defaultProps = { style: { fontFamily: DEFAULT_FONT } };
  }

  if (DefaultTextInput.defaultProps) {
    DefaultTextInput.defaultProps.style = {
      fontFamily: DEFAULT_FONT,
      ...DefaultTextInput.defaultProps.style,
    };
  } else {
    DefaultTextInput.defaultProps = { style: { fontFamily: DEFAULT_FONT } };
  }
}

const LOCAL_AUTH_ACCESS_KEY = 'subnota.hasLocalAuthAccess';

const getCaptureSuccessMessage = (summaryStatus?: string | null) => {
  if (summaryStatus === 'partial') {
    return 'URL과 메타데이터를 저장했습니다. 본문 요약은 제한적입니다.';
  }
  if (summaryStatus === 'failed' || summaryStatus === 'unsupported') {
    return 'URL은 저장했습니다. 요약은 생성하지 못했습니다.';
  }
  if (summaryStatus === 'pending') {
    return 'URL을 저장했고 요약을 준비 중입니다.';
  }
  return '공유한 링크를 Subnota 수집함에 저장했습니다.';
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [hasLocalAuthAccess, setHasLocalAuthAccess] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const canEnterApp = Boolean(session) || hasLocalAuthAccess;
  const addMemo = useMemoStore(state => state.addMemo);
  const canEnterAppRef = useRef(canEnterApp);
  const drainPendingUrlsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    canEnterAppRef.current = canEnterApp;
  }, [canEnterApp]);

  useEffect(() => {
    let isMounted = true;

    const restoreAuthState = async () => {
      let restoredSession: Session | null = null;
      let hasStoredAccess = false;

      try {
        const [{ data }, storedAccess] = await Promise.all([
          supabase.auth.getSession(),
          appStorage.getItem(LOCAL_AUTH_ACCESS_KEY),
        ]);
        restoredSession = data.session;
        hasStoredAccess = storedAccess === 'true';
      } catch {
        hasStoredAccess =
          (await appStorage
            .getItem(LOCAL_AUTH_ACCESS_KEY)
            .catch(() => null)) === 'true';
      }

      if (restoredSession) {
        hasStoredAccess = true;
        appStorage.setItem(LOCAL_AUTH_ACCESS_KEY, 'true').catch(() => undefined);
      }

      if (!isMounted) {
        return;
      }

      setSession(restoredSession);
      setHasLocalAuthAccess(hasStoredAccess);
      setIsAuthReady(true);
    };

    restoreAuthState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (canEnterApp) {
      restoreWindowAfterLogin();
    } else {
      resizeWindowForLogin();
    }
  }, [canEnterApp, isAuthReady]);

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
        if (nextSession) {
          setHasLocalAuthAccess(true);
          appStorage
            .setItem(LOCAL_AUTH_ACCESS_KEY, 'true')
            .catch(() => undefined);
        }
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

      if (event === 'SIGNED_OUT') {
        setHasLocalAuthAccess(false);
        appStorage
          .removeItem(LOCAL_AUTH_ACCESS_KEY)
          .catch(() => undefined);
        return;
      }

      if (nextSession) {
        setHasLocalAuthAccess(true);
        appStorage
          .setItem(LOCAL_AUTH_ACCESS_KEY, 'true')
          .catch(() => undefined);
      }

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
    const pendingCaptureKeys = new Set<string>();
    const bufferedUrls: string[] = [];

    const handleUrl = async (url: string | null) => {
      if (!url) {
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        Alert.alert(
          '캡처 실패',
          '수집 요청을 읽지 못했습니다. 브라우저에서 다시 시도해 주세요.',
        );
        return;
      }

      if (parsed.protocol !== 'subnota:') {
        return;
      }

      if (parsed.hostname === 'memo') {
        const text = parsed.searchParams.get('text')?.trim();
        if (text) {
          addMemo(text, 'MiniSubnota');
          syncLocalData({ force: true }).catch(() => undefined);
        }
        return;
      }

      if (parsed.hostname !== 'capture') {
        return;
      }

      const captureUrl = parsed.searchParams.get('url');
      if (!captureUrl) {
        Alert.alert(
          '캡처 실패',
          '저장할 URL을 찾지 못했습니다. 브라우저에서 다시 시도해 주세요.',
        );
        return;
      }

      // Only forward public web links to the backend fetcher. The backend also
      // enforces an SSRF guard, but rejecting non-http(s) schemes here (file:,
      // javascript:, internal addresses) blocks abuse of the custom URL scheme
      // early with a clear message.
      let captureScheme: string;
      try {
        captureScheme = new URL(captureUrl).protocol;
      } catch {
        captureScheme = '';
      }
      if (captureScheme !== 'http:' && captureScheme !== 'https:') {
        Alert.alert(
          '캡처 실패',
          '웹 링크(http/https)만 저장할 수 있습니다.',
        );
        return;
      }

      const captureKey = `${captureUrl}:${parsed.searchParams.get('title') ?? ''}`;
      if (pendingCaptureKeys.has(captureKey)) {
        return;
      }
      pendingCaptureKeys.add(captureKey);

      try {
        const item = await saveInboxSession({
          rawSharedText: parsed.searchParams.get('title'),
          selectedText: parsed.searchParams.get('selectedText'),
          url: captureUrl,
        });
        emitInboxItemSaved(item);
        recordMenuBarInboxSave(item);
        if (Platform.OS !== 'macos') {
          Alert.alert('수집함에 저장됨', getCaptureSuccessMessage(item.summaryStatus));
        }
      } catch {
        Alert.alert(
          '저장 실패',
          'URL을 수집함에 저장하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
        );
      } finally {
        pendingCaptureKeys.delete(captureKey);
      }
    };

    // The status item and global hotkey exist before login, so a capture/memo
    // URL can arrive before the app is ready. Hold it until then instead of
    // dropping it (a logged-out capture still falls back to the local queue).
    const isReady = () =>
      canEnterAppRef.current && useMemoStore.persist.hasHydrated();

    const routeUrl = (url: string | null) => {
      if (!url) {
        return;
      }
      if (isReady()) {
        handleUrl(url).catch(() => undefined);
      } else {
        bufferedUrls.push(url);
      }
    };

    drainPendingUrlsRef.current = () => {
      if (!isReady() || bufferedUrls.length === 0) {
        return;
      }
      const urls = bufferedUrls.splice(0, bufferedUrls.length);
      urls.forEach(url => handleUrl(url).catch(() => undefined));
    };

    Linking.getInitialURL().then(routeUrl).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => {
      routeUrl(event.url);
    });

    return () => {
      subscription.remove();
      pendingCaptureKeys.clear();
      drainPendingUrlsRef.current = null;
    };
  }, [addMemo]);

  useEffect(() => {
    if (!canEnterApp) {
      return;
    }

    const drain = () => drainPendingUrlsRef.current?.();
    if (useMemoStore.persist.hasHydrated()) {
      drain();
      return;
    }
    return useMemoStore.persist.onFinishHydration(drain);
  }, [canEnterApp]);

  useEffect(() => {
    if (!canEnterApp || Platform.OS !== 'ios') {
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

        await saveInboxSession({
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
  }, [canEnterApp]);

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
        {canEnterApp ? <Navigation /> : <AuthScreen />}
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
