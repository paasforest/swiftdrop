import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

// Customer Screens
import Onboarding from './src/screens/customer/Onboarding';
import Login from './src/screens/customer/Login';
import Home from './src/screens/customer/Home';
import AddressEntry from './src/screens/customer/AddressEntry';
import ParcelDescription from './src/screens/customer/ParcelDescription';
import DeliveryTiers from './src/screens/customer/DeliveryTiers';
import Payment from './src/screens/customer/Payment';
import DriverMatching from './src/screens/customer/DriverMatching';
import Tracking from './src/screens/customer/Tracking';
import OTPScreen from './src/screens/customer/OTPScreen';
import DeliveryConfirmed from './src/screens/customer/DeliveryConfirmed';

// Driver Screens
import DriverRegister from './src/screens/driver/DriverRegister';
import DriverHome from './src/screens/driver/DriverHome';
import PostRoute from './src/screens/driver/PostRoute';
import JobOffer from './src/screens/driver/JobOffer';
import EnRoutePickup from './src/screens/driver/EnRoutePickup';
import PickupConfirm from './src/screens/driver/PickupConfirm';
import EnRouteDelivery from './src/screens/driver/EnRouteDelivery';
import DeliveryConfirm from './src/screens/driver/DeliveryConfirm';
import Earnings from './src/screens/driver/Earnings';

// Admin Screens
import AdminOverview from './src/screens/admin/AdminOverview';
import Deliveries from './src/screens/admin/Deliveries';
import DriverReview from './src/screens/admin/DriverReview';
import DisputeResolution from './src/screens/admin/DisputeResolution';
import Reports from './src/screens/admin/Reports';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator 
        initialRouteName="Onboarding"
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Customer Flow */}
        <Stack.Screen name="Onboarding" component={Onboarding} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="AddressEntry" component={AddressEntry} />
        <Stack.Screen name="ParcelDescription" component={ParcelDescription} />
        <Stack.Screen name="DeliveryTiers" component={DeliveryTiers} />
        <Stack.Screen name="Payment" component={Payment} />
        <Stack.Screen name="DriverMatching" component={DriverMatching} />
        <Stack.Screen name="Tracking" component={Tracking} />
        <Stack.Screen name="OTPScreen" component={OTPScreen} />
        <Stack.Screen name="DeliveryConfirmed" component={DeliveryConfirmed} />

        {/* Driver Flow */}
        <Stack.Screen name="DriverRegister" component={DriverRegister} />
        <Stack.Screen name="DriverHome" component={DriverHome} />
        <Stack.Screen name="PostRoute" component={PostRoute} />
        <Stack.Screen name="JobOffer" component={JobOffer} />
        <Stack.Screen name="EnRoutePickup" component={EnRoutePickup} />
        <Stack.Screen name="PickupConfirm" component={PickupConfirm} />
        <Stack.Screen name="EnRouteDelivery" component={EnRouteDelivery} />
        <Stack.Screen name="DeliveryConfirm" component={DeliveryConfirm} />
        <Stack.Screen name="Earnings" component={Earnings} />

        {/* Admin Flow */}
        <Stack.Screen name="AdminOverview" component={AdminOverview} />
        <Stack.Screen name="Deliveries" component={Deliveries} />
        <Stack.Screen name="DriverReview" component={DriverReview} />
        <Stack.Screen name="DisputeResolution" component={DisputeResolution} />
        <Stack.Screen name="Reports" component={Reports} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
