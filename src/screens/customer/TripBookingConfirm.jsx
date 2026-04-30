import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { postJson } from '../../apiClient';

const SIZES = [
  { id: 'small', label: 'Small', sub: 'Backpack' },
  { id: 'medium', label: 'Medium', sub: 'Shoebox' },
  { id: 'large', label: 'Large', sub: 'Suitcase' },
];

function parseParcelValue(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  const n = Number(t.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

export default function TripBookingConfirm({ navigation, route }) {
  const trip = route.params?.trip;
  const [parcelSize, setParcelSize] = useState('small');
  const [parcelType, setParcelType] = useState('');
  const [parcelValue, setParcelValue] = useState('');
  const [valueError, setValueError] = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState(null);

  const fetchPrice = useCallback(async () => {
    if (!trip?.from_lat || !trip?.from_lng || !trip?.to_lat || !trip?.to_lng) return;
    const pv = parseParcelValue(parcelValue);
    if (parcelValue.trim() && Number.isNaN(pv)) {
      setValueError('Enter a valid declared value (ZAR)');
      setPriceData(null);
      return;
    }
    setValueError(null);
    setLoadingPrice(true);
    setPriceError(null);
    try {
      const data = await postJson('/api/orders/price-estimate', {
        pickup_lat: Number(trip.from_lat),
        pickup_lng: Number(trip.from_lng),
        dropoff_lat: Number(trip.to_lat),
        dropoff_lng: Number(trip.to_lng),
        parcel_value: pv == null ? null : pv,
        trip_type: 'intercity',
        parcel_size: parcelSize,
      });
      setPriceData(data);
    } catch (e) {
      setPriceError(e.message || 'Could not calculate price');
      setPriceData(null);
    } finally {
      setLoadingPrice(false);
    }
  }, [trip, parcelSize, parcelValue]);

  useEffect(() => {
    if (!trip) return;
    fetchPrice();
  }, [trip, fetchPrice]);

  const handlePay = () => {
    if (!trip || !priceData?.total_price) return;
    const pv = parseParcelValue(parcelValue);
    if (parcelValue.trim() && (pv == null || Number.isNaN(pv))) {
      setValueError('Enter a valid declared value or leave blank for minimum cover');
      return;
    }
    navigation.navigate('Payment', {
      pickup_address: trip.from_address,
      pickup_lat: trip.from_lat,
      pickup_lng: trip.from_lng,
      dropoff_address: trip.to_address,
      dropoff_lat: trip.to_lat,
      dropoff_lng: trip.to_lng,
      driver_route_id: trip.id,
      trip_type: 'intercity',
      pickup_method: trip.pickup_method,
      meeting_point_address: trip.meeting_point_address,
      meeting_point_lat: trip.meeting_point_lat,
      meeting_point_lng: trip.meeting_point_lng,
      parcel_type: parcelType.trim() || 'General',
      parcel_size: parcelSize,
      parcel_value: pv == null ? null : pv,
      special_handling: JSON.stringify({}),
      delivery_tier: 'standard',
      insurance_selected: true,
      delivery_total: priceData.total_price,
      delivery_base_price: priceData.base_price,
      delivery_insurance_fee: priceData.insurance_fee ?? 0,
    });
  };

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.err}>Missing trip. Go back and pick a trip.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const dep = trip.departure_time ? new Date(trip.departure_time) : null;
  const depStr = dep && !Number.isNaN(dep.getTime())
    ? dep.toLocaleString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm booking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Driver</Text>
        <View style={styles.card}>
          <Text style={styles.driverName}>{trip.driver_name || 'Driver'}</Text>
          <Text style={styles.meta}>Rating {Number(trip.driver_rating || 0).toFixed(1)} ★</Text>
        </View>

        <Text style={styles.sectionLabel}>Trip</Text>
        <View style={styles.card}>
          <Text style={styles.route}>{trip.from_address}</Text>
          <Text style={styles.arrow}>↓</Text>
          <Text style={styles.route}>{trip.to_address}</Text>
          <Text style={styles.meta}>Departs {depStr}</Text>
          <Text style={styles.meta}>
            {trip.pickup_method === 'driver_collects' ? 'Driver collects from you' : 'You drop off to driver'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Parcel</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Size</Text>
          <View style={styles.sizeRow}>
            {SIZES.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.sizeChip, parcelSize === s.id && styles.sizeChipOn]}
                onPress={() => setParcelSize(s.id)}
              >
                <Text style={[styles.sizeChipTitle, parcelSize === s.id && styles.sizeChipTitleOn]}>{s.label}</Text>
                <Text style={[styles.sizeChipSub, parcelSize === s.id && styles.sizeChipSubOn]}>{s.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Type (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Documents, gifts"
            placeholderTextColor="#9E9E9E"
            value={parcelType}
            onChangeText={setParcelType}
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Declared value (ZAR)</Text>
          <TextInput
            style={styles.input}
            placeholder="Leave blank if under R200"
            placeholderTextColor="#9E9E9E"
            keyboardType="decimal-pad"
            value={parcelValue}
            onChangeText={setParcelValue}
          />
          {valueError ? <Text style={styles.inlineErr}>{valueError}</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>Price</Text>
        <View style={styles.card}>
          {loadingPrice ? (
            <ActivityIndicator color="#00C853" />
          ) : priceError ? (
            <Text style={styles.inlineErr}>{priceError}</Text>
          ) : priceData ? (
            <>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Distance</Text>
                <Text style={styles.priceVal}>{priceData.distance_km} km</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery</Text>
                <Text style={styles.priceVal}>R{Number(priceData.base_price || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Insurance add-on</Text>
                <Text style={styles.priceVal}>R{Number(priceData.insurance_fee || 0).toFixed(2)}</Text>
              </View>
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalVal}>R{Number(priceData.total_price || 0).toFixed(2)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.meta}>—</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, (!priceData?.total_price || loadingPrice) && styles.payBtnDisabled]}
          disabled={!priceData?.total_price || loadingPrice}
          onPress={handlePay}
        >
          <Text style={styles.payBtnText}>Continue to payment</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000' },
  scroll: { padding: 16, paddingBottom: 120 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00C853',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  driverName: { fontSize: 17, fontWeight: '700', color: '#000' },
  route: { fontSize: 14, color: '#333', lineHeight: 20 },
  arrow: { textAlign: 'center', color: '#9E9E9E', marginVertical: 4 },
  meta: { fontSize: 13, color: '#757575', marginTop: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 8 },
  sizeRow: { flexDirection: 'row', gap: 8 },
  sizeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  sizeChipOn: { backgroundColor: '#000', borderColor: '#000' },
  sizeChipTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  sizeChipTitleOn: { color: '#FFF' },
  sizeChipSub: { fontSize: 11, color: '#9E9E9E', marginTop: 2 },
  sizeChipSubOn: { color: '#E0E0E0' },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
  },
  inlineErr: { color: '#FF3B30', fontSize: 13, marginTop: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 14, color: '#757575' },
  priceVal: { fontSize: 14, fontWeight: '600', color: '#000' },
  totalRow: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#000' },
  totalVal: { fontSize: 16, fontWeight: '800', color: '#00C853' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  payBtn: { backgroundColor: '#000', borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center' },
  payBtnDisabled: { opacity: 0.45 },
  payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  err: { textAlign: 'center', margin: 24, color: '#757575' },
  btn: { marginHorizontal: 24, padding: 14, backgroundColor: '#000', borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700' },
});
