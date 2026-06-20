/* eslint-env jest */

import 'react-native-gesture-handler/jestSetup';

// react-native-webview pulls a native TurboModule (RNCWebViewModule) at import
// time, which isn't available under jest. Stub it with a plain View so any
// component tree that renders the editor can load.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }),
  );
  return { __esModule: true, WebView, default: WebView };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};

  return {
    getItem: jest.fn(key => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key, value) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store = {};
      return Promise.resolve();
    }),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const {View} = require('react-native');

  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: component => component,
    },
    createAnimatedComponent: component => component,
    useAnimatedStyle: updater => updater(),
    useSharedValue: value => ({value}),
    withTiming: value => value,
    withSpring: value => value,
    runOnJS: fn => fn,
    runOnUI: fn => fn,
    Easing: {
      linear: value => value,
      ease: value => value,
      in: fn => fn,
      out: fn => fn,
      inOut: fn => fn,
    },
    FadeIn: {},
    FadeOut: {},
    Layout: {},
    useAnimatedRef: () => React.createRef(),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaInsetsContext: require('react').createContext({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }),
  SafeAreaFrameContext: require('react').createContext({
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  }),
  SafeAreaProvider: ({children}) => children,
  SafeAreaView: ({children}) => children,
  initialWindowMetrics: {
    frame: {x: 0, y: 0, width: 390, height: 844},
    insets: {top: 0, right: 0, bottom: 0, left: 0},
  },
  useSafeAreaFrame: () => ({x: 0, y: 0, width: 390, height: 844}),
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));
