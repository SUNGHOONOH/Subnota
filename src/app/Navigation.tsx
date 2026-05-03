import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { MessageSquare, Calendar, Zap } from 'lucide-react-native';

import MemoListScreen from '../screens/memo/MemoListScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import BriefingScreen from '../screens/briefing/BriefingScreen';

const Tab = createBottomTabNavigator();

const MemoTabIcon = ({ color, size }: { color: string; size: number }) => (
  <MessageSquare color={color} size={size} />
);

const CalendarTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Calendar color={color} size={size} />
);

const BriefingTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Zap color={color} size={size} />
);

const Navigation = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',
          headerShown: false,
          tabBarStyle: {
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
        }}
      >
        <Tab.Screen
          name="Memo"
          component={MemoListScreen}
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
