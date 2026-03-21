import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { postJson } from '../../apiClient';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppButton, AppText } from '../../components/ui';

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </TouchableOpacity>
          <AppText variant="h3" color="textPrimary">
            Choose Delivery Speed
          </AppText>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.routeInfo}>
          <AppText variant="small" color="textSecondary" style={styles.routeText}>
            {estimateError
              ? estimateError
              : estimateLoading
                ? 'Calculating route…'
                : estimate?.distance_km != null
                  ? `${estimate.distance_km} km · ${zoneLabel(estimate.zone)}`
                  : 'Select delivery speed'}
          </AppText>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '75%' }]} />
          </View>
          <AppText variant="label" color="textSecondary" style={styles.progressText}>
            Step 3 of 4
          </AppText>
        </View>

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
                {/* Row 1: tier name | price + optional checkmark */}
                <View style={styles.cardRow}>
                  <View style={styles.cardRow1Left}>
                    <AppText variant="h4" color="textPrimary" style={styles.tierName}>
                      {option.name}
                    </AppText>
                    {option.popular ? (
                      <View style={styles.popularBadge}>
                        <AppText variant="label" style={styles.popularBadgeText}>
                          Popular
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.cardRow1Right}>
                    <AppText style={styles.priceOrange}>{priceStr}</AppText>
                    {selected ? (
                      <View style={styles.checkmarkCircle}>
                        <Ionicons name="checkmark" size={14} color={colors.textWhite} />
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Row 2: time estimate (driver earnings never shown to customers) */}
                <View style={styles.cardRow}>
                  <AppText variant="small" color="textSecondary" style={styles.timeLineText}>
                    {timeLine}
                  </AppText>
                </View>

                {/* Row 3: zone */}
                <View style={styles.cardRow}>
                  <View style={styles.zoneBadge}>
                    <AppText variant="label" color="textSecondary" style={styles.zoneBadgeText}>
                      {estimate?.zone != null ? zoneLabel(estimate.zone) : 'Zone'}
                    </AppText>
                  </View>
                </View>

                {/* Row 4: guaranteed (green pill) — full width */}
                <View style={[styles.cardRow, styles.cardRowLast]}>
                  <View style={styles.guaranteedPillWrap}>
                    <View style={styles.guaranteedPill}>
                      <AppText variant="small" style={styles.guaranteedPillText}>
                        Price Guaranteed ✓
                      </AppText>
                    </View>
                  </View>
                </View>

                {unavailable ? (
                  <AppText variant="small" color="accent" style={styles.unavailableText}>
                    Unavailable right now
                  </AppText>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.protectionSection}>
          <View style={styles.protectionBadge}>
            <AppText variant="body" style={styles.protectionText}>
              R500 parcel protection included
            </AppText>
          </View>

          {Number(parcel_value) > 500 ? (
            <View style={styles.upgradeBox}>
              <AppText variant="h4" color="textPrimary" style={styles.upgradeTitle}>
                Upgrade options
              </AppText>
              <AppText variant="small" color="textSecondary" style={styles.upgradeLine}>
                Upgrade to R2000 cover for R25
              </AppText>
              <AppText variant="small" color="textSecondary" style={styles.upgradeLine}>
                Upgrade to R5000 cover for R65
              </AppText>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.bottomContainer}>
        <View style={styles.priceSummary}>
          <AppText variant="h4" color="textSecondary">
            Total
          </AppText>
          <AppText variant="h1" color="primary" style={styles.totalPrice}>
            {formatMoney(totalPrice)}
          </AppText>
        </View>
        <AppButton
          label="Continue to payment"
          variant="primary"
          onPress={handleContinue}
          disabled={disabledContinue}
          loading={estimateLoading}
        />
      </View>
    </SafeAreaView>
  );
};

const ROW_GAP = 6;
const CARD_PAD = 16;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    width,
    minHeight: height,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  placeholder: {
    width: 24,
  },
  routeInfo: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  routeText: {
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    textAlign: 'center',
  },
  optionsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  optionCard: {
    flexDirection: 'column',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: CARD_PAD,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  optionCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.tierSelectedBg,
  },
  optionCardUnavailable: {
    opacity: 0.6,
    backgroundColor: colors.background,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ROW_GAP,
  },
  cardRowLast: {
    marginBottom: 0,
  },
  cardRowAlignStart: {
    alignItems: 'flex-start',
  },
  guaranteedPillWrap: {
    flex: 1,
    width: '100%',
  },
  cardRow1Left: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  tierName: {
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  popularBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  popularBadgeText: {
    color: colors.textWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  cardRow1Right: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  priceOrange: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
  },
  checkmarkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  timeLineText: {
    flex: 1,
  },
  zoneBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoneBadgeText: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  guaranteedPill: {
    alignSelf: 'stretch',
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guaranteedPillText: {
    color: colors.success,
    fontWeight: '700',
    textAlign: 'center',
  },
  unavailableText: {
    marginTop: ROW_GAP,
    fontWeight: '600',
  },
  protectionSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  protectionBadge: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 6,
    marginBottom: spacing.sm,
  },
  protectionText: {
    color: colors.success,
    fontWeight: '700',
    textAlign: 'center',
  },
  upgradeBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 6,
  },
  upgradeTitle: {
    marginBottom: 10,
    textAlign: 'center',
  },
  upgradeLine: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  bottomContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  totalPrice: {
    fontSize: 24,
  },
});

export default DeliveryTiers;
