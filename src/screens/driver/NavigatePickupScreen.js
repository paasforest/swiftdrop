import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../services/firebaseConfig';
import { postJson } from '../../apiClient';
import {
  getFreshForegroundPosition,
  calculateETA,
} from '../../services/locationTracking';
import { theme } from '../../theme/theme';

export default function NavigatePickupScreen({ route, navigation }) {
  const { job } = route.params;
  const bookingId = job?.bookingId || job?.id;

  const [driverCoord, setDriverCoord] = useState(null);
  const [eta, setEta] = useState(null);
  const [arriving, setArriving] = useState(false);
  const mapRef = useRef(null);

  // Get driver position on mount and keep refreshing
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const pos = await getFreshForegroundPosition({ requestPermission: false });
        if (cancelled) return;
        const coord = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setDriverCoord(coord);
        if (job?.pickupLat) {
          setEta(calculateETA(coord, { latitude: job.pickupLat, longitude: job.pickupLng }));
        }
      } catch { /* ignore */ }
    };
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [job]);

  const handleArrived = async () => {
    setArriving(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      await postJson(`/api/bookings/${bookingId}/arrived-pickup`, {}, { token });
      navigation.replace('DriverPickupOTP', { booking: job });
    } catch {
      Alert.alert('Error', 'Could not confirm arrival. Try again.');
    } finally {
      setArriving(false);
    }
  };

  const pickupCoord = job?.pickupLat
    ? { latitude: Number(job.pickupLat), longitude: Number(job.pickupLng) }
    : null;

  const region = driverCoord
    ? { ...driverCoord, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : pickupCoord
      ? { ...pickupCoord, latitudeDelta: 0.04, longitudeDelta: 0.04 }
      : { latitude: -33.9249, longitude: 18.4241, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={styles.container}>
      {/* Header overlay */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NAVIGATE TO PICKUP</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Driver position */}
        {driverCoord && (
          <Marker coordinate={driverCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>D</Text>
            </View>
          </Marker>
        )}
        {/* Pickup destination */}
        {pickupCoord && (
          <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.pickupMarker}>
              <Text style={styles.pickupMarkerIcon}>↓</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Bottom panel */}
      <View style={styles.panel}>
        <Text style={styles.panelLabel}>HEADING TO PICKUP</Text>
        <Text style={styles.panelAddress} numberOfLines={2}>
          {job?.pickupAddress || '—'}
        </Text>

        {eta != null && (
          <View style={styles.etaChip}>
            <Text style={styles.etaValue}>{eta} min away</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.cta, arriving && styles.ctaDisabled]}
          onPress={handleArrived}
          disabled={arriving}
          activeOpacity={0.85}
        >
          {arriving
            ? <ActivityIndicator color={theme.colors.textLight} />
            : <Text style={styles.ctaText}>I've arrived at pickup</Text>
          }
        </TouchableOpacity>

        {/* DEV-only shortcut — invisible in production */}
        {__DEV__ && (
          <TouchableOpacity style={styles.devBtn} onPress={handleArrived}>
            <Text style={styles.devBtnText}>⚡ DEV: Simulate arrival</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.obsidian },

  headerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,10,15,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 18, color: '#fff' },
  badge: {
    backgroundColor: theme.colors.volt,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.colors.obsidian,
  },

  map: { flex: 1 },

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
  driverMarkerText: { fontSize: 14, fontWeight: '700', color: theme.colors.volt },
  pickupMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMarkerIcon: { fontSize: 16, fontWeight: '700', color: theme.colors.obsidian },

  panel: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  panelLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  panelAddress: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.3,
    marginBottom: 16,
    lineHeight: 24,
  },
  etaChip: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  etaValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text },

  cta: { ...theme.components.ctaButton },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { ...theme.components.ctaButtonText },
  devBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  devBtnText: { fontSize: 12, color: theme.colors.volt, fontWeight: '600' },
});
