import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { getAuth } from '../../authStore';
import { startDriverLocationTracking, stopDriverLocationTracking, updateDeliveryStatus } from '../../services/locationTracking';

/**
 * Component to manage driver location tracking during active deliveries
 * This should be rendered when driver has an active delivery
 */
const DriverLocationService = ({ orderId, onStop }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) {
      stopTracking();
      return;
    }

    startTracking();

    return () => {
      stopTracking();
    };
  }, [orderId]);

  const startTracking = async () => {
    try {
      const auth = getAuth();
      if (!auth?.user?.id) {
        throw new Error('Driver not authenticated');
      }

      console.log('[DriverLocation] Starting tracking for order:', orderId);
      await startDriverLocationTracking(auth.user.id, orderId);
      setIsTracking(true);
      setError(null);
    } catch (err) {
      console.error('[DriverLocation] Failed to start tracking:', err);
      setError(err.message);
      setIsTracking(false);
      
      Alert.alert(
        'Location Tracking Error',
        'Unable to start location tracking. Please enable location permissions.',
        [{ text: 'OK' }]
      );
    }
  };

  const stopTracking = () => {
    console.log('[DriverLocation] Stopping tracking');
    stopDriverLocationTracking();
    setIsTracking(false);
    if (onStop) onStop();
  };

  if (!orderId) return null;

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          {isTracking ? (
            <>
              <View style={styles.liveDot} />
              <Text style={styles.statusText}>Live tracking active</Text>
            </>
          ) : (
            <>
              <View style={styles.offlineDot} />
              <Text style={styles.statusTextOff}>Tracking offline</Text>
            </>
          )}
        </View>
        {error && (
          <TouchableOpacity style={styles.retryButton} onPress={startTracking}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={styles.errorText}>⚠️ {error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  statusTextOff: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B35',
    marginTop: 8,
  },
});

export default DriverLocationService;
