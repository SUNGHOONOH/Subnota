import { NativeModules, Platform } from 'react-native';

import type { InboxSession } from '../../features/inbox/services/inboxApi';

const sourceLabels: Record<InboxSession['sourceType'], string> = {
  image: '이미지',
  instagram: 'Instagram',
  url: '웹페이지',
  youtube: 'YouTube',
};

type SubnotaMenuBarModule = {
  recordInboxSave?: (item: {
    sourceLabel: string;
    summaryStatus: InboxSession['summaryStatus'];
    title: string;
    url: string;
  }) => void;
  resizeWindowForLogin?: () => void;
  restoreWindowAfterLogin?: () => void;
};

export const recordMenuBarInboxSave = (item: InboxSession) => {
  if (Platform.OS !== 'macos') {
    return;
  }

  const menuBarModule = NativeModules.SubnotaMenuBarModule as
    | SubnotaMenuBarModule
    | undefined;
  menuBarModule?.recordInboxSave?.({
    sourceLabel: sourceLabels[item.sourceType],
    summaryStatus: item.summaryStatus,
    title: item.title ?? item.description ?? item.originalUrl ?? '새 수집 항목',
    url: item.canonicalUrl ?? item.originalUrl ?? '',
  });
};

export const resizeWindowForLogin = () => {
  if (Platform.OS !== 'macos') {
    return;
  }

  const menuBarModule = NativeModules.SubnotaMenuBarModule as
    | SubnotaMenuBarModule
    | undefined;
  menuBarModule?.resizeWindowForLogin?.();
};

export const restoreWindowAfterLogin = () => {
  if (Platform.OS !== 'macos') {
    return;
  }

  const menuBarModule = NativeModules.SubnotaMenuBarModule as
    | SubnotaMenuBarModule
    | undefined;
  menuBarModule?.restoreWindowAfterLogin?.();
};
