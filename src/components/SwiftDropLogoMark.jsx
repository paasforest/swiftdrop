import React from 'react';
import { View, StyleSheet } from 'react-native';
import AppText from './ui/AppText';
import { colors, spacing } from '../theme/theme';

/** Compact wordmark for map placeholder / empty states */
export default function SwiftDropLogoMark() {
  return (
    <View style={styles.wrap}>
      <AppText variant="h2" color="primary" style={styles.wordmark}>
        SwiftDrop
      </AppText>
      <AppText variant="small" color="textSecondary">
        Delivery you can trust
      </AppText>
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
  },
});
