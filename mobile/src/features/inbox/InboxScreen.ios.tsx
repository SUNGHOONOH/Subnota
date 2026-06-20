import React from 'react';
import InboxScreenShared, { InboxPlatformConfig } from './InboxScreen.shared';

const iosConfig: InboxPlatformConfig = {
  isMac: false,
};

const InboxScreen = () => <InboxScreenShared platformConfig={iosConfig} />;

export default InboxScreen;
