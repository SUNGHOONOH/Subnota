import React from 'react';
import { Platform } from 'react-native';
import CalendarScreenShared, { CalendarPlatformConfig } from './CalendarScreen.shared';

const config: CalendarPlatformConfig = {
  isMac: Platform.OS === 'macos',
  keyboardAvoidingBehavior: Platform.OS === 'ios' ? 'padding' : undefined,
};

const CalendarScreen = () => <CalendarScreenShared platformConfig={config} />;

export default CalendarScreen;
