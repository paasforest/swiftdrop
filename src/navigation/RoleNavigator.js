import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../authStore';
import RoleSelectScreen from '../screens/onboarding/RoleSelectScreen';
import SenderProfileScreen from '../screens/onboarding/SenderProfileScreen';
import DriverProfileScreen from '../screens/onboarding/DriverProfileScreen';
import SenderHomeScreen from '../screens/sender/SenderHomeScreen';
import DriverDashboardScreen from '../screens/driver/DriverDashboardScreen';

const Stack = createStackNavigator();

export default function RoleNavigator() {
  const { role, profileComplete } = useAuthStore();

  let initialRouteName = 'RoleSelect';
  if (role === 'sender' && !profileComplete) initialRouteName = 'SenderProfile';
  if (role === 'driver' && !profileComplete) initialRouteName = 'DriverProfile';
  if (role === 'sender' && profileComplete) initialRouteName = 'SenderHome';
  if (role === 'driver' && profileComplete) initialRouteName = 'DriverHome';

  return (
    <Stack.Navigator
      key={`${role || 'none'}-${profileComplete ? 'done' : 'pending'}`}
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="SenderProfile" component={SenderProfileScreen} />
      <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
      <Stack.Screen name="SenderHome" component={SenderHomeScreen} />
      <Stack.Screen name="DriverHome" component={DriverDashboardScreen} />
    </Stack.Navigator>
  );
}
