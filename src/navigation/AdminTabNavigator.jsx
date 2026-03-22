import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdminOverview from '../screens/admin/AdminOverview';
import Deliveries from '../screens/admin/Deliveries';
import DriverReview from '../screens/admin/DriverReview';
import DisputeResolution from '../screens/admin/DisputeResolution';
import AdminFinance from '../screens/admin/AdminFinance';
import { colors } from '../theme/theme';

const Tab = createBottomTabNavigator();

export default function AdminTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          minHeight: 56 + Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Overview"
        component={AdminOverview}
        options={{
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Deliveries"
        component={Deliveries}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Drivers"
        component={DriverReview}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Disputes"
        component={DisputeResolution}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Finance"
        component={AdminFinance}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
