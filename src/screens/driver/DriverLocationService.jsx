import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { getAuth } from '../../authStore';
import { colors, radius, spacing } from '../../theme/theme';
import { startDriverLocationTracking, stopDriverLocationTracking, updateDeliveryStatus } from '../../services/locationTracking';

/**
 * Component to manage driver location tracking during active deliveries
 * This should be rendered when driver has an active delivery
 */
const DriverLocationService = ({ orderId, onStop, onLocationUpdate }) => {
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
      await startDriverLocationTracking(auth.user.id, orderId, onLocationUpdate);
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
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.sm + 4,
    borderRadius: radius.sm,
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
    backgroundColor: colors.success,
    marginRight: 8,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  statusTextOff: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 8,
  },
});

export default DriverLocationService;
