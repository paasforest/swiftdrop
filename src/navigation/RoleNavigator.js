import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../authStore';

// Onboarding
import RoleSelectScreen from '../screens/onboarding/RoleSelectScreen';
import SenderProfileScreen from '../screens/onboarding/SenderProfileScreen';
import DriverProfileScreen from '../screens/onboarding/DriverProfileScreen';

// ── Sender flow ────────────────────────────────────────────────────────────
import SenderHomeScreen         from '../screens/sender/SenderHomeScreen';
import NewBookingScreen         from '../screens/sender/NewBookingScreen';
import BookingDeclarationScreen from '../screens/sender/BookingDeclarationScreen';
import PaymentScreen            from '../screens/sender/PaymentScreen';
import FindingDriverScreen      from '../screens/sender/FindingDriverScreen';
import TrackDriverScreen        from '../screens/sender/TrackDriverScreen';
import SenderPickupOTPScreen    from '../screens/sender/PickupOTPScreen';
import SenderDropoffOTPScreen   from '../screens/sender/DropoffOTPScreen';
import DeliveryCompleteScreen   from '../screens/sender/DeliveryCompleteScreen';

// ── Driver flow ────────────────────────────────────────────────────────────
import DriverDashboardScreen    from '../screens/driver/DriverDashboardScreen';
import NavigatePickupScreen     from '../screens/driver/NavigatePickupScreen';
import DriverPickupOTPScreen    from '../screens/driver/PickupOTPScreen';
import NavigateDropoffScreen    from '../screens/driver/NavigateDropoffScreen';
import DriverDropoffOTPScreen   from '../screens/driver/DropoffOTPScreen';
import PhotoUploadScreen        from '../screens/driver/PhotoUploadScreen';
import DriverJobCompleteScreen  from '../screens/driver/DriverJobCompleteScreen';

const Stack = createStackNavigator();

export default function RoleNavigator() {
  const { role, profileComplete } = useAuthStore();

  let initialRouteName = 'RoleSelect';
  if (role === 'sender' && !profileComplete) initialRouteName = 'SenderProfile';
  if (role === 'driver' && !profileComplete) initialRouteName = 'DriverProfile';
  if (role === 'sender' && profileComplete)  initialRouteName = 'SenderHome';
  if (role === 'driver' && profileComplete)  initialRouteName = 'DriverHome';

  return (
    <Stack.Navigator
      key={`${role || 'none'}-${profileComplete ? 'done' : 'pending'}`}
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      {/* ── Onboarding ─────────────────────── */}
      <Stack.Screen name="RoleSelect"    component={RoleSelectScreen} />
      <Stack.Screen name="SenderProfile" component={SenderProfileScreen} />
      <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />

      {/* ── Sender ─────────────────────────── */}
      <Stack.Screen name="SenderHome"       component={SenderHomeScreen} />
      <Stack.Screen name="NewBooking"         component={NewBookingScreen} />
      <Stack.Screen name="BookingDeclaration" component={BookingDeclarationScreen} />
      <Stack.Screen name="Payment"            component={PaymentScreen} />
      <Stack.Screen name="FindingDriver"    component={FindingDriverScreen} />
      <Stack.Screen name="TrackDriver"      component={TrackDriverScreen} />
      <Stack.Screen name="PickupOTP"        component={SenderPickupOTPScreen} />
      <Stack.Screen name="DropoffOTP"       component={SenderDropoffOTPScreen} />
      <Stack.Screen name="DeliveryComplete" component={DeliveryCompleteScreen} />

      {/* ── Driver ─────────────────────────── */}
      <Stack.Screen name="DriverHome"        component={DriverDashboardScreen} />
      <Stack.Screen name="NavigatePickup"    component={NavigatePickupScreen} />
      <Stack.Screen name="DriverPickupOTP"   component={DriverPickupOTPScreen} />
      <Stack.Screen name="NavigateDropoff"   component={NavigateDropoffScreen} />
      <Stack.Screen name="DriverDropoffOTP"  component={DriverDropoffOTPScreen} />
      <Stack.Screen name="PhotoUpload"       component={PhotoUploadScreen} />
      <Stack.Screen name="DriverJobComplete" component={DriverJobCompleteScreen} />
    </Stack.Navigator>
  );
}
