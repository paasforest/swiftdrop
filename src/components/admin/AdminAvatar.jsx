import React from 'react';
import { View, StyleSheet } from 'react-native';
import AppText from '../ui/AppText';
import { colors, adminType } from '../../theme/theme';

export default function AdminAvatar({ name, size = 28 }) {
  const initials = String(name || 'A')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'A';

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <AppText style={[adminType.badge, styles.initials]}>{initials}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.textWhite,
    fontSize: 10,
  },
});
