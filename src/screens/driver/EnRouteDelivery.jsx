import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DriverLocationService from './DriverLocationService';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { colors, spacing, radius, typography, shadows } from '../../theme/theme';

const { width, height } = Dimensions.get('window');
const UBER_MAP_STYLE = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f1eb' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fdfcf8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f8c967' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e9bc62' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c9d2d3' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dde9cb' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
];

const EnRouteDelivery = ({ route, navigation }) => {
  const orderId = route?.params?.orderId;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(null);
  const [driverCoords, setDriverCoords] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!orderId) return;
      const auth = getAuth();
      if (!auth?.token) {
        setError('Not signed in');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        if (!cancelled) setOrder(data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const handleBack = () => {
    console.log('Back pressed');
  };

  const statusText =
    order?.status === 'delivery_arrived'
      ? 'Arrived at destination'
      : order?.status === 'delivery_en_route'
        ? 'Delivering parcel'
        : order?.status
          ? String(order.status).replace(/_/g, ' ')
          : 'Delivering parcel';

  const canConfirmDelivery =
    order?.status === 'delivery_en_route' || order?.status === 'delivery_arrived';

  const deliveryCoords =
    order?.dropoff_lat != null && order?.dropoff_lng != null
      ? {
          latitude: Number(order.dropoff_lat),
          longitude: Number(order.dropoff_lng),
        }
      : null;

  const initialRegion = driverCoords
    ? {
        latitude: driverCoords.latitude,
        longitude: driverCoords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : deliveryCoords
      ? {
          latitude: deliveryCoords.latitude,
          longitude: deliveryCoords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      : {
          latitude: -33.9249,
          longitude: 18.4241,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

  return (
    <SafeAreaView style={styles.container}>
      {orderId ? <DriverLocationService orderId={orderId} onLocationUpdate={setDriverCoords} /> : null}
      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          customMapStyle={UBER_MAP_STYLE}
        >
          {driverCoords ? (
            <Marker coordinate={driverCoords} title="You" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.driverMarkerWrap}>
                <View style={styles.driverMarkerRing} />
                <View style={styles.driverMarker}>
                  <Ionicons name="car-sport" size={14} color={colors.textWhite} />
                </View>
              </View>
            </Marker>
          ) : null}

          {deliveryCoords ? (
            <Marker coordinate={deliveryCoords} title="Delivery" description={order?.dropoff_address || ''}>
              <View style={styles.deliveryMarkerWrap}>
                <View style={styles.deliveryMarkerRing} />
                <View style={styles.deliveryMarker}>
                  <View style={styles.deliveryDot} />
                </View>
              </View>
            </Marker>
          ) : null}

          {driverCoords && deliveryCoords ? (
            <Polyline
              coordinates={[driverCoords, deliveryCoords]}
              strokeColor="#000000"
              strokeWidth={4}
              lineCap="round"
            />
          ) : null}
        </MapView>

        {/* Top Overlay Bar */}
        <View style={styles.topOverlay}>
          <TouchableOpacity onPress={handleBack}>
            <Ionicons name="chevron-back" size={28} color={colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Delivery</Text>
          <View style={{ width: 70 }} />
        </View>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Status Badge */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        {/* Delivery Address */}
        <View style={styles.addressSection}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.addressText}>
            {loading ? 'Loading…' : error ? '—' : order?.dropoff_address || '—'}
          </Text>
        </View>

        {canConfirmDelivery && (
          <TouchableOpacity
            style={styles.arrivedButton}
            onPress={() => navigation.navigate('DeliveryConfirm', { orderId })}
          >
            <Text style={styles.arrivedButtonText}>I have arrived at delivery</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.textWhite,
    width: width,
    height: height,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#F5F3EF',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  driverMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(17, 17, 17, 0.12)',
  },
  driverMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: colors.textWhite,
  },
  deliveryMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryMarkerRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  deliveryMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.textWhite,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  deliveryDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  topOverlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 18,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  backArrow: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: 'bold',
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cancelText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  bottomPanel: {
    backgroundColor: colors.textWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  statusBadge: {
    backgroundColor: '#F4F4F5',
    padding: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3F3F46',
  },
  receiverSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  receiverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  receiverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
  },
  receiverDetails: {
    flex: 1,
  },
  receiverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  receiverPhone: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  contactIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  contactText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  addressSection: {
    marginBottom: 24,
  },
  addressText: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  etaContainer: {
    backgroundColor: colors.primaryLight,
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  etaText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  parcelSection: {
    marginBottom: 24,
  },
  parcelInfo: {
    backgroundColor: colors.warningLight,
    padding: 12,
    borderRadius: 8,
  },
  parcelText: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: '500',
  },
  arrivedButton: {
    backgroundColor: '#111111',
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
  },
  arrivedButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default EnRouteDelivery;
