import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { theme } from '../../theme/theme';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const SIZES = ['Small', 'Medium', 'Large'];
const SIZE_DESC = { Small: 'Fits in a shoebox', Medium: 'Laptop bag size', Large: 'Up to 20 kg' };

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcEstimate(pickupCoord, dropoffCoord) {
  if (!pickupCoord || !dropoffCoord) return null;
  const km = haversineKm(
    pickupCoord.lat, pickupCoord.lng,
    dropoffCoord.lat, dropoffCoord.lng
  );
  const price = Math.round(30 + 8 * km);
  const mins = Math.max(5, Math.round((km / 40) * 60));
  return { km: Math.round(km * 10) / 10, price, mins };
}

const AUTOCOMPLETE_QUERY = {
  key: GOOGLE_MAPS_API_KEY,
  language: 'en',
  components: 'country:za',
};

export default function NewBookingScreen({ navigation }) {
  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);

  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoord, setPickupCoord] = useState(null);
  const [dropoffCoord, setDropoffCoord] = useState(null);
  const [parcelSize, setParcelSize] = useState('');

  const estimate = calcEstimate(pickupCoord, dropoffCoord);
  const canSubmit = pickupAddress && dropoffAddress && parcelSize;

  const handleFindDriver = () => {
    if (!pickupAddress || !dropoffAddress || !parcelSize) {
      Alert.alert('Missing info', 'Please fill in pickup address, drop-off address and parcel size.');
      return;
    }
    navigation.navigate('Payment', {
      bookingParams: {
        pickupAddress,
        dropoffAddress,
        parcelSize,
        pickupLat: pickupCoord?.lat,
        pickupLng: pickupCoord?.lng,
        dropoffLat: dropoffCoord?.lat,
        dropoffLng: dropoffCoord?.lng,
      },
      estimate,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          {/* Back + header */}
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>New delivery</Text>
          <Text style={styles.subtitle}>Gauteng &amp; Western Cape only</Text>

          {/* Address card — GooglePlacesAutocomplete must NOT be inside a ScrollView */}
          <View style={styles.addressCard}>
            <View style={styles.connectorLine} />

            {/* Pickup */}
            <View style={styles.addressRow}>
              <View style={styles.dotPickup} />
              <View style={styles.addressInputWrap}>
                <Text style={styles.addressLabel}>PICKUP</Text>
                <GooglePlacesAutocomplete
                  ref={pickupRef}
                  placeholder="Enter pickup address"
                  minLength={3}
                  debounce={300}
                  fetchDetails
                  onPress={(data, details = null) => {
                    setPickupAddress(data.description);
                    if (details?.geometry?.location) {
                      setPickupCoord({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                    }
                  }}
                  query={AUTOCOMPLETE_QUERY}
                  styles={placesStyles}
                  enablePoweredByContainer={false}
                  keepResultsAfterBlur
                  textInputProps={{
                    placeholderTextColor: theme.colors.textFaint,
                    returnKeyType: 'next',
                    onChangeText: (t) => { if (!t) { setPickupAddress(''); setPickupCoord(null); } },
                  }}
                />
              </View>
            </View>

            <View style={styles.addressDivider} />

            {/* Dropoff */}
            <View style={styles.addressRow}>
              <View style={styles.dotDropoff} />
              <View style={styles.addressInputWrap}>
                <Text style={styles.addressLabel}>DROP-OFF</Text>
                <GooglePlacesAutocomplete
                  ref={dropoffRef}
                  placeholder="Enter drop-off address"
                  minLength={3}
                  debounce={300}
                  fetchDetails
                  onPress={(data, details = null) => {
                    setDropoffAddress(data.description);
                    if (details?.geometry?.location) {
                      setDropoffCoord({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                    }
                  }}
                  query={AUTOCOMPLETE_QUERY}
                  styles={placesStyles}
                  enablePoweredByContainer={false}
                  keepResultsAfterBlur
                  textInputProps={{
                    placeholderTextColor: theme.colors.textFaint,
                    returnKeyType: 'done',
                    onChangeText: (t) => { if (!t) { setDropoffAddress(''); setDropoffCoord(null); } },
                  }}
                />
              </View>
            </View>
          </View>

          {/* Parcel size */}
          <Text style={styles.sectionLabel}>PARCEL SIZE</Text>
          <View style={styles.sizeRow}>
            {SIZES.map((s) => {
              const selected = parcelSize === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.sizeChip, selected && styles.sizeChipSelected]}
                  onPress={() => setParcelSize(s)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sizeChipLabel, selected && styles.sizeChipLabelSelected]}>{s}</Text>
                  <Text style={[styles.sizeChipDesc, selected && styles.sizeChipDescSelected]}>{SIZE_DESC[s]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Price estimate */}
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Estimated price</Text>
            <Text style={styles.estimateAmount}>{estimate ? `R ${estimate.price}` : 'R —'}</Text>
          </View>

          {/* Chips row */}
          <View style={styles.chipsRow}>
            {[
              { value: '~5', label: 'Pickup ETA (min)' },
              { value: estimate ? `${estimate.km} km` : '—', label: 'Distance' },
              { value: estimate ? `${estimate.mins} min` : '—', label: 'Delivery time' },
            ].map((c) => (
              <View key={c.label} style={styles.chip}>
                <Text style={styles.chipValue}>{c.value}</Text>
                <Text style={styles.chipLabel}>{c.label}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.cta, !canSubmit && styles.ctaDisabled]}
            onPress={handleFindDriver}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={theme.colors.textLight} />
              : <Text style={styles.ctaText}>Find a driver</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Styles that GooglePlacesAutocomplete accepts via its `styles` prop
const placesStyles = {
  container: { flex: 0 },
  textInputContainer: { backgroundColor: 'transparent', paddingHorizontal: 0 },
  textInput: {
    height: 36,
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 0,
  },
  listView: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    zIndex: 999,
  },
  row: { paddingHorizontal: 14, paddingVertical: 12 },
  description: { fontSize: 13, color: theme.colors.text },
  separator: { height: 1, backgroundColor: theme.colors.border },
  poweredContainer: { display: 'none' },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },

  back: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  backArrow: { fontSize: 18, color: theme.colors.text },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 28 },

  addressCard: {
    backgroundColor: '#F8F8F8', borderRadius: 16, padding: 18,
    marginBottom: 28, borderWidth: 1, borderColor: theme.colors.border, position: 'relative',
  },
  connectorLine: {
    position: 'absolute', left: 26, top: 44, bottom: 44,
    width: 1, borderStyle: 'dashed', borderLeftWidth: 1.5, borderColor: '#CCC',
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  dotPickup: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: theme.colors.obsidian,
    marginTop: 20, marginRight: 14, flexShrink: 0,
  },
  dotDropoff: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: theme.colors.volt,
    borderWidth: 2, borderColor: theme.colors.obsidian,
    marginTop: 20, marginRight: 14, flexShrink: 0,
  },
  addressInputWrap: { flex: 1 },
  addressLabel: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1,
    color: theme.colors.textMuted, marginBottom: 2,
  },
  addressDivider: { height: 16 },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: theme.colors.textMuted, marginBottom: 12,
  },
  sizeRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  sizeChip: {
    flex: 1, backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 14, borderWidth: 1.5, borderColor: theme.colors.border, padding: 12, alignItems: 'center',
  },
  sizeChipSelected: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.obsidian },
  sizeChipLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 3 },
  sizeChipLabelSelected: { color: theme.colors.textLight },
  sizeChipDesc: { fontSize: 10, color: theme.colors.textFaint, textAlign: 'center' },
  sizeChipDescSelected: { color: 'rgba(255,255,255,0.4)' },

  estimateRow: { marginBottom: 16 },
  estimateLabel: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },
  estimateAmount: { fontSize: 22, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5 },

  chipsRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  chip: { flex: 1, backgroundColor: theme.colors.surfaceElevated, borderRadius: 12, padding: 12, alignItems: 'center' },
  chipValue: { fontSize: 16, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.3, marginBottom: 3 },
  chipLabel: { fontSize: 9, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 13 },

  cta: { ...theme.components.ctaButton },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { ...theme.components.ctaButtonText },
});
