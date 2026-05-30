import { NativeModules, Platform } from 'react-native';

import type { InboxSession } from '../backend/inboxService';

const sourceLabels: Record<InboxSession['sourceType'], string> = {
  image: '이미지',
  instagram: 'Instagram',
  url: '웹페이지',
  youtube: 'YouTube',
};

type SubnotaMenuBarModule = {
  recordInboxSave?: (item: {
    sourceLabel: string;
    title: string;
    url: string;
  }) => void;
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
    title: item.title ?? item.description ?? item.originalUrl ?? '새 수집 항목',
    url: item.canonicalUrl ?? item.originalUrl ?? '',
  });
};
