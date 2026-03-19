import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';

const { width, height } = Dimensions.get('window');

function humanStatus(status) {
  if (!status) return '';
  return String(status).replace(/_/g, ' ');
}

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

const Tracking = ({ navigation, route }) => {
  const orderId = route?.params?.orderId;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!orderId) {
        setOrder(null);
        setLoading(false);
        return;
      }
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
        if (!cancelled) {
          setError(e.message || 'Failed to load order');
          setOrder(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const handleCall = () => {
    const phone = order?.driver_phone;
    if (phone) Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
  };

  if (!orderId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Track a delivery</Text>
          <Text style={styles.emptySub}>
            Open a delivery from your home screen, or create a new one to see live status here.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color="#1A73E8" />
          <Text style={styles.emptySub}>Loading order…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Could not load order</Text>
          <Text style={styles.emptySub}>{error || 'Unknown error'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const driverName = order.driver_name || 'Driver';
  const vehicleBits = [order.vehicle_make, order.vehicle_model].filter(Boolean).join(' ');
  const plate = order.vehicle_plate || '';
  const parcelBits = [order.parcel_type, order.parcel_size].filter(Boolean).join(' — ');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapHint}>Map view — connect a map SDK for live tracking</Text>
          <View style={styles.routeLine} />
          <View style={styles.pickupMarker}>
            <View style={styles.pickupDot} />
          </View>
          <View style={styles.destinationMarker}>
            <View style={styles.destinationDot} />
          </View>
        </View>
      </View>

      <View style={styles.bottomSheet}>
        {order.driver_id ? (
          <View style={styles.driverInfo}>
            <View style={styles.driverPhoto}>
              <Text style={styles.driverAvatar}>🚗</Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driverName}</Text>
              {order.driver_rating != null ? (
                <Text style={styles.driverRating}>⭐ {Number(order.driver_rating).toFixed(1)}</Text>
              ) : null}
              <Text style={styles.driverVehicle} numberOfLines={2}>
                {[vehicleBits, plate].filter(Boolean).join(' • ') || 'Vehicle details pending'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noDriver}>Matching a driver…</Text>
        )}

        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{humanStatus(order.status)}</Text>
          <Text style={styles.etaText}>#{order.order_number}</Text>
        </View>

        {order.driver_phone ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
              <Text style={styles.actionIcon}>📞</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.deliveryDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>From:</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {order.pickup_address}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>To:</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {order.dropoff_address}
            </Text>
          </View>
          {parcelBits ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Parcel:</Text>
              <Text style={styles.detailValue}>{parcelBits}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tier:</Text>
            <View style={styles.deliveryTypeBadge}>
              <Text style={styles.deliveryTypeText}>{order.delivery_tier || '—'}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total:</Text>
            <Text style={styles.detailValue}>{formatMoney(order.total_price)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>← Back to home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width,
    height,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: '#1A73E8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#E8F4F8',
  },
  mapPlaceholder: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapHint: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  routeLine: {
    width: 3,
    height: 120,
    backgroundColor: '#1A73E8',
    opacity: 0.5,
  },
  pickupMarker: {
    position: 'absolute',
    left: '25%',
    bottom: '35%',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  pickupDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
  },
  destinationMarker: {
    position: 'absolute',
    right: '25%',
    top: '30%',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  destinationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF6B35',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  noDriver: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 12,
    textAlign: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  driverAvatar: {
    fontSize: 24,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  driverRating: {
    fontSize: 14,
    color: '#FFA500',
    marginBottom: 2,
  },
  driverVehicle: {
    fontSize: 14,
    color: '#666666',
  },
  statusBanner: {
    backgroundColor: '#E8F4FF',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A73E8',
    flex: 1,
    textTransform: 'capitalize',
  },
  etaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A73E8',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionIcon: {
    fontSize: 24,
  },
  deliveryDetails: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    width: 56,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    textAlign: 'right',
    fontWeight: '500',
  },
  deliveryTypeBadge: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliveryTypeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  backLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backLinkText: {
    color: '#1A73E8',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default Tracking;
