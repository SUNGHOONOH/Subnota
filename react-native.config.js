module.exports = {
  // macOS 빌드에서 호환되지 않는 라이브러리를 제외
  dependencies: {
    'react-native-screens': {
      platforms: {
        macos: null,
      },
    },
    'react-native-reanimated': {
      platforms: {
        macos: null, // New Architecture 필수이므로 macOS에서 제외
      },
    },
    'react-native-worklets': {
      platforms: {
        macos: null, // reanimated 의존성이므로 함께 제외
      },
    },
  },
};
