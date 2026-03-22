import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';
import { normalizeDriverDeliveriesCompleted } from '../../utils/driverTrustDisplay';

/**
 * Round driver photo or primary-colored initial fallback (customer trust UI).
 * Optional achievement badge: >100 deliveries = gold star, >500 = diamond (replaces star).
 */
export default function DriverAvatar({ uri, name, size = 56, deliveriesCompleted = 0 }) {
  const trimmed = name != null ? String(name).trim() : '';
  const initial = (trimmed.charAt(0) || 'D').toUpperCase();
  const r = size / 2;
  const photo = uri != null ? String(uri).trim() : '';
  const dc = normalizeDriverDeliveriesCompleted(deliveriesCompleted);
  const badge = dc > 500 ? 'diamond' : dc > 100 ? 'star' : null;
  const badgeSize = Math.max(16, Math.round(size * 0.32));

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
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
            },
            badge === 'diamond' ? styles.badgeDiamond : styles.badgeGold,
          ]}
          accessibilityLabel={badge === 'diamond' ? 'Top driver' : 'Experienced driver'}
        >
          {badge === 'diamond' ? (
            <Ionicons name="diamond-outline" size={Math.round(badgeSize * 0.55)} color="#5B21B6" />
          ) : (
            <Ionicons name="star" size={Math.round(badgeSize * 0.55)} color="#B45309" />
          )}
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
    backgroundColor: '#E9D5FF',
  },
});
