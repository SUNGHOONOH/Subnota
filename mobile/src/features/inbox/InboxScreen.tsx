import React from 'react';
import { Platform } from 'react-native';
import InboxScreenShared, { InboxPlatformConfig } from './InboxScreen.shared';

const config: InboxPlatformConfig = {
  isMac: Platform.OS === 'macos',
};

const InboxScreen = () => <InboxScreenShared platformConfig={config} />;

export default InboxScreen;
