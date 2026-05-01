import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { getAuth } from '../../authStore';
import { postJson } from '../../apiClient';

export default function PriceConfirm({ navigation, route }) {
  const params = route?.params || {};
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPrice = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setError('Please sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await postJson(
        '/api/orders/price-estimate',
        {
          pickup_lat: params.pickup_lat,
          pickup_lng: params.pickup_lng,
          dropoff_lat: params.dropoff_lat,
          dropoff_lng: params.dropoff_lng,
          parcel_size: params.parcel_size,
          parcel_value: Number(params.parcel_value) || 0,
          trip_type: 'local',
        },
        { token: auth.token }
      );
      setPriceData(data);
    } catch (err) {
      setError(err.message || 'Could not calculate price');
      setPriceData(null);
    } finally {
      setLoading(false);
    }
  }, [
    params.pickup_lat,
    params.pickup_lng,
    params.dropoff_lat,
    params.dropoff_lng,
    params.parcel_size,
    params.parcel_value,
  ]);

  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.dotGreen} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>PICKUP</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>
                {params.pickup_address}
              </Text>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={styles.dotBlack} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DROPOFF</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>
                {params.dropoff_address}
              </Text>
            </View>
          </View>
          {priceData?.distance_km != null ? (
            <Text style={styles.distanceChip}>📍 {priceData.distance_km}km route</Text>
          ) : null}
        </View>

        <View style={styles.parcelRow}>
          <View style={styles.parcelChip}>
            <Text style={styles.parcelChipText}>📦 {params.parcel_size} parcel</Text>
          </View>
          {params.parcel_type ? (
            <View style={styles.parcelChip}>
              <Text style={styles.parcelChipText}>{params.parcel_type}</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#000" size="large" />
            <Text style={styles.loadingText}>Calculating price...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchPrice}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : priceData ? (
          <View style={styles.priceCard}>
            <Text style={styles.priceCardLabel}>PRICE BREAKDOWN</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery fee</Text>
              <Text style={styles.priceValue}>R{priceData.base_price}</Text>
            </View>

            {Number(priceData.insurance_fee) > 0 ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Parcel protection</Text>
                <Text style={styles.priceValue}>R{priceData.insurance_fee}</Text>
              </View>
            ) : null}

            <View style={styles.priceDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>R{priceData.total_price}</Text>
            </View>

            <Text style={styles.priceNote}>Same day delivery · Insured · OTP verified</Text>
          </View>
        ) : null}
      </ScrollView>

      {priceData ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() =>
              navigation.navigate('Payment', {
                ...params,
                delivery_tier: 'standard',
                delivery_total: priceData.total_price,
                delivery_base_price: priceData.base_price,
                delivery_insurance_fee: priceData.insurance_fee,
                trip_type: 'local',
              })
            }
          >
            <Text style={styles.confirmText}>Confirm — R{priceData.total_price}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

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
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00C853',
    marginRight: 12,
    marginTop: 2,
  },
  dotBlack: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#000000',
    marginRight: 12,
    marginTop: 2,
  },
  routeConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginLeft: 5,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    lineHeight: 20,
  },
  distanceChip: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 12,
    textAlign: 'center',
  },
  parcelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  parcelChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  parcelChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  loadingBox: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 12,
  },
  errorBox: {
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 8,
  },
  retryText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  priceCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  priceCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#757575',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
  },
  priceNote: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  confirmButton: {
    backgroundColor: '#00C853',
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});
