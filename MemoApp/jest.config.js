module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(jest-)?react-native|@react-native\\+.*|@react-native-community\\+.*|react-native-.*|@react-navigation\\+.*|lucide-react-native|react-native-svg)@',
    'node_modules/(?!(\\.pnpm|(jest-)?react-native|@react-native|@react-native-community|react-native-.*|@react-navigation|lucide-react-native|react-native-svg)/)',
  ],
};
