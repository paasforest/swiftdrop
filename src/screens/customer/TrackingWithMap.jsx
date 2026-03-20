import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { API_BASE_URL } from '../../apiConfig';
import { subscribeToDriverLocation, calculateETA } from '../../services/locationTracking';

const { width, height } = Dimensions.get('window');

function humanStatus(status) {
  const statusMap = {
    // Backend statuses (see orders.status CHECK constraint)
    'pending': 'Finding driver',
    'matching': 'Matching driver',
    'accepted': 'Driver accepted',
    'pickup_en_route': 'Driver heading to pickup',
    'pickup_arrived': 'Driver arrived for pickup',
    'collected': 'Parcel collected',
    'delivery_en_route': 'On the way to you',
    'delivery_arrived': 'Driver arrived for delivery',
    'delivered': 'Delivered',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'disputed': 'Disputed',
    'unmatched': 'No drivers available',

    // Backward-compat
    'matched': 'Driver assigned',
    'en_route_pickup': 'Driver heading to pickup',
    'picked_up': 'Parcel picked up',
    'en_route_delivery': 'On the way to you',
  };
  return statusMap[status] || status;
}

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

const TrackingWithMap = ({ navigation, route }) => {
  const orderId = route?.params?.orderId;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const mapRef = useRef(null);
  const lastStatusRef = useRef(null);
  const deliveredReachedRef = useRef(false);
  const deliveredNavigatedRef = useRef(false);

  const [unmatchedModalVisible, setUnmatchedModalVisible] = useState(false);
  const [stopPolling, setStopPolling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const pollingErrorRef = useRef(null);

  function computeTimeTakenString(orderData) {
    try {
      const startRaw = orderData?.pickup_confirmed_at || orderData?.created_at;
      const endRaw = orderData?.delivery_confirmed_at || orderData?.updated_at;
      if (!startRaw || !endRaw) return null;
      const start = new Date(startRaw).getTime();
      const end = new Date(endRaw).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
      const mins = Math.max(0, Math.round((end - start) / 60000));
      return `${mins} min`;
    } catch {
      return null;
    }
  }

  // Backend returns `pickup_lat/pickup_lng` and `dropoff_lat/dropoff_lng`,
  // but the map code expects coordinate objects.
  const pickup_coords = useMemo(() => {
    if (order?.pickup_lat == null || order?.pickup_lng == null) return null;
    const lat = Number(order.pickup_lat);
    const lng = Number(order.pickup_lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [order?.pickup_lat, order?.pickup_lng]);

  const delivery_coords = useMemo(() => {
    if (order?.dropoff_lat == null || order?.dropoff_lng == null) return null;
    const lat = Number(order.dropoff_lat);
    const lng = Number(order.dropoff_lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [order?.dropoff_lat, order?.dropoff_lng]);

  // Load order details from backend
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
        if (!cancelled) {
          lastStatusRef.current = data?.status ?? null;
          if (data?.status === 'delivered' || data?.status === 'completed') deliveredReachedRef.current = true;
          setOrder(data);

            // If the order is already unmatched when the user opens tracking, show the modal immediately.
            if (data?.status === 'unmatched') {
              setUnmatchedModalVisible(true);
              setStopPolling(true);
            }

          // If the order is already delivered when the user opens tracking, route them immediately.
          if (data?.status === 'delivered' && !deliveredNavigatedRef.current) {
            deliveredNavigatedRef.current = true;
            setStopPolling(true);
            navigation.navigate('DeliveryConfirmed', {
              orderId: data.id,
              driverName: data.driver_name,
              driverRating: data.driver_rating,
              deliveryPhoto: data.delivery_photo_url,
              fromAddress: data.pickup_address,
              toAddress: data.dropoff_address,
              totalPrice: data.total_price,
              timeTaken: computeTimeTakenString(data),
              basePrice: data.base_price,
              insuranceFee: data.insurance_fee,
              commissionAmount: data.commission_amount,
            });
          }
        }
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

  // Subscribe to real-time driver location from Firebase
  useEffect(() => {
    if (!orderId || stopPolling) return;

    console.log('[Tracking] Subscribing to driver location for order:', orderId);
    
    const unsubscribe = subscribeToDriverLocation(orderId, (location) => {
      console.log('[Tracking] Driver location updated:', location);
      setDriverLocation(location);

      // Calculate ETA if we have delivery coordinates
      if (delivery_coords) {
        const estimatedTime = calculateETA(location, delivery_coords);
        setEta(estimatedTime);
      }

      // Auto-zoom map to show driver
      if (mapRef.current && location) {
        mapRef.current.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      }
    });

    return () => {
      console.log('[Tracking] Unsubscribing from driver location');
      unsubscribe();
    };
  }, [orderId, delivery_coords, stopPolling]);

  // Poll order status every 10 seconds to handle auto-navigation + unmatched flow.
  useEffect(() => {
    if (!orderId) return;
    if (stopPolling) return;
    if (unmatchedModalVisible) return;

    const auth = getAuth();
    if (!auth?.token) return;

    let cancelled = false;

    async function tick() {
      try {
        const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        if (cancelled) return;

        const prevStatus = lastStatusRef.current;
        const nextStatus = data?.status ?? null;

        lastStatusRef.current = nextStatus;
        setOrder(data);

        // Gap 4: Unmatched -> stop polling + show modal overlay
        if (nextStatus === 'unmatched' && prevStatus !== 'unmatched') {
          setUnmatchedModalVisible(true);
          setStopPolling(true);
          return;
        }

        // Gap 1: delivered -> DeliveryConfirmed
        if (nextStatus === 'delivered' && prevStatus !== 'delivered' && !deliveredNavigatedRef.current) {
          deliveredNavigatedRef.current = true;
          setStopPolling(true);
          navigation.navigate('DeliveryConfirmed', {
            orderId: data.id,
            driverName: data.driver_name,
            driverRating: data.driver_rating,
            deliveryPhoto: data.delivery_photo_url,
            fromAddress: data.pickup_address,
            toAddress: data.dropoff_address,
            totalPrice: data.total_price,
            timeTaken: computeTimeTakenString(data),
            basePrice: data.base_price,
            insuranceFee: data.insurance_fee,
            commissionAmount: data.commission_amount,
          });
        }
      } catch (e) {
        // Polling shouldn't hard-crash the whole screen; store error for debugging UI if needed.
        pollingErrorRef.current = e?.message || 'Polling failed';
      }
    }

    // Immediate tick, then every 10s.
    tick();
    const intervalId = setInterval(tick, 10000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [orderId, stopPolling, unmatchedModalVisible, navigation]);

  const handleCall = () => {
    const phone = order?.driver_phone;
    if (phone) Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
  };

  const handleCenterMap = () => {
    if (!mapRef.current) return;

    const coordinates = [];
    
    if (driverLocation) {
      coordinates.push({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
      });
    }
    
    if (pickup_coords) {
      coordinates.push(pickup_coords);
    }
    
    if (delivery_coords) {
      coordinates.push(delivery_coords);
    }

    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  };

  const handleRetryMatching = async () => {
    if (!orderId) return;
    const auth = getAuth();
    if (!auth?.token) {
      navigation.navigate('Login');
      return;
    }

    setRetrying(true);
    try {
      await postJson(`/api/orders/${orderId}/retry-matching`, {}, { token: auth.token });
      setUnmatchedModalVisible(false);
      setStopPolling(false);
      deliveredReachedRef.current = false;
      deliveredNavigatedRef.current = false;
      lastStatusRef.current = 'matching';
    } catch (e) {
      console.error('retry-matching failed:', e.message);
      alert(e.message || 'Could not retry matching');
    } finally {
      setRetrying(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderId) return;
    const auth = getAuth();
    if (!auth?.token) {
      navigation.navigate('Login');
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || 'Cancel failed');

      const refund = json?.refund;
      const refundMessage = refund != null ? `Refund: ${formatMoney(refund)}` : (json?.message || 'Order cancelled');

      navigation.reset({
        index: 0,
        routes: [{ name: 'Home', params: { refundMessage } }],
      });
    } catch (e) {
      console.error('cancel order failed:', e.message);
      alert(e.message || 'Could not cancel the order');
    } finally {
      setCancelling(false);
    }
  };

  if (!orderId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Track a delivery</Text>
          <Text style={styles.emptySub}>
            Open a delivery from your home screen to see live tracking.
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
          <Text style={styles.emptyTitle}>⚠️ {error || 'Order not found'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const initialRegion = driverLocation
    ? {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : pickup_coords
    ? {
        latitude: pickup_coords.latitude,
        longitude: pickup_coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : {
        latitude: -33.9249,
        longitude: 18.4241, // Cape Town default
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onMapReady={handleCenterMap}
      >
        {/* Pickup Marker */}
        {pickup_coords && (
          <Marker
            coordinate={pickup_coords}
            title="Pickup Location"
            description={order.pickup_address}
            pinColor="#FF6B35"
          />
        )}

        {/* Delivery Marker */}
        {delivery_coords && (
          <Marker
            coordinate={delivery_coords}
            title="Delivery Location"
            description={order.dropoff_address}
            pinColor="#1A73E8"
          />
        )}

        {/* Driver Marker (Real-time) */}
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            title={order.driver_name || 'Driver'}
            description="Current location"
            rotation={driverLocation.heading || 0}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>🚗</Text>
            </View>
          </Marker>
        )}

        {/* Route Line */}
        {driverLocation && delivery_coords && (
          <Polyline
            coordinates={[
              {
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              },
              delivery_coords,
            ]}
            strokeColor="#1A73E8"
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      {/* Center Map Button */}
      <TouchableOpacity style={styles.centerButton} onPress={handleCenterMap}>
        <Text style={styles.centerButtonText}>📍</Text>
      </TouchableOpacity>

      {/* Status Card */}
      <View style={styles.statusCard}>
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusTitle}>{humanStatus(order.status)}</Text>
            {eta && (
              <Text style={styles.eta}>
                {eta < 1 ? 'Arriving now' : `${eta} min away`}
              </Text>
            )}
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {order.status === 'delivered' ? '✓' : '●'}
            </Text>
          </View>
        </View>

        {/* Driver Info */}
        {order.driver_name && (
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {order.driver_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{order.driver_name}</Text>
              <View style={styles.driverRating}>
                <Text style={styles.ratingText}>⭐ {order.driver_rating || '4.8'}</Text>
                {order.driver_vehicle && (
                  <Text style={styles.vehicleText}> • {order.driver_vehicle}</Text>
                )}
              </View>
            </View>
            {order.driver_phone && (
              <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                <Text style={styles.callButtonText}>📞</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Order Details */}
        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order ID:</Text>
            <Text style={styles.detailValue}>{order.id}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Delivery Tier:</Text>
            <Text style={styles.detailValue}>{order.tier_name || 'Standard'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total:</Text>
            <Text style={styles.detailValue}>{formatMoney(order.total_price)}</Text>
          </View>
        </View>

        {/* Live Indicator */}
        {driverLocation && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live tracking active</Text>
          </View>
        )}
      </View>

      {unmatchedModalVisible && (
        <View style={styles.unmatchedOverlay}>
          <View style={styles.unmatchedModal}>
            <Text style={styles.unmatchedTitle}>No driver available right now</Text>
            <Text style={styles.unmatchedBody}>
              We searched for 10 minutes but could not find a driver for your route.
            </Text>

            <View style={styles.unmatchedButtonRow}>
              <TouchableOpacity
                style={[styles.unmatchedButton, styles.unmatchedPrimaryButton]}
                onPress={handleRetryMatching}
                disabled={retrying}
              >
                <Text style={styles.unmatchedButtonText}>
                  {retrying ? 'Searching…' : 'Keep Searching'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.unmatchedButton, styles.unmatchedDangerButton]}
                onPress={handleCancelOrder}
                disabled={cancelling}
              >
                <Text style={styles.unmatchedButtonText}>
                  {cancelling ? 'Cancelling…' : 'Cancel Order'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  map: {
    width: width,
    height: height * 0.6,
  },
  centerButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#FFFFFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  centerButtonText: {
    fontSize: 24,
  },
  driverMarker: {
    backgroundColor: '#1A73E8',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  driverMarkerText: {
    fontSize: 20,
  },
  statusCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLeft: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  eta: {
    fontSize: 14,
    color: '#1A73E8',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#E8F5E9',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 20,
    color: '#4CAF50',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#666666',
  },
  vehicleText: {
    fontSize: 14,
    color: '#666666',
  },
  callButton: {
    backgroundColor: '#1A73E8',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButtonText: {
    fontSize: 20,
  },
  orderDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  liveText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  unmatchedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  unmatchedModal: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  unmatchedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  unmatchedBody: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 18,
  },
  unmatchedButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unmatchedButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unmatchedPrimaryButton: {
    backgroundColor: '#1A73E8',
  },
  unmatchedDangerButton: {
    backgroundColor: '#d93025',
  },
  unmatchedButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  backBtn: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TrackingWithMap;
