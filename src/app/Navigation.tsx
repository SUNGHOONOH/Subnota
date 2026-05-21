import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { CalendarDays, Coffee, PenLine } from 'lucide-react-native';
import { Keyboard } from 'react-native';

import MemoScreen from '../features/memo/MemoScreen';
import CalendarScreen from '../features/calendar/CalendarScreen';
import BriefingScreen from '../features/briefing/BriefingScreen';

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

const Navigation = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenListeners={{
          tabPress: () => Keyboard.dismiss(),
        }}
        screenOptions={{
          tabBarActiveTintColor: '#8B7355',
          tabBarHideOnKeyboard: false,
          tabBarInactiveTintColor: '#B5A898',
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#FAF6F0',
            borderTopColor: '#E8DFD3',
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
            tabBarLabel: '메모',
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
