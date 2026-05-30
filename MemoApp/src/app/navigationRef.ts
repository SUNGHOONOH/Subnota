import { createNavigationContainerRef } from '@react-navigation/native';

export type RootTabName = 'Memo' | 'Calendar' | 'Inbox' | 'Briefing';

export const navigationRef = createNavigationContainerRef<Record<RootTabName, undefined>>();

let pendingRoute: RootTabName | null = null;

export const navigateToInbox = () => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Inbox');
    return;
  }
  pendingRoute = 'Inbox';
};

export const flushPendingNavigation = () => {
  if (!pendingRoute || !navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate(pendingRoute);
  pendingRoute = null;
};
