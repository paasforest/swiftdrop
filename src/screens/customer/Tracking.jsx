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
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import AvatarPlaceholder from '../../components/AvatarPlaceholder';

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
          <ActivityIndicator size="large" color={colors.primary} />
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
        <View style={styles.mapPlaceholder} />
      </View>

      <View style={styles.bottomSheet}>
        {order.driver_id ? (
          <View style={styles.driverInfo}>
            <AvatarPlaceholder size={60} />
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driverName}</Text>
              {order.driver_rating != null ? (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={16} color={colors.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.driverRating}>{Number(order.driver_rating).toFixed(1)}</Text>
                </View>
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
              <Ionicons name="call-outline" size={24} color={colors.primary} />
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
    backgroundColor: colors.surface,
    width,
    minHeight: height,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    ...shadows.modal,
  },
  noDriver: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  driverRating: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  driverVehicle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusBanner: {
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
    flex: 1,
    textTransform: 'capitalize',
  },
  etaText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  deliveryDetails: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    width: 56,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'right',
    fontWeight: '500',
  },
  deliveryTypeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliveryTypeText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  backLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backLinkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default Tracking;
