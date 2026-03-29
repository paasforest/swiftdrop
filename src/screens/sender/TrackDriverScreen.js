import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { ref, onValue } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { subscribeToDriverLocation, calculateETA } from '../../services/locationTracking';
import { theme } from '../../theme/theme';

function firstInitial(name) {
  return (name || 'D').trim()[0].toUpperCase();
}

function coordPickup(booking) {
  const lat = Number(booking?.pickupLat ?? booking?.pickup_lat);
  const lng = Number(booking?.pickupLng ?? booking?.pickup_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }
  return null;
}

function coordDropoff(booking) {
  const lat = Number(booking?.dropoffLat ?? booking?.dropoff_lat);
  const lng = Number(booking?.dropoffLng ?? booking?.dropoff_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }
  return null;
}

function headingToDropoff(status) {
  return status === 'in_transit' || status === 'delivering' || status === 'otp_dropoff';
}

function formatUpdatedAt(timestampMs, nowTick) {
  if (timestampMs == null || !Number.isFinite(timestampMs)) {
    return 'Waiting for driver GPS…';
  }
  const s = Math.floor((nowTick - timestampMs) / 1000);
  if (s < 0) return 'Updated just now';
  if (s < 8) return 'Updated just now';
  if (s < 60) return `Updated ${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `Updated ${m}m ago`;
  return 'Updated a while ago';
}

export default function TrackDriverScreen({ route, navigation }) {
  const { booking } = route.params;
  const bookingId = booking?.bookingId || booking?.id;

  const [driverLocation, setDriverLocation] = useState(null);
  const [bookingStatus, setBookingStatus] = useState(booking?.status || 'active');
  const [eta, setEta] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const mapRef = useRef(null);
  const pulseScale = useRef(new Animated.Value(1)).current;

  const pickupCoord = useMemo(() => coordPickup(booking), [booking]);
  const dropoffCoord = useMemo(() => coordDropoff(booking), [booking]);

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

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    const unsub = subscribeToDriverLocation(String(bookingId), (loc) => {
      setDriverLocation(loc);
    });
    return unsub;
  }, [bookingId]);

  const driverCoord = driverLocation
    ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
    : null;

  const routeTarget = headingToDropoff(bookingStatus) ? dropoffCoord || pickupCoord : pickupCoord;

  useEffect(() => {
    if (!driverCoord || !routeTarget) return;
    const mins = calculateETA(driverCoord, routeTarget);
    setEta(mins);
  }, [driverCoord, routeTarget, bookingStatus]);

  useEffect(() => {
    if (!driverCoord || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: driverCoord.latitude,
        longitude: driverCoord.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      450
    );
  }, [driverCoord?.latitude, driverCoord?.longitude]);

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

  const handleShareTrack = async () => {
    if (!booking?.trackUrl) return;
    try {
      await Share.share({
        message: `Track this SwiftDrop delivery (no app needed): ${booking.trackUrl}`,
        title: 'SwiftDrop tracking',
      });
    } catch {
      /* user dismissed */
    }
  };

  const initialRegion = useMemo(() => {
    const center = pickupCoord || { latitude: -33.9249, longitude: 18.4241 };
    return {
      ...center,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }, [pickupCoord]);

  const polylineCoords =
    driverCoord && routeTarget ? [driverCoord, routeTarget] : null;

  const statusLabel = headingToDropoff(bookingStatus)
    ? 'Driver heading to drop-off'
    : 'Driver arriving at pickup';

  const updatedLabel = formatUpdatedAt(driverLocation?.timestamp, nowTick);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {driverCoord && (
          <Marker coordinate={driverCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <Animated.View style={[styles.driverMarkerWrap, { transform: [{ scale: pulseScale }] }]}>
              <View style={styles.driverMarker}>
                <Text style={styles.driverMarkerText}>D</Text>
              </View>
            </Animated.View>
          </Marker>
        )}

        {pickupCoord && (
          <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.pickupMarker}>
              <Text style={styles.pickupMarkerText}>P</Text>
            </View>
          </Marker>
        )}

        {dropoffCoord && (
          <Marker coordinate={dropoffCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.dropoffMarker}>
              <Text style={styles.dropoffMarkerText}>↓</Text>
            </View>
          </Marker>
        )}

        {polylineCoords && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={theme.colors.volt}
            strokeWidth={3}
          />
        )}
      </MapView>

      <View style={styles.sheet}>
        <View style={styles.etaRow}>
          <View style={styles.etaBlock}>
            <Text style={styles.etaValue}>
              {eta != null ? `${eta} min` : driverCoord ? '—' : '…'}
            </Text>
            <Text style={styles.etaLabel}>{statusLabel}</Text>
            <Text style={styles.updatedHint}>{updatedLabel}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {booking?.trackUrl ? (
          <TouchableOpacity style={styles.shareLink} onPress={handleShareTrack} activeOpacity={0.85}>
            <Text style={styles.shareLinkText}>Share live tracking link</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.driverRow}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>
              {firstInitial(booking?.driverName)}
            </Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{booking?.driverName || 'Your driver'}</Text>
            <Text style={styles.driverVehicle}>
              {booking?.vehicleType || 'Vehicle'}
              {booking?.vehicleReg ? ` · ${booking.vehicleReg}` : ''}
            </Text>
          </View>
          {booking?.rating ? (
            <View style={styles.ratingChip}>
              <Text style={styles.ratingText}>★ {Number(booking.rating).toFixed(1)}</Text>
            </View>
          ) : null}
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
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.obsidian,
  },
  dropoffMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.signalGreen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.obsidian,
  },
  dropoffMarkerText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.obsidian,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  etaBlock: {
    flex: 1,
    paddingRight: 12,
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
  updatedHint: {
    marginTop: 6,
    fontSize: 11,
    color: theme.colors.textFaint,
    fontWeight: '500',
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
  shareLink: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(10,10,15,0.06)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  shareLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.obsidian,
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
