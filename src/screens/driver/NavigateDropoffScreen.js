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

export default function NavigateDropoffScreen({ route, navigation }) {
  const { job } = route.params;
  const bookingId = job?.bookingId || job?.id;

  const [driverCoord, setDriverCoord] = useState(null);
  const [eta, setEta] = useState(null);
  const [arriving, setArriving] = useState(false);
  const mapRef = useRef(null);

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
        if (job?.dropoffLat) {
          setEta(calculateETA(coord, { latitude: job.dropoffLat, longitude: job.dropoffLng }));
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
      await postJson(`/api/bookings/${bookingId}/arrived-dropoff`, {}, { token });
      navigation.replace('DriverDropoffOTP', { booking: job });
    } catch {
      Alert.alert('Error', 'Could not confirm arrival. Try again.');
    } finally {
      setArriving(false);
    }
  };

  const dropoffCoord = job?.dropoffLat
    ? { latitude: Number(job.dropoffLat), longitude: Number(job.dropoffLng) }
    : null;

  const region = driverCoord
    ? { ...driverCoord, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : dropoffCoord
      ? { ...dropoffCoord, latitudeDelta: 0.04, longitudeDelta: 0.04 }
      : { latitude: -33.9249, longitude: 18.4241, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NAVIGATE TO DROP-OFF</Text>
          </View>
        </View>
      </SafeAreaView>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {driverCoord && (
          <Marker coordinate={driverCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>D</Text>
            </View>
          </Marker>
        )}
        {dropoffCoord && (
          <Marker coordinate={dropoffCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.dropoffMarker}>
              <Text style={styles.dropoffMarkerIcon}>↓</Text>
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.panel}>
        <Text style={styles.panelLabel}>HEADING TO DROP-OFF</Text>
        <Text style={styles.panelAddress} numberOfLines={2}>
          {job?.dropoffAddress || '—'}
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
            : <Text style={styles.ctaText}>I've arrived at drop-off</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.obsidian },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(10,10,15,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 18, color: '#fff' },
  badge: {
    backgroundColor: theme.colors.signalGreen,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
  },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: '#fff' },

  map: { flex: 1 },

  driverMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.obsidian,
    borderWidth: 3, borderColor: theme.colors.signalGreen,
    alignItems: 'center', justifyContent: 'center',
  },
  driverMarkerText: { fontSize: 14, fontWeight: '700', color: theme.colors.signalGreen },
  dropoffMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.signalGreen,
    alignItems: 'center', justifyContent: 'center',
  },
  dropoffMarkerIcon: { fontSize: 16, fontWeight: '700', color: '#fff' },

  panel: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  panelLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: theme.colors.textMuted, marginBottom: 8,
  },
  panelAddress: {
    fontSize: 18, fontWeight: '700', color: theme.colors.text,
    letterSpacing: -0.3, marginBottom: 16, lineHeight: 24,
  },
  etaChip: {
    alignSelf: 'flex-start', backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 20,
  },
  etaValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  cta: { ...theme.components.ctaButton },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { ...theme.components.ctaButtonText },
});
