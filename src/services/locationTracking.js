import * as Location from 'expo-location';
import { ref, set, onValue } from 'firebase/database';
import { database, auth as firebaseAuth } from './firebaseConfig';
import { patchJson } from '../apiClient';

let locationSubscription = null;
let locationUpdateCallback = null;
let lastLocationBroadcastAt = 0;
let lastBackendSyncAt = 0;
/** Keeps RTDB fresh when the device is stationary (watchPosition may not fire). */
let activeDeliveryHeartbeat = null;

export async function getFreshForegroundPosition({ requestPermission = true } = {}) {
  const permission = requestPermission
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission not granted');
  }

  // Try last known position first — instant, no GPS wait
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 500 });
    if (last) return last;
  } catch { /* ignore */ }

  // Fall back to fresh fix with a hard 15-second timeout so the UI never hangs
  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Location timed out — GPS took too long')), 15000)
    ),
  ]);
}

export async function syncDriverLocationToBackend({
  latitude,
  longitude,
  isOnline = true,
  quiet = true,
}) {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error('Driver not authenticated');
  }
  const token = await currentUser.getIdToken();
  const response = await patchJson(
    '/api/drivers/location',
    { lat: latitude, lng: longitude, is_online: isOnline },
    { token, quiet }
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
  stopDriverLocationTracking();
  locationUpdateCallback = onLocationUpdate;
  lastLocationBroadcastAt = 0;
  lastBackendSyncAt = 0;
  const orderIdStr = String(orderId);
  try {
    const initialLocation = await getFreshForegroundPosition({ requestPermission: true });
    const initialLatitude = initialLocation.coords.latitude;
    const initialLongitude = initialLocation.coords.longitude;

    if (locationUpdateCallback) {
      locationUpdateCallback({ latitude: initialLatitude, longitude: initialLongitude, timestamp: Date.now() });
    }

    const locationRef = ref(database, `active_deliveries/${orderIdStr}/driver_location`);
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

    const pushToRtdb = (latitude, longitude, heading, speed, now) => {
      const locationRef = ref(database, `active_deliveries/${orderIdStr}/driver_location`);
      return set(locationRef, {
        latitude,
        longitude,
        heading: heading ?? 0,
        speed: speed ?? 0,
        timestamp: now,
        driverId,
      });
    };

    // Tighter intervals so the sender map feels live; heartbeat covers standstill GPS.
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      (location) => {
        const { latitude, longitude, heading, speed } = location.coords;
        const now = Date.now();
        if (now - lastLocationBroadcastAt < 2500) {
          return;
        }
        lastLocationBroadcastAt = now;

        if (locationUpdateCallback) {
          locationUpdateCallback({ latitude, longitude, timestamp: now });
        }

        pushToRtdb(latitude, longitude, heading, speed, now).catch((error) => {
          console.error('[Location] Firebase update failed:', error);
        });

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

    activeDeliveryHeartbeat = setInterval(async () => {
      if (!locationSubscription) return;
      try {
        const last = await Location.getLastKnownPositionAsync({
          maxAge: 120000,
          requiredAccuracy: 250,
        });
        if (!last) return;
        const { latitude, longitude, heading, speed } = last.coords;
        const now = Date.now();
        await pushToRtdb(latitude, longitude, heading, speed, now);
        if (locationUpdateCallback) {
          locationUpdateCallback({ latitude, longitude, timestamp: now });
        }
        if (now - lastBackendSyncAt >= 15000) {
          syncDriverLocationToBackend({
            latitude,
            longitude,
            isOnline: true,
            quiet: true,
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('[Location] Heartbeat:', e?.message || e);
      }
    }, 4000);

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
  if (activeDeliveryHeartbeat) {
    clearInterval(activeDeliveryHeartbeat);
    activeDeliveryHeartbeat = null;
  }
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
    if (!location) return;
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      callback({
        ...location,
        latitude,
        longitude,
        timestamp: location.timestamp != null ? Number(location.timestamp) : undefined,
      });
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
