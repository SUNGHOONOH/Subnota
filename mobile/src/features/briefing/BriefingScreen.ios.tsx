import React from 'react';
import BriefingScreenShared, { BriefingPlatformConfig } from './BriefingScreen.shared';

const iosConfig: BriefingPlatformConfig = {
  keyboardAvoidingBehavior: 'padding',
  titleFontSize: 26,
  contentMaxWidth: undefined,
  contentAlignSelf: undefined,
  contentWidth: undefined,
  detailPanelMaxWidth: undefined,
};

const BriefingScreen = () => <BriefingScreenShared platformConfig={iosConfig} />;

export default BriefingScreen;
