import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
  StatusBar,
} from 'react-native';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { fetchPlacePredictions, fetchPlaceDetails } from '../../services/googlePlaces';

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function PostJob({ navigation }) {
  const auth = getAuth();
  const [step, setStep] = useState(1);

  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState(null);
  const [pickupLng, setPickupLng] = useState(null);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffLat, setDropoffLat] = useState(null);
  const [dropoffLng, setDropoffLng] = useState(null);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);

  const [parcelSize, setParcelSize] = useState('small');
  const [parcelType, setParcelType] = useState('');
  const [parcelValue, setParcelValue] = useState('');

  const [priceData, setPriceData] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deliveryType, setDeliveryType] = useState('local');

  const [walletBalance, setWalletBalance] = useState('0.00');

  useEffect(() => {
    if (pickupLat != null && pickupLng != null && dropoffLat != null && dropoffLng != null) {
      const dist = haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
      setDeliveryType(dist > 80 ? 'intercity' : 'local');
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  useEffect(() => {
    if (!auth?.token) return;
    getJson('/api/wallet/balance', { token: auth.token })
      .then((data) => {
        const b = data.balance;
        setWalletBalance(
          b != null && Number.isFinite(Number(b)) ? Number(b).toFixed(2) : '0.00'
        );
      })
      .catch(() => {});
  }, [auth?.token]);

  async function fetchPickupSuggestions(text) {
    if (!text || text.length < 2) {
      setPickupSuggestions([]);
      return;
    }
    try {
      const list = await fetchPlacePredictions(text);
      setPickupSuggestions(list || []);
    } catch (e) {
      console.error('pickup suggestions', e);
      setPickupSuggestions([]);
    }
  }

  async function fetchDropoffSuggestions(text) {
    if (!text || text.length < 2) {
      setDropoffSuggestions([]);
      return;
    }
    try {
      const list = await fetchPlacePredictions(text);
      setDropoffSuggestions(list || []);
    } catch (e) {
      console.error('dropoff suggestions', e);
      setDropoffSuggestions([]);
    }
  }

  async function selectPickup(place) {
    Keyboard.dismiss();
    try {
      const d = await fetchPlaceDetails(place.place_id);
      setPickupAddress(place.description || d.formatted_address || '');
      setPickupLat(d.latitude);
      setPickupLng(d.longitude);
      setPickupSuggestions([]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not load place');
    }
  }

  async function selectDropoff(place) {
    Keyboard.dismiss();
    try {
      const d = await fetchPlaceDetails(place.place_id);
      setDropoffAddress(place.description || d.formatted_address || '');
      setDropoffLat(d.latitude);
      setDropoffLng(d.longitude);
      setDropoffSuggestions([]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not load place');
    }
  }

  const fetchPrice = useCallback(async () => {
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) return;
    setLoadingPrice(true);
    try {
      const data = await postJson(
        '/api/jobs/estimate',
        {
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          dropoff_lat: dropoffLat,
          dropoff_lng: dropoffLng,
          parcel_size: parcelSize,
          parcel_value: Number(parcelValue) || 0,
          delivery_type: deliveryType,
        },
        { token: auth.token }
      );
      setPriceData(data);
    } catch (err) {
      console.error('fetchPrice:', err);
      setPriceData(null);
    } finally {
      setLoadingPrice(false);
    }
  }, [auth.token, pickupLat, pickupLng, dropoffLat, dropoffLng, parcelSize, parcelValue, deliveryType]);

  async function handlePostJob() {
    setPosting(true);
    try {
      await postJson(
        '/api/jobs',
        {
          pickup_address: pickupAddress,
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          dropoff_address: dropoffAddress,
          dropoff_lat: dropoffLat,
          dropoff_lng: dropoffLng,
          parcel_size: parcelSize,
          parcel_type: parcelType || 'General',
          parcel_value: Number(parcelValue) || 0,
          delivery_type: deliveryType,
          payment_method: 'wallet',
        },
        { token: auth.token }
      );

      Alert.alert(
        '✓ Job posted!',
        'Nearby drivers have been notified. You will get an SMS when a driver applies.',
        [{ text: 'View my jobs', onPress: () => navigation.replace('MyJobs') }]
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not post job');
    } finally {
      setPosting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Text style={{ fontSize: 22, color: '#000' }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a job</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {step === 1 ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>Where is the parcel?</Text>

            <Text style={styles.inputLabel}>PICKUP ADDRESS</Text>
            <TextInput
              style={styles.addressInput}
              placeholder="e.g. 123 Main Road, Soweto"
              placeholderTextColor="#BDBDBD"
              value={pickupAddress}
              onChangeText={(text) => {
                setPickupAddress(text);
                setPickupLat(null);
                setPickupLng(null);
                fetchPickupSuggestions(text);
              }}
            />
            {pickupSuggestions.length > 0 ? (
              <View style={styles.suggestionsBox}>
                {pickupSuggestions.map((place) => (
                  <TouchableOpacity
                    key={place.place_id}
                    style={styles.suggestionItem}
                    onPress={() => selectPickup(place)}
                  >
                    <Text style={styles.suggestionMain}>
                      {place.structured_formatting?.main_text || place.description}
                    </Text>
                    <Text style={styles.suggestionSub}>
                      {place.structured_formatting?.secondary_text || ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {pickupLat != null ? <Text style={styles.confirmedText}>✓ Pickup confirmed</Text> : null}

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>DELIVERY ADDRESS</Text>
            <TextInput
              style={styles.addressInput}
              placeholder="e.g. 45 West Street, Sandton"
              placeholderTextColor="#BDBDBD"
              value={dropoffAddress}
              onChangeText={(text) => {
                setDropoffAddress(text);
                setDropoffLat(null);
                setDropoffLng(null);
                fetchDropoffSuggestions(text);
              }}
            />
            {dropoffSuggestions.length > 0 ? (
              <View style={styles.suggestionsBox}>
                {dropoffSuggestions.map((place) => (
                  <TouchableOpacity
                    key={place.place_id}
                    style={styles.suggestionItem}
                    onPress={() => selectDropoff(place)}
                  >
                    <Text style={styles.suggestionMain}>
                      {place.structured_formatting?.main_text || place.description}
                    </Text>
                    <Text style={styles.suggestionSub}>
                      {place.structured_formatting?.secondary_text || ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {dropoffLat != null ? (
              <Text style={styles.confirmedText}>✓ Delivery address confirmed</Text>
            ) : null}

            {pickupLat != null && dropoffLat != null ? (
              <View style={styles.deliveryTypeBadge}>
                <Text style={styles.deliveryTypeBadgeText}>
                  {deliveryType === 'intercity' ? '🚗 Intercity delivery' : '📍 Local delivery'}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.nextBtn, (!pickupLat || !dropoffLat) && { opacity: 0.4 }]}
              disabled={!pickupLat || !dropoffLat}
              onPress={() => setStep(2)}
            >
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>Tell us about your parcel</Text>

            <Text style={styles.inputLabel}>PARCEL SIZE</Text>
            <View style={styles.sizeRow}>
              {[
                { key: 'small', label: 'Small', sub: 'Fits in a bag' },
                { key: 'medium', label: 'Medium', sub: 'Shoebox size' },
                { key: 'large', label: 'Large', sub: 'Suitcase size' },
              ].map((size) => (
                <TouchableOpacity
                  key={size.key}
                  style={[styles.sizeCard, parcelSize === size.key && styles.sizeCardSelected]}
                  onPress={() => setParcelSize(size.key)}
                >
                  <Text
                    style={[styles.sizeName, parcelSize === size.key && styles.sizeNameSelected]}
                  >
                    {size.label}
                  </Text>
                  <Text style={styles.sizeSub}>{size.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 20 }]}>WHAT ARE YOU SENDING?</Text>
            <View style={styles.typeRow}>
              {['Documents', 'Clothing', 'Electronics', 'Food', 'Hardware', 'Other'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, parcelType === type && styles.typeChipSelected]}
                  onPress={() => setParcelType(type)}
                >
                  <Text style={[styles.typeText, parcelType === type && styles.typeTextSelected]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 20 }]}>PARCEL VALUE (FOR INSURANCE)</Text>
            <TextInput
              style={styles.valueInput}
              placeholder="e.g. 500"
              placeholderTextColor="#9E9E9E"
              keyboardType="numeric"
              value={parcelValue}
              onChangeText={setParcelValue}
            />
            <Text style={styles.valueHint}>Maximum insured value: R2,000</Text>

            <View style={styles.stepButtons}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={() => {
                  setStep(3);
                  fetchPrice();
                }}
              >
                <Text style={styles.nextBtnText}>See price →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>Confirm your job</Text>

            <View style={styles.routeSummary}>
              <View style={styles.routeRow}>
                <View style={styles.dotGreen} />
                <Text style={styles.routeText} numberOfLines={2}>
                  {pickupAddress}
                </Text>
              </View>
              <View style={styles.routeConnector} />
              <View style={styles.routeRow}>
                <View style={styles.dotBlack} />
                <Text style={styles.routeText} numberOfLines={2}>
                  {dropoffAddress}
                </Text>
              </View>
            </View>

            {loadingPrice ? (
              <ActivityIndicator color="#000" size="large" style={{ marginVertical: 24 }} />
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
                <Text style={styles.priceNote}>
                  📍 {priceData.distance_km}km · ⏱️ ~{priceData.estimated_minutes} min
                </Text>
                <Text style={styles.priceNote}>
                  {deliveryType === 'intercity' ? '🚗 Intercity delivery' : '📍 Local delivery'}
                </Text>
              </View>
            ) : null}

            <View style={styles.walletRow}>
              <Text style={styles.walletLabel}>💳 Wallet balance</Text>
              <Text style={styles.walletBalance}>R{walletBalance}</Text>
            </View>

            <View style={styles.stepButtons}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setStep(2);
                }}
              >
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postBtn, (!priceData || posting) && { opacity: 0.4 }]}
                disabled={!priceData || posting}
                onPress={handlePostJob}
              >
                {posting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.postBtnText}>Post job · R{priceData?.total_price}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000', flex: 1, textAlign: 'center' },
  stepCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  stepTitle: { fontSize: 20, fontWeight: '800', color: '#000000', marginBottom: 20 },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  addressInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000',
    marginBottom: 4,
  },
  suggestionsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionMain: { fontSize: 14, fontWeight: '600', color: '#000' },
  suggestionSub: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  confirmedText: { fontSize: 12, color: '#00C853', fontWeight: '600', marginBottom: 8 },
  deliveryTypeBadge: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 16,
  },
  deliveryTypeBadgeText: { fontSize: 13, fontWeight: '600', color: '#000000' },
  sizeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sizeCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
  },
  sizeCardSelected: { borderColor: '#000000', backgroundColor: '#F5F5F5' },
  sizeName: { fontSize: 14, fontWeight: '700', color: '#757575', marginBottom: 4 },
  sizeNameSelected: { color: '#000000' },
  sizeSub: { fontSize: 10, color: '#9E9E9E', textAlign: 'center' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  typeChipSelected: { backgroundColor: '#000000', borderColor: '#000000' },
  typeText: { fontSize: 13, fontWeight: '600', color: '#757575' },
  typeTextSelected: { color: '#FFFFFF' },
  valueInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000',
  },
  valueHint: { fontSize: 11, color: '#9E9E9E', marginTop: 6 },
  routeSummary: { backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16, marginBottom: 16 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00C853',
    marginRight: 10,
    marginTop: 4,
  },
  dotBlack: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#000',
    marginRight: 10,
    marginTop: 4,
  },
  routeConnector: { width: 2, height: 16, backgroundColor: '#E0E0E0', marginLeft: 4 },
  routeText: { fontSize: 13, color: '#000', fontWeight: '500', flex: 1, lineHeight: 18 },
  priceCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  priceCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 14, color: '#757575' },
  priceValue: { fontSize: 14, fontWeight: '600', color: '#000' },
  priceDivider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#000' },
  totalAmount: { fontSize: 24, fontWeight: '800', color: '#000' },
  priceNote: { fontSize: 12, color: '#9E9E9E', marginTop: 4 },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  walletLabel: { fontSize: 14, color: '#757575' },
  walletBalance: { fontSize: 14, fontWeight: '700', color: '#000' },
  stepButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: '#757575' },
  nextBtn: {
    flex: 2,
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  postBtn: {
    flex: 2,
    backgroundColor: '#00C853',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
