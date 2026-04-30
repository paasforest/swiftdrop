import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import SwiftDropLogoMark from '../../components/SwiftDropLogoMark';
import AvatarPlaceholder from '../../components/AvatarPlaceholder';

function humanStatus(status) {
  if (!status) return '';
  return String(status).replace(/_/g, ' ');
}

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

function statusColor(status) {
  const s = String(status || '');
  if (['cancelled', 'refunded'].includes(s)) return '#FF3B30';
  if (['delivered', 'completed'].includes(s)) return '#000000';
  return '#00C853';
}

const PROGRESS_STEPS = [
  { key: 'placed',    label: 'Order placed' },
  { key: 'en_route',  label: 'Driver en route' },
  { key: 'collected', label: 'Parcel collected' },
  { key: 'delivered', label: 'Delivered' },
];

function stepIndexFromStatus(status) {
  const s = String(status || '');
  if (['delivered', 'completed'].includes(s)) return 3;
  if (['collected', 'delivery_en_route', 'delivery_arrived'].includes(s)) return 2;
  if (['pickup_en_route', 'pickup_arrived'].includes(s)) return 1;
  return 0;
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
    return () => { cancelled = true; };
  }, [orderId]);

  const handleCall = () => {
    const phone = order?.driver_phone;
    if (phone) Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
  };

  if (!orderId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color="#00C853" />
          <Text style={styles.emptySub}>Loading order…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
  const currentStep = stepIndexFromStatus(order.status);
  const sColor = statusColor(order.status);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Map placeholder */}
        <View style={styles.mapContainer}>
          <SwiftDropLogoMark />
        </View>

        {/* Status banner */}
        <View style={styles.statusBanner}>
          <View style={[styles.statusDot, { backgroundColor: sColor }]} />
          <Text style={[styles.statusText, { color: sColor }]}>
            {humanStatus(order.status)}
          </Text>
          <Text style={styles.orderNumber}>#{order.order_number}</Text>
        </View>

        {/* Progress steps */}
        <View style={styles.progressSection}>
          {PROGRESS_STEPS.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isFuture = index > currentStep;
            return (
              <View key={step.key} style={styles.progressStep}>
                <View style={styles.progressLeft}>
                  <View
                    style={[
                      styles.stepDot,
                      isCompleted && styles.stepDotCompleted,
                      isCurrent && styles.stepDotCurrent,
                      isFuture && styles.stepDotFuture,
                    ]}
                  />
                  {index < PROGRESS_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepConnector,
                        isCompleted ? styles.stepConnectorCompleted : styles.stepConnectorFuture,
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    (isCompleted || isCurrent) && styles.stepLabelActive,
                    isFuture && styles.stepLabelFuture,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Driver card */}
        <View style={styles.driverCard}>
          {order.driver_id ? (
            <View style={styles.driverRow}>
              <AvatarPlaceholder size={52} />
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{driverName}</Text>
                {order.driver_rating != null ? (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#FFB800" style={{ marginRight: 4 }} />
                    <Text style={styles.driverRating}>
                      {Number(order.driver_rating).toFixed(1)}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.driverVehicle} numberOfLines={2}>
                  {[vehicleBits, plate].filter(Boolean).join(' • ') || 'Vehicle details pending'}
                </Text>
              </View>
              {order.driver_phone ? (
                <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                  <Ionicons name="call-outline" size={22} color="#000000" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <Text style={styles.noDriver}>Matching a driver…</Text>
          )}
        </View>

        {/* Delivery details */}
        <View style={styles.deliveryDetails}>
          <Text style={styles.sectionLabel}>DELIVERY DETAILS</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>From</Text>
            <Text style={styles.detailValue} numberOfLines={2}>{order.pickup_address}</Text>
          </View>
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>To</Text>
            <Text style={styles.detailValue} numberOfLines={2}>{order.dropoff_address}</Text>
          </View>
          {parcelBits ? (
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>Parcel</Text>
              <Text style={styles.detailValue}>{parcelBits}</Text>
            </View>
          ) : null}
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>Tier</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{order.delivery_tier || '—'}</Text>
            </View>
          </View>
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={[styles.detailValue, { fontWeight: '700' }]}>
              {formatMoney(order.total_price)}
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000000' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 15,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mapContainer: {
    height: 180,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textTransform: 'capitalize',
  },
  orderNumber: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  progressSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressLeft: {
    alignItems: 'center',
    width: 24,
    marginRight: 14,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stepDotCompleted: {
    backgroundColor: '#00C853',
  },
  stepDotCurrent: {
    backgroundColor: '#000000',
  },
  stepDotFuture: {
    backgroundColor: '#E0E0E0',
  },
  stepConnector: {
    width: 2,
    height: 28,
    marginVertical: 2,
  },
  stepConnectorCompleted: {
    backgroundColor: '#00C853',
  },
  stepConnectorFuture: {
    backgroundColor: '#E0E0E0',
  },
  stepLabel: {
    fontSize: 14,
    paddingTop: 0,
    marginBottom: 28,
  },
  stepLabelActive: {
    color: '#000000',
    fontWeight: '600',
  },
  stepLabelFuture: {
    color: '#9E9E9E',
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 16,
    margin: 16,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
    marginLeft: 14,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 3,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  driverRating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  driverVehicle: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDriver: {
    fontSize: 15,
    color: '#9E9E9E',
    textAlign: 'center',
    paddingVertical: 8,
  },
  deliveryDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 16,
    marginHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  detailLabel: {
    fontSize: 14,
    color: '#9E9E9E',
    width: 56,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    textAlign: 'right',
    fontWeight: '500',
  },
  tierBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tierBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});

export default Tracking;
