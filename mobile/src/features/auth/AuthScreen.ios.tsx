import React from 'react';
import AuthScreenShared, { AuthPlatformConfig } from './AuthScreen.shared';

const iosConfig: AuthPlatformConfig = {
  keyboardAvoidingBehavior: 'padding',
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

const AuthScreen = () => <AuthScreenShared platformConfig={iosConfig} />;

export default AuthScreen;
