import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { CalendarDays, Coffee, Inbox, PenLine } from 'lucide-react-native';
import { Keyboard, TextInput, Pressable } from 'react-native';

import MemoScreen from '../features/memo/MemoScreen';
import CalendarScreen from '../features/calendar/CalendarScreen';
import BriefingScreen from '../features/briefing/BriefingScreen';
import InboxScreen from '../features/inbox/InboxScreen';
import { flushPendingNavigation, navigationRef } from './navigationRef';

const Tab = createBottomTabNavigator();

const MemoTabIcon = ({ color, size }: { color: string; size: number }) => (
  <PenLine color={color} size={size} />
);

const CalendarTabIcon = ({ color, size }: { color: string; size: number }) => (
  <CalendarDays color={color} size={size} />
);

const BriefingTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Coffee color={color} size={size} />
);

const InboxTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Inbox color={color} size={size} />
);

const Navigation = () => {

  return (
    <NavigationContainer ref={navigationRef} onReady={flushPendingNavigation}>
      <Tab.Navigator
        screenListeners={{
          tabPress: () => {
            Keyboard.dismiss();
            const focusedInput = TextInput.State.currentlyFocusedInput();
            if (focusedInput) {
              TextInput.State.blurTextInput(focusedInput);
            }
          },
        }}
        screenOptions={{
          tabBarActiveTintColor: '#8B7355',
          tabBarHideOnKeyboard: false,
          tabBarInactiveTintColor: '#B5A898',
          headerShown: false,
          tabBarButton: props => (
            <Pressable
              {...props}
              focusable={false}
              // @ts-ignore
              enableFocusRing={false}
            />
          ),
          tabBarStyle: {
            backgroundColor: '#FAF9F6',
            borderTopColor: '#E6E1DA',
            height: 62,
            paddingBottom: 7,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="Memo"
          component={MemoScreen}
          options={{
            tabBarLabel: '노트',
            tabBarIcon: MemoTabIcon,
          }}
        />
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{
            tabBarLabel: '캘린더',
            tabBarIcon: CalendarTabIcon,
          }}
        />
        <Tab.Screen
          name="Inbox"
          component={InboxScreen}
          options={{
            tabBarLabel: '수집함',
            tabBarIcon: InboxTabIcon,
          }}
        />
        <Tab.Screen
          name="Briefing"
          component={BriefingScreen}
          options={{
            tabBarLabel: '브리핑',
            tabBarIcon: BriefingTabIcon,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
