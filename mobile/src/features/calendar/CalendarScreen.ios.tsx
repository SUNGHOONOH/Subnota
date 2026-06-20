import React from 'react';
import CalendarScreenShared, { CalendarPlatformConfig } from './CalendarScreen.shared';

const iosConfig: CalendarPlatformConfig = {
  isMac: false,
  keyboardAvoidingBehavior: 'padding',
};

const CalendarScreen = () => <CalendarScreenShared platformConfig={iosConfig} />;

export default CalendarScreen;
