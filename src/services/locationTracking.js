import * as Location from 'expo-location';
import { ref, set, onValue, off } from 'firebase/database';
import { database } from './firebaseConfig';

let locationSubscription = null;
let locationUpdateCallback = null;

/**
 * Start tracking driver location and update Firebase in real-time
 * @param {string} driverId - The driver's user ID
 * @param {string} orderId - The active order ID
 * @param {function} onLocationUpdate - Optional callback for location updates
 */
export async function startDriverLocationTracking(driverId, orderId, onLocationUpdate = null) {
  locationUpdateCallback = onLocationUpdate;
  try {
    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    // Stop any existing tracking
    stopDriverLocationTracking();

    // Start watching position with high accuracy
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Or when moved 10 meters
      },
      (location) => {
        const { latitude, longitude, heading, speed } = location.coords;
        
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
          timestamp: Date.now(),
          driverId,
        }).catch((error) => {
          console.error('[Location] Firebase update failed:', error);
        });

        console.log('[Location] Driver position updated:', { latitude, longitude });
      }
    );

    console.log('[Location] Tracking started for driver:', driverId);
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
    console.log('[Location] Tracking stopped');
  }
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
