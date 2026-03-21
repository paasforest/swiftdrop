/**
 * Premium blue header — solid primary with optional bottom border accent.
 * Uses only standard Views (no react-native-svg) to avoid Android
 * IllegalViewOperation from SVG / absolute layering during first layout.
 */
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '../theme/theme';

export default function GradientHeader({ children, style }) {
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.wrap, { width }, style]} collapsable={false}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primary,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.gradientEnd,
  },
});
