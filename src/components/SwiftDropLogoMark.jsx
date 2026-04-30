import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing } from '../theme/theme';

/** Compact wordmark for map placeholder / empty states */
export default function SwiftDropLogoMark() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.wordmark}>SwiftDrop</Text>
      <Text style={styles.tagline}>Delivery you can trust</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  wordmark: {
    marginBottom: spacing.xs,
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  tagline: {
    fontSize: 12,
    color: '#757575',
  },
});
