/* eslint-env jest */

import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

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
