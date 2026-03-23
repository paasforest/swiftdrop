import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';

import { navigationRef, navigateFromNotificationData } from './src/navigationRef';
import { alertForegroundNotification } from './src/services/pushNotificationService';

// Shared
import WelcomeScreen from './src/screens/shared/WelcomeScreen';
import LoadingScreen from './src/screens/shared/LoadingScreen';

// Customer Screens
import Onboarding from './src/screens/customer/Onboarding';
import Login from './src/screens/customer/Login';
import Home from './src/screens/customer/Home';
import AddressEntry from './src/screens/customer/AddressEntry';
import ParcelDescription from './src/screens/customer/ParcelDescription';
import DeliveryTiers from './src/screens/customer/DeliveryTiers';
import Payment from './src/screens/customer/Payment';
import DriverMatching from './src/screens/customer/DriverMatching';
import TrackingWithMap from './src/screens/customer/TrackingWithMap';
import OTPScreen from './src/screens/customer/OTPScreen';
import DeliveryConfirmed from './src/screens/customer/DeliveryConfirmed';
import OrderDetail from './src/screens/customer/OrderDetail';
import OrderHistory from './src/screens/customer/OrderHistory';
import Profile from './src/screens/customer/Profile';

// Driver Screens
import DriverLogin from './src/screens/driver/DriverLogin';
import DriverRegister from './src/screens/driver/DriverRegister';
import DriverHome from './src/screens/driver/DriverHome';
import PostRoute from './src/screens/driver/PostRoute';
import JobOffer from './src/screens/driver/JobOffer';
import ActiveDelivery from './src/screens/driver/ActiveDelivery';
import EnRoutePickup from './src/screens/driver/EnRoutePickup';
import PickupConfirm from './src/screens/driver/PickupConfirm';
import EnRouteDelivery from './src/screens/driver/EnRouteDelivery';
import DeliveryConfirm from './src/screens/driver/DeliveryConfirm';
import Earnings from './src/screens/driver/Earnings';
import DriverOTPScreen from './src/screens/driver/DriverOTPScreen';

// Admin (single tab shell)
import AdminTabNavigator from './src/navigation/AdminTabNavigator';

const Stack = createStackNavigator();

export default function App() {
  const notificationResponseSub = useRef(null);
  const notificationReceivedSub = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('swiftdrop_deliveries', {
        name: 'SwiftDrop Deliveries',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      }).catch((e) => console.warn('[push] channel', e?.message || e));
    }
  }, []);

  useEffect(() => {
    notificationReceivedSub.current = Notifications.addNotificationReceivedListener((notification) => {
      const raw = notification.request.content.data || {};
      const type = raw.type != null ? String(raw.type) : '';
      if (type === 'job_offer' || type === 'return_load') {
        navigateFromNotificationData(raw);
      } else {
        alertForegroundNotification(notification);
      }
    });
    return () => {
      notificationReceivedSub.current?.remove();
    };
  }, []);

  useEffect(() => {
    notificationResponseSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      navigateFromNotificationData(data);
    });
    return () => {
      notificationResponseSub.current?.remove();
    };
  }, []);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response?.notification) {
          const data = response.notification.request.content.data || {};
          navigateFromNotificationData(data);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName="Loading"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Loading" component={LoadingScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        {/* Customer Flow */}
        <Stack.Screen name="Onboarding" component={Onboarding} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="AddressEntry" component={AddressEntry} />
        <Stack.Screen name="ParcelDescription" component={ParcelDescription} />
        <Stack.Screen name="DeliveryTiers" component={DeliveryTiers} />
        <Stack.Screen name="Payment" component={Payment} />
        <Stack.Screen name="DriverMatching" component={DriverMatching} />
        <Stack.Screen name="Tracking" component={TrackingWithMap} />
        <Stack.Screen name="OTPScreen" component={OTPScreen} />
        <Stack.Screen name="DeliveryConfirmed" component={DeliveryConfirmed} />
        <Stack.Screen name="OrderDetail" component={OrderDetail} />
        <Stack.Screen name="OrderHistory" component={OrderHistory} />
        <Stack.Screen name="Profile" component={Profile} />

        {/* Driver Flow */}
        <Stack.Screen name="DriverLogin" component={DriverLogin} />
        <Stack.Screen name="DriverRegister" component={DriverRegister} />
        <Stack.Screen name="DriverOTPScreen" component={DriverOTPScreen} />
        <Stack.Screen name="DriverHome" component={DriverHome} />
        <Stack.Screen name="PostRoute" component={PostRoute} />
        <Stack.Screen
          name="JobOffer"
          component={JobOffer}
          options={{
            ...Platform.select({
              ios: TransitionPresets.ModalSlideFromBottomIOS,
              android: TransitionPresets.BottomSheetAndroid,
              default: TransitionPresets.ModalSlideFromBottomIOS,
            }),
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="ActiveDelivery"
          component={ActiveDelivery}
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="EnRoutePickup" component={EnRoutePickup} />
        <Stack.Screen name="PickupConfirm" component={PickupConfirm} />
        <Stack.Screen name="EnRouteDelivery" component={EnRouteDelivery} />
        <Stack.Screen name="DeliveryConfirm" component={DeliveryConfirm} />
        <Stack.Screen name="Earnings" component={Earnings} />

        {/* Admin: bottom tabs (Overview, Deliveries, Drivers, Disputes, Finance) */}
        <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
