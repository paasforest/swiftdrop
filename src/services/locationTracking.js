import * as Location from 'expo-location';
import { ref, set, onValue } from 'firebase/database';
import { database } from './firebaseConfig';
import { patchJson } from '../apiClient';
import { getAuth } from '../authStore';

let locationSubscription = null;
let locationUpdateCallback = null;
let lastLocationBroadcastAt = 0;
let lastBackendSyncAt = 0;

export async function getFreshForegroundPosition({ requestPermission = true } = {}) {
  const permission = requestPermission
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission not granted');
  }
  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
}

export async function syncDriverLocationToBackend({
  latitude,
  longitude,
  isOnline = true,
  quiet = true,
}) {
  const auth = getAuth();
  if (!auth?.token) {
    throw new Error('Driver not authenticated');
  }
  const response = await patchJson(
    '/api/drivers/location',
    { lat: latitude, lng: longitude, is_online: isOnline },
    { token: auth.token, quiet }
  );
  lastBackendSyncAt = Date.now();
  return response;
}

/**
 * Start tracking driver location and update Firebase in real-time
 * @param {string} driverId - The driver's user ID
 * @param {string} orderId - The active order ID
 * @param {function} onLocationUpdate - Optional callback for location updates
 */
export async function startDriverLocationTracking(driverId, orderId, onLocationUpdate = null) {
  locationUpdateCallback = onLocationUpdate;
  lastLocationBroadcastAt = 0;
  lastBackendSyncAt = 0;
  try {
    const initialLocation = await getFreshForegroundPosition({ requestPermission: true });
    const initialLatitude = initialLocation.coords.latitude;
    const initialLongitude = initialLocation.coords.longitude;

    // Stop any existing tracking
    stopDriverLocationTracking();

    if (locationUpdateCallback) {
      locationUpdateCallback({ latitude: initialLatitude, longitude: initialLongitude });
    }

    const locationRef = ref(database, `active_deliveries/${orderId}/driver_location`);
    await set(locationRef, {
      latitude: initialLatitude,
      longitude: initialLongitude,
      heading: initialLocation.coords.heading || 0,
      speed: initialLocation.coords.speed || 0,
      timestamp: Date.now(),
      driverId,
    });

    await syncDriverLocationToBackend({
      latitude: initialLatitude,
      longitude: initialLongitude,
      isOnline: true,
      quiet: true,
    });

    // Keep tracking light enough for smooth in-app driving screens.
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 8000,
        distanceInterval: 25,
      },
      (location) => {
        const { latitude, longitude, heading, speed } = location.coords;
        const now = Date.now();
        if (now - lastLocationBroadcastAt < 7000) {
          return;
        }
        lastLocationBroadcastAt = now;

        // Call the optional callback with coordinates
        if (locationUpdateCallback) {
          locationUpdateCallback({ latitude, longitude });
        }
        
        // Update Firebase with current location
        const locationRef = ref(database, `active_deliveries/${orderId}/driver_location`);
        set(locationRef, {
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          timestamp: now,
          driverId,
        }).catch((error) => {
          console.error('[Location] Firebase update failed:', error);
        });

        // Keep backend location truth reasonably fresh during active trips too.
        if (now - lastBackendSyncAt >= 12000) {
          syncDriverLocationToBackend({
            latitude,
            longitude,
            isOnline: true,
            quiet: true,
          }).catch((error) => {
            console.error('[Location] Backend location sync failed:', error?.message || error);
          });
        }
      }
    );

    return true;
  } catch (error) {
    console.error('[Location] Failed to start tracking:', error);
    throw error;
  }
}

/**
 * Stop tracking driver location
 */
export function stopDriverLocationTracking() {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  lastLocationBroadcastAt = 0;
  lastBackendSyncAt = 0;
  locationUpdateCallback = null;
}

/**
 * Subscribe to driver location updates for customers
 * @param {string} orderId - The order ID to track
 * @param {function} callback - Called when location updates
 */
export function subscribeToDriverLocation(orderId, callback) {
  const locationRef = ref(database, `active_deliveries/${orderId}/driver_location`);

  // onValue returns an unsubscribe function. Use it to avoid stale listeners.
  const unsubscribe = onValue(locationRef, (snapshot) => {
    const location = snapshot.val();
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      callback(location);
    }
  });

  return () => unsubscribe();
}

/**
 * Update delivery status in Firebase
 * @param {string} orderId - The order ID
 * @param {string} status - New status
 */
export function updateDeliveryStatus(orderId, status) {
  const statusRef = ref(database, `active_deliveries/${orderId}/status`);
  return set(statusRef, {
    status,
    timestamp: Date.now(),
  });
}

/**
 * Get estimated time of arrival
 * @param {object} driverLocation - Driver's current location
 * @param {object} destination - Destination coordinates
 * @returns {number} ETA in minutes
 */
export function calculateETA(driverLocation, destination) {
  if (!driverLocation || !destination) return null;

  // Simple distance calculation (Haversine formula)
  const R = 6371; // Earth's radius in km
  const dLat = toRad(destination.latitude - driverLocation.latitude);
  const dLon = toRad(destination.longitude - driverLocation.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(driverLocation.latitude)) * 
    Math.cos(toRad(destination.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km

  // Assume average speed of 40 km/h in city
  const avgSpeed = 40;
  const eta = (distance / avgSpeed) * 60; // Convert to minutes

  return Math.round(eta);
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
