import React from 'react';
import { Platform } from 'react-native';
import AuthScreenShared, { AuthPlatformConfig } from './AuthScreen.shared';

// Default fallback config for platforms without a dedicated AuthScreen.<platform>.tsx
// (iOS and macOS supply their own). Mirrors the iOS sizing.
const defaultConfig: AuthPlatformConfig = {
  keyboardAvoidingBehavior: Platform.OS === 'ios' ? 'padding' : undefined,
  secureTextEntry: true,
  textContentType: 'password',
  cardGap: 20,
  cardPadding: 24,
  contentGap: 28,
  formGap: 16,
  inputMinHeight: 50,
  googleButtonMinHeight: 46,
  modeTabMinHeight: 36,
  primaryButtonMinHeight: 50,
  scrollContentPaddingVertical: 48,
  socialButtonMinHeight: 46,
};

const AuthScreen = () => <AuthScreenShared platformConfig={defaultConfig} />;

export default AuthScreen;
