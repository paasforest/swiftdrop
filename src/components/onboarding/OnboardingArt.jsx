/**
 * Onboarding illustrations — Ionicons only (no react-native-svg).
 * SVG on the first screen was causing IllegalViewOperationException on Android Fabric.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';

const BOX = 140;

const ICONS = [
  'cube-outline', // deliver
  'map-outline', // track
  'shield-checkmark-outline', // secure
];

export function OnboardingSlideArt({ index }) {
  const name = ICONS[index] ?? ICONS[0];
  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Onboarding illustration">
      <View style={styles.iconCircle}>
        <Ionicons name={name} size={72} color={colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: BOX,
  },
  iconCircle: {
    width: BOX,
    height: BOX,
    borderRadius: BOX / 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
