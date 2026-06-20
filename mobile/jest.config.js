module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    // Metro assets (the inlined editor html, images, fonts) can't be
    // transformed by jest — stub them so component trees can import.
    '\\.(html|png|jpe?g|gif|svg|ttf|otf|woff2?)$': '<rootDir>/__mocks__/assetMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(jest-)?react-native|@react-native\\+.*|@react-native-community\\+.*|@jsr\\+.*|react-native-.*|@react-navigation\\+.*|lucide-react-native|react-native-svg)@',
    'node_modules/(?!(\\.pnpm|(jest-)?react-native|@react-native|@react-native-community|@jsr|react-native-.*|@react-navigation|lucide-react-native|react-native-svg)/)',
  ],
};
