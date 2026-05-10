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
  Keyboard,
} from 'react-native';
import { postJson } from '../../apiClient';
import { GOOGLE_MAPS_API_KEY } from '../../placesConfig';

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

/** Distance between two WGS84 points in km (great-circle). */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) ** 2
    + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffLat, setDropoffLat] = useState(null);
  const [dropoffLng, setDropoffLng] = useState(null);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [dropoffError, setDropoffError] = useState(null);

  async function fetchDropoffSuggestions(text) {
    if (text.length < 2) {
      setDropoffSuggestions([]);
      return;
    }
    const key = GOOGLE_MAPS_API_KEY;
    if (!key) {
      console.warn('[TripBookingConfirm] GOOGLE_MAPS_API_KEY missing');
      return;
    }
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?`
        + `input=${encodeURIComponent(text)}`
        + `&components=country:za`
        + `&key=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      setDropoffSuggestions(data.predictions || []);
    } catch (err) {
      console.error('Places error:', err);
    }
  }

  async function selectDropoffPlace(place) {
    const key = GOOGLE_MAPS_API_KEY;
    if (!key) return;
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json?`
        + `place_id=${encodeURIComponent(place.place_id)}`
        + `&fields=geometry,formatted_address`
        + `&key=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      const loc = data.result?.geometry?.location;
      const formatted = data.result?.formatted_address || place.description;
      setDropoffAddress(formatted);
      setDropoffLat(loc?.lat ?? null);
      setDropoffLng(loc?.lng ?? null);
      setDropoffSuggestions([]);
      setDropoffError(null);
      Keyboard.dismiss();
    } catch (err) {
      console.error('Place details error:', err);
    }
  }

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
    const dLat = dropoffLat != null ? Number(dropoffLat) : Number(trip.to_lat);
    const dLng = dropoffLng != null ? Number(dropoffLng) : Number(trip.to_lng);
    try {
      const data = await postJson('/api/orders/price-estimate', {
        pickup_lat: Number(trip.from_lat),
        pickup_lng: Number(trip.from_lng),
        dropoff_lat: dLat,
        dropoff_lng: dLng,
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
  }, [trip, parcelSize, parcelValue, dropoffLat, dropoffLng]);

  useEffect(() => {
    if (!trip) return;
    fetchPrice();
  }, [trip, parcelSize, parcelValue, dropoffLat, fetchPrice]);

  const handlePay = () => {
    if (!trip || !priceData?.total_price) return;

    const pv = parseParcelValue(parcelValue);
    if (parcelValue.trim() && (pv == null || Number.isNaN(pv))) {
      setValueError('Enter a valid declared value or leave blank for minimum cover');
      return;
    }

    if (!dropoffAddress.trim()) {
      setDropoffError('Please enter your delivery address');
      return;
    }

    if (dropoffLat == null || dropoffLng == null) {
      setDropoffError('Please select an address from the suggestions list');
      return;
    }

    const destLat = Number(trip.to_lat);
    const destLng = Number(trip.to_lng);

    if (
      Number.isFinite(destLat)
      && Number.isFinite(destLng)
      && Number.isFinite(Number(dropoffLat))
      && Number.isFinite(Number(dropoffLng))
    ) {
      const km = haversineKm(
        Number(dropoffLat),
        Number(dropoffLng),
        destLat,
        destLng
      );
      const radiusKmLocal = Number(trip.delivery_radius_km) || 20;
      if (Number.isFinite(km) && km > radiusKmLocal) {
        setDropoffError(
          `Your address is ${Math.round(km)}km from ${trip.to_city || 'the driver destination'}.`
            + ` Driver delivers within ${radiusKmLocal}km.`
        );
        return;
      }
    }

    setDropoffError(null);

    navigation.navigate('Payment', {
      pickup_address: trip.from_address,
      pickup_lat: trip.from_lat,
      pickup_lng: trip.from_lng,
      dropoff_address: dropoffAddress,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
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
      departure_time: trip.departure_time,
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

  const radiusKm = Number(trip.delivery_radius_km) || 20;
  let dropoffVsDestKm = null;
  if (
    priceData
    && trip?.to_lat != null
    && trip?.to_lng != null
    && dropoffLat != null
    && dropoffLng != null
  ) {
    dropoffVsDestKm = haversineKm(
      Number(dropoffLat),
      Number(dropoffLng),
      Number(trip.to_lat),
      Number(trip.to_lng)
    );
  }

  const radiusConcern =
    priceData
    && trip.delivery_radius_km != null
    && dropoffLat != null
    && dropoffLng != null
    && Number.isFinite(dropoffVsDestKm)
    && dropoffVsDestKm > radiusKm;

  const radiusHint =
    priceData
    && trip.delivery_radius_km != null
    && (dropoffLat == null || dropoffLng == null || !Number.isFinite(dropoffVsDestKm));

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

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Driver</Text>
        <View style={styles.card}>
          <Text style={styles.driverName}>{trip.driver_name || 'Driver'}</Text>
          <Text style={styles.meta}>Rating {Number(trip.driver_rating || 0).toFixed(1)} ★</Text>
        </View>

        <Text style={styles.sectionLabel}>Trip</Text>
        <View style={styles.card}>
          <Text style={styles.cityLabel}>
            {trip.from_city || trip.from_address?.split(',')?.pop()?.trim()}
          </Text>
          <Text style={styles.routeText} numberOfLines={2}>
            {trip.from_address}
          </Text>
          <Text style={styles.arrow}>↓</Text>
          <Text style={styles.cityLabel}>
            {trip.to_city || trip.to_address?.split(',')?.pop()?.trim()}
          </Text>
          <Text style={styles.routeText} numberOfLines={2}>
            {trip.to_address}
          </Text>
          <Text style={styles.meta}>Departs {depStr}</Text>

          {trip.pickup_method === 'sender_drops_off' && trip.meeting_point_address ? (
            <View style={styles.meetingCard}>
              <View style={styles.meetingHeader}>
                <Text style={styles.meetingIcon}>📍</Text>
                <Text style={styles.meetingTitle}>Drop off point</Text>
              </View>
              <Text style={styles.meetingAddress}>{trip.meeting_point_address}</Text>
              <Text style={styles.meetingDeadline}>
                ⏰ Must arrive before{' '}
                {new Date(new Date(trip.departure_time).getTime() - 30 * 60 * 1000).toLocaleTimeString('en-ZA', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                (30 min before departure)
              </Text>
              <Text style={styles.meetingNote}>
                Bring your parcel to this address. The driver will verify with OTP and take a photo before departing.
              </Text>
            </View>
          ) : trip.pickup_method === 'driver_collects' ? (
            <View style={styles.collectCard}>
              <Text style={styles.collectIcon}>🚗</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.collectTitle}>Driver will collect</Text>
                <Text style={styles.collectSub}>Driver comes to your pickup address before departure</Text>
              </View>
            </View>
          ) : null}
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

        <Text style={styles.sectionLabel}>
          EXACT DELIVERY ADDRESS
        </Text>
        <View style={styles.radiusInfo}>
          <Text style={styles.radiusInfoIcon}>📍</Text>
          <Text style={styles.radiusInfoText}>
            Enter full street address with area code. Driver delivers within{' '}
            <Text style={styles.radiusInfoBold}>{trip.delivery_radius_km || 20}km</Text>
            {' '}of{' '}
            <Text style={styles.radiusInfoBold}>{trip.to_city || 'destination'}</Text>
            .
          </Text>
        </View>

        <View style={styles.dropoffInputContainer}>
          <TextInput
            style={[
              styles.dropoffInput,
              dropoffError ? {
                borderColor: '#FF3B30',
                borderWidth: 1.5,
              } : null,
            ]}
            placeholder="e.g. 120 Main Road, Newlands, 2093"
            placeholderTextColor="#9E9E9E"
            value={dropoffAddress}
            onChangeText={(text) => {
              setDropoffAddress(text);
              setDropoffLat(null);
              setDropoffLng(null);
              setDropoffError(null);
              fetchDropoffSuggestions(text);
            }}
            autoCapitalize="words"
          />
          {dropoffLat != null && dropoffLng != null ? (
            <Text style={styles.dropoffConfirmed}>
              ✓ Address confirmed
            </Text>
          ) : null}
          {dropoffError ? (
            <Text style={styles.dropoffErrorText}>
              {dropoffError}
            </Text>
          ) : null}
        </View>

        {dropoffSuggestions.length > 0 ? (
          <View style={styles.suggestionsBox}>
            {dropoffSuggestions.map((place) => (
              <TouchableOpacity
                key={place.place_id}
                style={styles.suggestionItem}
                onPress={() => selectDropoffPlace(place)}
              >
                <Text style={styles.suggestionText} numberOfLines={2}>
                  {place.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

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
              {radiusConcern ? (
                <View style={styles.radiusWarning}>
                  <Text style={styles.radiusWarningText}>
                    {`⚠️ Dropoff looks ${Math.round(dropoffVsDestKm)}km from ${trip.to_city || 'the driver destination'}. This driver delivers within ${radiusKm}km.`}
                  </Text>
                </View>
              ) : null}
              {radiusHint && !radiusConcern ? (
                <View style={styles.radiusWarning}>
                  <Text style={styles.radiusWarningText}>
                    {`⚠️ Choose your delivery address from suggestions so we can verify it’s within ${radiusKm}km of ${trip.to_city || trip.to_address || 'the destination'}.`}
                  </Text>
                </View>
              ) : null}
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
  radiusInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  radiusInfoIcon: { fontSize: 16 },
  radiusInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
    lineHeight: 18,
  },
  radiusInfoBold: {
    fontWeight: '700',
    color: '#000000',
  },
  dropoffInputContainer: {
    marginBottom: 8,
  },
  dropoffInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15, color: '#000000',
    marginBottom: 4,
  },
  dropoffConfirmed: {
    fontSize: 12, color: '#00C853',
    fontWeight: '600', marginBottom: 8,
  },
  dropoffErrorText: {
    fontSize: 12, color: '#FF3B30',
    marginBottom: 8,
  },
  suggestionsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionText: {
    fontSize: 13, color: '#000000',
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
  cityLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 2,
  },
  routeText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },
  meetingCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#FFB800',
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  meetingIcon: { fontSize: 18, marginRight: 8 },
  meetingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  meetingAddress: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 20,
  },
  meetingDeadline: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '600',
    marginBottom: 8,
  },
  meetingNote: {
    fontSize: 12,
    color: '#757575',
    lineHeight: 18,
  },
  collectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    marginTop: 8,
    gap: 12,
  },
  collectIcon: { fontSize: 24 },
  collectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  collectSub: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
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
  radiusWarning: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  radiusWarningText: {
    fontSize: 13,
    color: '#5D4037',
    lineHeight: 18,
  },
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
