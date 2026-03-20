import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView } from 'react-native';
import { postJson } from '../../apiClient';

const { width, height } = Dimensions.get('window');

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
  const {
    pickup_lat,
    pickup_lng,
    dropoff_lat,
    dropoff_lng,
    parcel_value,
  } = params;

  const [selectedTier, setSelectedTier] = useState('express');
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(null);

  const deliveryOptions = useMemo(
    () => [
      {
        id: 'standard',
        name: 'Standard',
        icon: '🕐',
        iconColor: '#4CAF50',
        description: 'Route match — 2-5 hours',
      },
      {
        id: 'express',
        name: 'Express',
        icon: '⚡',
        iconColor: '#1A73E8',
        description: 'Nearby driver — 1-2 hours',
        popular: true,
      },
      {
        id: 'urgent',
        name: 'Urgent',
        icon: '🔥',
        iconColor: '#FF6B35',
        description: 'Dedicated driver — under 1 hour',
      },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (pickup_lat == null || pickup_lng == null || dropoff_lat == null || dropoff_lng == null) return;
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

  const handleTierSelect = (tierId) => {
    setSelectedTier(tierId);
  };

  const handleContinue = () => {
    const selectedPrice = estimate?.[selectedTier]?.price ?? null;
    const valueComponent = estimate?.value_component ?? 0;
    const basePrice = typeof selectedPrice === 'number' ? selectedPrice - valueComponent : null;

    navigation.navigate('Payment', {
      ...params,
      delivery_tier: selectedTier,
      // backend ignores this for pricing now, but we keep it for compatibility.
      insurance_selected: true,
      delivery_total: selectedPrice,
      delivery_base_price: basePrice,
      delivery_insurance_fee: valueComponent,
    });
  };

  const handleBack = () => {
    console.log('Back pressed');
  };

  const totalPrice = estimate?.[selectedTier]?.price ?? 0;
  const valueComponent = estimate?.value_component ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Delivery Speed</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Route Info */}
        <View style={styles.routeInfo}>
          <Text style={styles.routeText}>
            {estimateLoading
              ? 'Calculating route…'
              : estimate?.distance_km != null
                ? `${estimate.distance_km} km · ${zoneLabel(estimate.zone)}`
                : 'Select delivery speed'}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '75%' }]} />
          </View>
          <Text style={styles.progressText}>Step 3 of 4</Text>
        </View>

        {/* Delivery Options */}
        <View style={styles.optionsContainer}>
          {deliveryOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionCard,
                selectedTier === option.id && styles.optionCardSelected,
                estimate?.[option.id]?.available === false && styles.optionCardUnavailable,
              ]}
              onPress={() => handleTierSelect(option.id)}
            >
              <View style={styles.optionHeader}>
                <View style={styles.optionLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: option.iconColor }]}>
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionName}>{option.name}</Text>
                    <Text style={styles.optionDescription}>
                      {estimate?.[option.id]?.time ?? option.description}
                    </Text>
                  </View>
                </View>
                <View style={styles.optionRight}>
                  {option.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  )}
                  <Text style={styles.optionPrice}>
                    {estimate?.[option.id]?.price != null ? formatMoney(estimate[option.id].price) : '—'}
                  </Text>

                  {estimate?.[option.id]?.driver_earns != null && (
                    <Text style={styles.driverEarnsText}>
                      Driver earns {formatMoney(estimate[option.id].driver_earns)}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.priceLockBadge}>
                <Text style={styles.priceLockBadgeText}>This price is guaranteed — never changes</Text>
              </View>

              {estimate?.[option.id]?.available === false ? (
                <Text style={styles.unavailableText}>Unavailable right now</Text>
              ) : null}

              {selectedTier === option.id && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Protection + upgrade callouts */}
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

      {/* Bottom Section */}
      <View style={styles.bottomContainer}>
        <View style={styles.priceSummary}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>{formatMoney(totalPrice)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (estimateLoading || estimate == null) && { opacity: 0.6 },
          ]}
          onPress={handleContinue}
          disabled={estimateLoading || estimate == null}
        >
          <Text style={styles.continueButtonText}>Continue to Payment</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: width,
    height: height,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backArrow: {
    fontSize: 24,
    color: '#1A73E8',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 24,
  },
  routeInfo: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  routeText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1A73E8',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  optionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  optionCardSelected: {
    borderColor: '#1A73E8',
    backgroundColor: '#E8F4FF',
  },
  optionCardUnavailable: {
    opacity: 0.6,
    backgroundColor: '#F5F5F5',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  optionLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionIcon: {
    fontSize: 20,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666666',
  },
  optionRight: {
    alignItems: 'flex-end',
  },
  popularBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  optionPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A73E8',
  },
  optionDetails: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  unavailableText: {
    fontSize: 12,
    color: '#FF6B35',
    marginTop: 8,
    fontWeight: '500',
  },
  priceLockBadge: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#B9DDFF',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  priceLockBadgeText: {
    color: '#1A73E8',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  driverEarnsText: {
    fontSize: 12,
    color: '#444444',
    marginTop: 4,
    fontWeight: '600',
  },
  protectionSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  protectionBadge: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  protectionText: {
    color: '#1B5E20',
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'center',
  },
  upgradeBox: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  upgradeTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 10,
    textAlign: 'center',
  },
  upgradeLine: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  insuranceSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  insuranceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  insuranceLeft: {
    flex: 1,
  },
  insuranceTitle: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  insuranceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insurancePrice: {
    fontSize: 14,
    color: '#666666',
    marginRight: 8,
  },
  infoButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 12,
  },
  toggle: {
    width: 48,
    height: 24,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
  },
  toggleOn: {
    backgroundColor: '#1A73E8',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    margin: 2,
    alignSelf: 'flex-start',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  priceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666666',
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A73E8',
  },
  continueButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeliveryTiers;
