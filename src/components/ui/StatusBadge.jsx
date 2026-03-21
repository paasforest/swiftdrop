import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/theme';

const PAD = { paddingVertical: 4, paddingHorizontal: 12 };

/** Map backend order status → badge palette (instantly scannable). */
export function getStatusBadgeColors(status) {
  const s = String(status || '')
    .toLowerCase()
    .replace(/\s/g, '_');

  if (s === 'pending' || s === 'unmatched') {
    return { bg: '#F59E0B', fg: colors.textWhite };
  }
  if (s === 'collected' || s === 'picked_up') {
    return { bg: '#7C3AED', fg: colors.textWhite };
  }
  if (s === 'delivered' || s === 'completed') {
    return { bg: '#10B981', fg: colors.textWhite };
  }
  if (s === 'cancelled' || s === 'canceled') {
    return { bg: colors.danger, fg: colors.textWhite };
  }
  if (s === 'disputed') {
    return { bg: colors.accent, fg: colors.textWhite };
  }
  if (
    s === 'matching' ||
    s === 'accepted' ||
    s === 'matched' ||
    s.includes('en_route') ||
    s.includes('arrived')
  ) {
    return { bg: colors.primary, fg: colors.textWhite };
  }
  return { bg: colors.primaryLight, fg: colors.primary };
}

function formatLabel(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase();
}

export default function StatusBadge({ status, style }) {
  const { bg, fg } = getStatusBadgeColors(status);
  return (
    <View style={[styles.wrap, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {formatLabel(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...PAD,
    borderRadius: 20,
    alignSelf: 'flex-start',
    maxWidth: '52%',
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
