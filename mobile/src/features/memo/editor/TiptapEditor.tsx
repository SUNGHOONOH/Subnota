import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useMemoStore } from '../../../store/useMemoStore';
import {
  EditorFocusedDate,
  MemoEditorProps,
} from '../components/MemoEditor.types';

// Load the Tiptap editor HTML from local asset
const TIPTAP_HTML = require('./tiptap-editor.html');

interface TiptapMessage {
  type:
    | 'update'
    | 'selection'
    | 'focus'
    | 'blur'
    | 'ready'
    | 'ambient_idle'
    | 'active'
    | 'focusedDate';
  markdown?: string;
  selectedText?: string;
  from?: number;
  to?: number;
  chunk?: string;
  active?: Record<string, boolean>;
  linkHref?: string | null;
  focusedDate?: EditorFocusedDate | null;
}

const SELECTION_TOOLBAR_HEIGHT = 32;

const TiptapEditor = ({
  highlightedPieces,
  hideToolbar,
  inputAccessoryViewID,
  onChangeText,
  onEditorFocus,
  onFocusedDateChange,
  onLayout,
  onScheduleSelection,
  onSelectedTextChange,
  onSelectionChange,
  onAmbientIdle,
  selectedText: externalSelectedText,
  text,
}: MemoEditorProps) => {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [internalSelectedText, setInternalSelectedText] = useState('');
  const lastInjectedTextRef = useRef<string>('');
  const pendingContentRef = useRef<string | null>(null);
  const setMarkdownEditorState = useMemoStore(
    state => state.setMarkdownEditorState,
  );
  const setActiveMarkdownEditor = useMemoStore(
    state => state.setActiveMarkdownEditor,
  );

  // Imperatively run a toolbar command against this editor's WebView.
  const applyCommand = useCallback(
    (command: string, args?: Record<string, unknown>) => {
      webViewRef.current?.injectJavaScript(
        `window.editorApplyCommand(${JSON.stringify(command)}, ${JSON.stringify(
          args ?? null,
        )}); void(0);`,
      );
    },
    [],
  );
  // The registration object we hand to the store on focus; kept in a ref so the
  // unmount cleanup can clear it only if this editor is still the active one.
  const markdownRegistrationRef = useRef<{
    applyCommand: typeof applyCommand;
  } | null>(null);

  // Release the shared toolbar when this editor unmounts (pane/tab closed) so a
  // stale command never targets a destroyed WebView.
  useEffect(() => {
    return () => {
      if (
        useMemoStore.getState().activeMarkdownEditor ===
        markdownRegistrationRef.current
      ) {
        setActiveMarkdownEditor(null);
      }
    };
  }, [setActiveMarkdownEditor]);

  // Derive selected text from either external prop or internal WebView state
  const selectedText = externalSelectedText || internalSelectedText;

  // ── Safely inject markdown across the WebView bridge ──
  // JSON.stringify produces a fully-escaped JS string literal, handling every
  // edge case (quotes, backslashes, newlines, U+2028/U+2029) that manual
  // escaping misses.
  const injectContent = useCallback((markdown: string) => {
    lastInjectedTextRef.current = markdown;
    webViewRef.current?.injectJavaScript(
      `window.editorSetContent(${JSON.stringify(markdown)}); void(0);`,
    );
  }, []);

  // ── Sync on WebView load (do NOT rely solely on the custom 'ready' message) ──
  // macOS can reuse a WKWebView/process across mounts, in which case the custom
  // `ready` postMessage may not re-fire — leaving the editor showing the old
  // pane/tab's content and tripping the fallback overlay. onLoadEnd always
  // fires on load, so we mark ready and FORCE-inject the current content (even
  // empty) to clear any reused DOM.
  const syncEditor = useCallback(() => {
    setReady(true);
    setLoadFailed(false);
    const content = pendingContentRef.current ?? text;
    pendingContentRef.current = null;
    lastInjectedTextRef.current = content;
    webViewRef.current?.injectJavaScript(
      `${
        hideToolbar
          ? 'if(window.editorSetToolbarVisible)window.editorSetToolbarVisible(false);'
          : ''
      }if(window.editorSetContent)window.editorSetContent(${JSON.stringify(
        content,
      )}); void(0);`,
    );
  }, [hideToolbar, text]);

  // ── Inject content into WebView when text prop changes ──
  useEffect(() => {
    if (!ready) {
      pendingContentRef.current = text;
      return;
    }

    // Avoid re-injecting content that originated from the editor itself
    if (text === lastInjectedTextRef.current) {
      return;
    }

    injectContent(text);
  }, [text, ready, injectContent]);

  // ── Handle messages from WebView ──
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message: TiptapMessage = JSON.parse(event.nativeEvent.data);

        switch (message.type) {
          case 'ready':
            // The editor's own ready signal — sync the same way as onLoadEnd.
            syncEditor();
            break;

          case 'update':
            if (message.markdown !== undefined) {
              lastInjectedTextRef.current = message.markdown;
              onChangeText(message.markdown);
            }
            break;

          case 'selection':
            setInternalSelectedText(message.selectedText || '');
            onSelectedTextChange?.(message.selectedText || '');
            if (onSelectionChange && message.from !== undefined && message.to !== undefined) {
              onSelectionChange(message.from, message.to);
            }
            break;

          case 'focus': {
            const registration = { applyCommand };
            markdownRegistrationRef.current = registration;
            setActiveMarkdownEditor(registration);
            onEditorFocus?.();
            break;
          }

          case 'blur':
            // Editor lost focus
            break;

          case 'ambient_idle':
            if (message.chunk && onAmbientIdle) {
              onAmbientIdle(message.chunk);
            }
            break;

          case 'active':
            setMarkdownEditorState({
              active: message.active ?? {},
              linkHref: message.linkHref ?? null,
            });
            break;

          case 'focusedDate':
            onFocusedDateChange?.(message.focusedDate ?? null);
            break;
        }
      } catch (e) {
        // Ignore malformed messages
      }
    },
    [
      applyCommand,
      onChangeText,
      onEditorFocus,
      onFocusedDateChange,
      onSelectedTextChange,
      onSelectionChange,
      onAmbientIdle,
      syncEditor,
      setActiveMarkdownEditor,
      setMarkdownEditorState,
    ],
  );

  // ── Surface a fallback if the editor never signals ready ──
  // The editor bundle is local, so this should only fire on a genuine load
  // failure (corrupt asset, WebView crash) rather than a slow network.
  useEffect(() => {
    if (ready) {
      return;
    }
    // macOS can mount several WebViews at once, each loading a ~1MB inlined
    // bundle; give them generous room before declaring a genuine failure.
    const timer = setTimeout(() => setLoadFailed(true), 25000);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <WebView
        ref={webViewRef}
        source={TIPTAP_HTML}
        onMessage={handleMessage}
        onLoadEnd={syncEditor}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled
        bounces
        showsVerticalScrollIndicator={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={Platform.OS === 'ios'}
        // Load the local editor asset, but deny the file-origin page any
        // further file/cross-origin access — fonts and scripts are inlined,
        // so nothing else needs to be read from disk.
        allowFileAccess
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        style={styles.webview}
        // Transparent background to match the app's canvas
        // @ts-ignore — RNW on macOS supports this
        backgroundColor="transparent"
      />

      {loadFailed ? (
        <View pointerEvents="none" style={styles.loadFailedOverlay}>
          <Text style={styles.loadFailedText}>
            에디터 로딩이 지연되고 있습니다. 계속 입력할 수 있습니다.
          </Text>
        </View>
      ) : null}

      {/* Selection-based floating toolbar */}
      {selectedText ? (
        <View
          pointerEvents="box-none"
          style={styles.selectionFloatingToolbar}
        >
          <Pressable
            onPress={onScheduleSelection}
            hitSlop={8}
            style={({pressed}) => [
              styles.selectionFloatingButton,
              pressed && styles.selectionFloatingButtonPressed,
            ]}
            focusable={false}
            // @ts-ignore
            enableFocusRing={false}
          >
            <Text style={styles.selectionFloatingText}>일정 등록</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FCFAF7',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  selectionFloatingToolbar: {
    bottom: 24,
    position: 'absolute',
    right: 24,
    zIndex: 40,
  },
  selectionFloatingButton: {
    alignItems: 'center',
    backgroundColor: '#8B7355',
    borderRadius: 8,
    height: SELECTION_TOOLBAR_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 14,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  // Tactile scale-on-press feedback (0.96 — anything lower feels exaggerated).
  selectionFloatingButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  selectionFloatingText: {
    color: '#FAF6F0',
    fontSize: 12,
    fontWeight: '700',
  },
  loadFailedOverlay: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(252, 250, 247, 0.92)',
    borderColor: 'rgba(20, 20, 19, 0.08)',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 16,
    justifyContent: 'center',
    left: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 20,
  },
  loadFailedText: {
    color: '#6c6a64',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default TiptapEditor;
