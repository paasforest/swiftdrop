import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing, shadows } from '../../theme/theme';

export default function AppCard({ children, style, noMargin }) {
  return (
    <View style={[styles.card, noMargin && styles.noMargin, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm + spacing.xs,
    ...shadows.card,
  },
  noMargin: {
    marginBottom: 0,
  },
});
