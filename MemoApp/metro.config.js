const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    platforms: Array.from(
      new Set([...(defaultConfig.resolver?.platforms ?? []), 'macos']),
    ),
    resolveRequest(context, moduleName, platform) {
      if (
        platform === 'macos' &&
        (moduleName === 'react' || moduleName.startsWith('react/'))
      ) {
        const macosReactModule =
          moduleName === 'react'
            ? 'react-macos'
            : `react-macos/${moduleName.slice('react/'.length)}`;
        return context.resolveRequest(context, macosReactModule, platform);
      }

      if (
        platform === 'macos' &&
        (moduleName === 'react-native' ||
          moduleName.startsWith('react-native/'))
      ) {
        const macosNativeModule =
          moduleName === 'react-native'
            ? 'react-native-macos'
            : `react-native-macos/${moduleName.slice('react-native/'.length)}`;
        return context.resolveRequest(context, macosNativeModule, platform);
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
