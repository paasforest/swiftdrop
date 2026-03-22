import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/theme';
import { normalizeDriverDeliveriesCompleted } from '../../utils/driverTrustDisplay';

/**
 * Round driver photo or primary-colored initial fallback (customer trust UI).
 * Achievement badges (bottom-right): >= 100 deliveries gold ⭐, >= 500 blue 💎.
 */
export default function DriverAvatar({ uri, name, size = 56, deliveriesCompleted = 0 }) {
  const trimmed = name != null ? String(name).trim() : '';
  const initial = (trimmed.charAt(0) || 'D').toUpperCase();
  const r = size / 2;
  const photo = uri != null ? String(uri).trim() : '';
  const dc = normalizeDriverDeliveriesCompleted(deliveriesCompleted);
  const badge = dc >= 500 ? 'diamond' : dc >= 100 ? 'star' : null;
  const badgeMin = Math.max(18, Math.round(size * 0.34));

  const face = photo ? (
    <Image
      source={{ uri: photo }}
      style={[styles.image, { width: size, height: size, borderRadius: r }]}
    />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: r }]}>
      <Text style={[styles.initialText, { fontSize: Math.round(size * 0.39) }]}>{initial}</Text>
    </View>
  );

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {face}
      {badge ? (
        <View
          style={[
            styles.badge,
            {
              minWidth: badgeMin,
              minHeight: badgeMin,
              borderRadius: badgeMin / 2,
              paddingHorizontal: badge === 'diamond' ? 3 : 2,
            },
            badge === 'diamond' ? styles.badgeDiamond : styles.badgeGold,
          ]}
          accessibilityLabel={badge === 'diamond' ? 'Top driver' : 'Experienced driver'}
        >
          <Text style={styles.badgeEmoji}>{badge === 'diamond' ? '💎' : '⭐'}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  image: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  fallback: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    color: colors.textWhite,
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textWhite,
  },
  badgeGold: {
    backgroundColor: '#FDE68A',
  },
  badgeDiamond: {
    backgroundColor: '#BFDBFE',
  },
  badgeEmoji: {
    fontSize: 11,
    lineHeight: 14,
  },
});
