import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { ref, onValue } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { subscribeToDriverLocation, calculateETA } from '../../services/locationTracking';
import { theme } from '../../theme/theme';

function firstInitial(name) {
  return (name || 'D').trim()[0].toUpperCase();
}

export default function TrackDriverScreen({ route, navigation }) {
  const { booking } = route.params;
  const bookingId = booking?.bookingId || booking?.id;

  const [driverLocation, setDriverLocation] = useState(null);
  const [bookingStatus, setBookingStatus] = useState(booking?.status || 'active');
  const [eta, setEta] = useState(null);

  // Pulse animation for driver marker
  const pulseScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseScale]);

  // Subscribe to live driver location from Firebase RTDB
  useEffect(() => {
    if (!bookingId) return;
    const unsub = subscribeToDriverLocation(String(bookingId), (loc) => {
      setDriverLocation(loc);
    });
    return unsub;
  }, [bookingId]);

  // Recalculate ETA whenever driver moves
  useEffect(() => {
    if (!driverLocation || !booking?.pickupAddress) return;
    const mins = calculateETA(driverLocation, {
      latitude: booking.pickupLat || -33.9249,
      longitude: booking.pickupLng || 18.4241,
    });
    setEta(mins);
  }, [driverLocation, booking]);

  // Listen to booking status changes
  useEffect(() => {
    if (!bookingId) return;
    const statusRef = ref(database, `bookings/${bookingId}/status`);
    const unsub = onValue(statusRef, (snap) => {
      const status = snap.val();
      if (!status) return;
      setBookingStatus(status);
      if (status === 'otp_pickup') {
        navigation.replace('PickupOTP', { booking });
      }
      if (status === 'otp_dropoff') {
        navigation.replace('DropoffOTP', { booking });
      }
      if (status === 'delivered') {
        navigation.replace('DeliveryComplete', { booking });
      }
    });
    return () => unsub();
  }, [bookingId, booking, navigation]);

  const pickupCoord = booking?.pickupLat
    ? { latitude: booking.pickupLat, longitude: booking.pickupLng }
    : null;

  const driverCoord = driverLocation
    ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
    : null;

  const mapRegion = driverCoord || pickupCoord || {
    latitude: -33.9249,
    longitude: 18.4241,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const statusLabel = bookingStatus === 'in_transit'
    ? 'Driver heading to drop-off'
    : 'Driver arriving at pickup';

  return (
    <View style={styles.container}>
      {/* Map — top half */}
      <MapView
        style={styles.map}
        region={{
          ...(driverCoord || (pickupCoord ?? { latitude: -33.9249, longitude: 18.4241 })),
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Driver marker */}
        {driverCoord && (
          <Marker coordinate={driverCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarkerWrap}>
              <View style={styles.driverMarker}>
                <Text style={styles.driverMarkerText}>D</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Pickup marker */}
        {pickupCoord && (
          <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.pickupMarker}>
              <Text style={styles.pickupMarkerText}>↓</Text>
            </View>
          </Marker>
        )}

        {/* Route polyline */}
        {driverCoord && pickupCoord && (
          <Polyline
            coordinates={[driverCoord, pickupCoord]}
            strokeColor={theme.colors.volt}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        {/* ETA */}
        <View style={styles.etaRow}>
          <View>
            <Text style={styles.etaValue}>
              {eta != null ? `${eta} min` : '—'}
            </Text>
            <Text style={styles.etaLabel}>{statusLabel}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Driver info */}
        <View style={styles.driverRow}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>
              {firstInitial(booking?.driverName)}
            </Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{booking?.driverName || 'Your driver'}</Text>
            <Text style={styles.driverVehicle}>
              {booking?.vehicleType || 'Vehicle'}{booking?.vehicleReg ? ` · ${booking.vehicleReg}` : ''}
            </Text>
          </View>
          {booking?.rating && (
            <View style={styles.ratingChip}>
              <Text style={styles.ratingText}>★ {Number(booking.rating).toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.obsidian,
  },
  map: {
    flex: 1,
  },

  // Markers
  driverMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.obsidian,
    borderWidth: 3,
    borderColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.volt,
  },
  pickupMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMarkerText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.obsidian,
  },

  // Bottom sheet
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  etaValue: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -1,
    marginBottom: 3,
  },
  etaLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    backgroundColor: theme.colors.obsidian,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: theme.colors.volt,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 20,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  driverVehicle: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  ratingChip: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
});
