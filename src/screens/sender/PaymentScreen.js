import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../services/firebaseConfig';
import { postJson } from '../../apiClient';
import { theme } from '../../theme/theme';

const PAYMENT_METHODS = [
  {
    id: 'cash',
    label: 'Cash on delivery',
    description: 'Pay the driver when your parcel is delivered',
    icon: '💵',
    available: true,
  },
  {
    id: 'card',
    label: 'Card payment',
    description: 'Visa, Mastercard via PayFast — coming soon',
    icon: '💳',
    available: false,
  },
];

export default function PaymentScreen({ route, navigation }) {
  const { bookingParams, estimate } = route.params;
  // bookingParams = { pickupAddress, dropoffAddress, parcelSize, pickupLat, pickupLng, dropoffLat, dropoffLng }
  // estimate = { km, price, mins }

  const [selectedMethod, setSelectedMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  const fare = estimate?.price ?? 0;
  const distanceKm = estimate?.km ?? 0;
  const etaMins = estimate?.mins ?? 0;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;
      const data = await postJson(
        '/api/bookings/request',
        {
          ...bookingParams,
          paymentMethod: selectedMethod,
          senderDeclarationAccepted: true,
        },
        { token }
      );
      navigation.replace('FindingDriver', { booking: data });
    } catch (err) {
      if (err.code === 'OUT_OF_SERVICE_AREA') {
        let body =
          err.field === 'pickup'
            ? 'Your pickup must be in the Western Cape or Gauteng. Go back and edit the pickup address, then try again.'
            : err.field === 'dropoff'
              ? 'Your delivery address must be in the Western Cape or Gauteng. Go back and edit the drop-off, then try again.'
              : err.message ||
                'SwiftDrop currently serves the Western Cape and Gauteng only. Please adjust your addresses and try again.';
        Alert.alert('Outside service area', body);
      } else if (err.code === 'DECLARATION_REQUIRED') {
        Alert.alert(
          'Declaration required',
          'Go back one step and confirm the parcel rules before requesting a driver.',
          [{ text: 'OK', onPress: () => navigation.navigate('BookingDeclaration', { bookingParams, estimate }) }]
        );
      } else if (err.status === 404 || err.message?.includes('NO_DRIVERS')) {
        Alert.alert(
          'No drivers nearby',
          'No drivers are available right now. Please try again shortly.'
        );
      } else {
        Alert.alert('Request failed', err.message || 'Could not submit your request. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Confirm & pay</Text>
        <Text style={styles.subtitle}>Review your delivery and choose a payment method.</Text>

        {/* Fare Summary Card */}
        <View style={styles.fareCard}>
          <Text style={styles.sectionLabel}>FARE ESTIMATE</Text>
          <Text style={styles.fareAmount}>R {fare.toFixed(2)}</Text>

          <View style={styles.fareRow}>
            <View style={styles.fareChip}>
              <Text style={styles.fareChipValue}>{distanceKm} km</Text>
              <Text style={styles.fareChipLabel}>Distance</Text>
            </View>
            <View style={styles.fareChipDivider} />
            <View style={styles.fareChip}>
              <Text style={styles.fareChipValue}>{etaMins} min</Text>
              <Text style={styles.fareChipLabel}>Est. delivery</Text>
            </View>
            <View style={styles.fareChipDivider} />
            <View style={styles.fareChip}>
              <Text style={styles.fareChipValue}>{bookingParams.parcelSize}</Text>
              <Text style={styles.fareChipLabel}>Parcel size</Text>
            </View>
          </View>

          {/* Route */}
          <View style={styles.routeBlock}>
            <View style={styles.routeRow}>
              <View style={styles.dotPickup} />
              <Text style={styles.routeAddress} numberOfLines={1}>{bookingParams.pickupAddress}</Text>
            </View>
            <View style={styles.routeDash} />
            <View style={styles.routeRow}>
              <View style={styles.dotDropoff} />
              <Text style={styles.routeAddress} numberOfLines={1}>{bookingParams.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>

        {PAYMENT_METHODS.map((method) => {
          const isSelected = selectedMethod === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                isSelected && styles.methodCardSelected,
                !method.available && styles.methodCardDisabled,
              ]}
              onPress={() => method.available && setSelectedMethod(method.id)}
              activeOpacity={method.available ? 0.85 : 1}
            >
              <Text style={styles.methodIcon}>{method.icon}</Text>
              <View style={styles.methodText}>
                <View style={styles.methodRow}>
                  <Text style={[styles.methodLabel, !method.available && styles.methodLabelMuted]}>
                    {method.label}
                  </Text>
                  {!method.available && (
                    <View style={styles.comingSoonPill}>
                      <Text style={styles.comingSoonText}>SOON</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.methodDesc}>{method.description}</Text>
              </View>
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Fine print */}
        {selectedMethod === 'cash' && (
          <Text style={styles.finePrint}>
            You'll pay the driver directly in cash when your parcel is delivered. The fare shown is an estimate.
          </Text>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.cta, loading && styles.ctaDisabled]}
          onPress={handleConfirm}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Confirm — R {fare.toFixed(2)}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  inner:     { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  back:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  backArrow: { fontSize: 18, color: theme.colors.text },

  title:    { fontSize: 24, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 24 },

  // Fare card
  fareCard: {
    backgroundColor: theme.colors.obsidian,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  fareAmount:   { fontSize: 40, fontWeight: '700', color: theme.colors.volt, letterSpacing: -1, marginBottom: 16 },

  fareRow:        { flexDirection: 'row', marginBottom: 20 },
  fareChip:       { flex: 1, alignItems: 'center' },
  fareChipValue:  { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  fareChipLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  fareChipDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

  routeBlock: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 16 },
  routeRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDash:  { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.2)', marginLeft: 6, marginVertical: 4 },
  dotPickup:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  dotDropoff: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.volt, borderWidth: 2, borderColor: '#fff' },
  routeAddress: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  // Payment methods
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    gap: 12,
  },
  methodCardSelected: { borderColor: theme.colors.obsidian },
  methodCardDisabled: { opacity: 0.5 },
  methodIcon:  { fontSize: 26 },
  methodText:  { flex: 1 },
  methodRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  methodLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  methodLabelMuted: { color: theme.colors.textMuted },
  methodDesc:  { fontSize: 12, color: theme.colors.textMuted },

  comingSoonPill: { backgroundColor: '#F0F0F0', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  comingSoonText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },

  radioOuter:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: theme.colors.obsidian },
  radioDot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.obsidian },

  finePrint: { fontSize: 11, color: theme.colors.textMuted, lineHeight: 16, marginBottom: 20, paddingHorizontal: 4 },

  cta:         { height: 52, backgroundColor: theme.colors.obsidian, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaDisabled: { opacity: 0.6 },
  ctaText:     { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
});
