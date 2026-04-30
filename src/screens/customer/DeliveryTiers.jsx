import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { postJson } from '../../apiClient';

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

function zoneLabel(zone) {
  if (!zone) return '';
  const z = String(zone);
  if (z === 'city') return 'City';
  if (z === 'regional') return 'Regional';
  if (z === 'intercity') return 'Intercity';
  if (z === 'long_distance') return 'Intercity';
  return z;
}

const DeliveryTiers = ({ navigation, route }) => {
  const params = route?.params || {};
  const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, parcel_value } = params;

  const [selectedTier, setSelectedTier] = useState('express');
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(null);

  const deliveryOptions = useMemo(
    () => [
      {
        id: 'standard',
        name: 'Standard',
        description: 'Route match — 2-5 hours',
      },
      {
        id: 'express',
        name: 'Express',
        description: 'Nearby driver — 1-2 hours',
        popular: true,
      },
      {
        id: 'urgent',
        name: 'Urgent',
        description: 'Dedicated driver — under 1 hour',
      },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (pickup_lat == null || pickup_lng == null || dropoff_lat == null || dropoff_lng == null)
        return;
      if (parcel_value == null) return;

      setEstimateLoading(true);
      setEstimateError(null);
      try {
        const data = await postJson('/api/orders/price-estimate', {
          pickup_lat,
          pickup_lng,
          dropoff_lat,
          dropoff_lng,
          parcel_value,
        });
        if (!cancelled) setEstimate(data ?? {});
      } catch (e) {
        if (!cancelled) setEstimateError(e.message || 'Could not estimate price');
      } finally {
        if (!cancelled) setEstimateLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, parcel_value]);

  const handleContinue = () => {
    const selectedPrice = estimate?.[selectedTier]?.price ?? null;
    const valueComponent = estimate?.value_component ?? 0;
    const basePrice = typeof selectedPrice === 'number' ? selectedPrice - valueComponent : null;

    navigation.navigate('Payment', {
      ...params,
      delivery_tier: selectedTier,
      insurance_selected: true,
      delivery_total: selectedPrice,
      delivery_base_price: basePrice,
      delivery_insurance_fee: valueComponent,
    });
  };

  const totalPrice = estimate?.[selectedTier]?.price ?? 0;
  const disabledContinue = estimateLoading || estimate == null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery speed</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

        {/* Route info */}
        <Text style={styles.routeText}>
          {estimateError
            ? estimateError
            : estimateLoading
              ? 'Calculating route…'
              : estimate?.distance_km != null
                ? `${estimate.distance_km} km · ${zoneLabel(estimate.zone)}`
                : 'Select delivery speed'}
        </Text>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '75%' }]} />
          </View>
          <Text style={styles.progressText}>Step 3 of 4</Text>
        </View>

        {/* Tier cards */}
        <View style={styles.optionsContainer}>
          {deliveryOptions.map((option) => {
            const tierEstimate = estimate?.[option.id];
            const unavailable = tierEstimate?.available === false;
            const priceStr =
              tierEstimate?.price != null ? formatMoney(tierEstimate.price) : '—';
            const timeLine = tierEstimate?.time ?? option.description;
            const selected = selectedTier === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  selected && styles.optionCardSelected,
                  unavailable && styles.optionCardUnavailable,
                ]}
                onPress={() => setSelectedTier(option.id)}
                activeOpacity={0.9}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardRow1Left}>
                    <Text style={styles.tierName}>{option.name}</Text>
                    {option.popular ? (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>Popular</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.cardRow1Right}>
                    <Text style={styles.priceText}>{priceStr}</Text>
                    {selected ? (
                      <View style={styles.checkmarkCircle}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.cardRow}>
                  <Text style={styles.timeLineText}>{timeLine}</Text>
                </View>

                <View style={styles.cardRow}>
                  <View style={styles.zoneBadge}>
                    <Text style={styles.zoneBadgeText}>
                      {estimate?.zone != null ? zoneLabel(estimate.zone) : 'Zone'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.cardRow, { marginBottom: 0 }]}>
                  <View style={styles.guaranteedPillWrap}>
                    <View style={styles.guaranteedPill}>
                      <Text style={styles.guaranteedPillText}>Price Guaranteed ✓</Text>
                    </View>
                  </View>
                </View>

                {unavailable ? (
                  <Text style={styles.unavailableText}>Unavailable right now</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Protection */}
        <View style={styles.protectionSection}>
          <View style={styles.protectionBadge}>
            <Text style={styles.protectionText}>R500 parcel protection included</Text>
          </View>

          {Number(parcel_value) > 500 ? (
            <View style={styles.upgradeBox}>
              <Text style={styles.upgradeTitle}>Upgrade options</Text>
              <Text style={styles.upgradeLine}>Upgrade to R2000 cover for R25</Text>
              <Text style={styles.upgradeLine}>Upgrade to R5000 cover for R65</Text>
            </View>
          ) : null}
        </View>

      </ScrollView>

      {/* Bottom: total + continue */}
      <View style={styles.bottomContainer}>
        <View style={styles.priceSummary}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>{formatMoney(totalPrice)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.continueButton, disabledContinue && { opacity: 0.4 }]}
          onPress={handleContinue}
          disabled={disabledContinue}
        >
          {estimateLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>Continue to payment</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const CARD_PAD = 16;
const ROW_GAP = 6;

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
  routeText: {
    fontSize: 13,
    color: '#9E9E9E',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#000000',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  optionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    padding: CARD_PAD,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  optionCardSelected: {
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#F5F5F5',
  },
  optionCardUnavailable: {
    opacity: 0.6,
    backgroundColor: '#F5F5F5',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ROW_GAP,
  },
  cardRow1Left: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginRight: 8,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginRight: 8,
  },
  popularBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  cardRow1Right: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  priceText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  checkmarkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  timeLineText: {
    flex: 1,
    fontSize: 13,
    color: '#9E9E9E',
  },
  zoneBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  zoneBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#757575',
    textTransform: 'capitalize',
  },
  guaranteedPillWrap: {
    flex: 1,
    width: '100%',
  },
  guaranteedPill: {
    alignSelf: 'stretch',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#00C853',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guaranteedPillText: {
    color: '#00C853',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  unavailableText: {
    marginTop: ROW_GAP,
    fontWeight: '600',
    fontSize: 12,
    color: '#FF9500',
  },
  protectionSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  protectionBadge: {
    backgroundColor: '#E8F5E9',
    borderColor: '#00C853',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  protectionText: {
    color: '#00C853',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 14,
  },
  upgradeBox: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  upgradeTitle: {
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  upgradeLine: {
    marginBottom: 6,
    textAlign: 'center',
    fontSize: 13,
    color: '#9E9E9E',
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  priceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
  },
  continueButton: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DeliveryTiers;
