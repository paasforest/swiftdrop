import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../ui/AppText';
import { colors, adminType } from '../../theme/theme';

/**
 * Dark admin header (#1E293B).
 * @param {'overview' | 'simple' | 'back'} mode
 */
export default function AdminHeader({
  mode = 'simple',
  title,
  subtitle,
  onBack,
  right,
}) {
  const insets = useSafeAreaInsets();

  if (mode === 'overview') {
    return (
      <View style={[styles.bar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.row}>
          <View style={styles.leftBlock}>
            <AppText style={[adminType.title, styles.white]}>SwiftDrop Admin</AppText>
            <AppText style={[adminType.label, styles.whiteMuted]}>
              {subtitle || new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </AppText>
          </View>
          {right}
        </View>
      </View>
    );
  }

  if (mode === 'back') {
    return (
      <View style={[styles.bar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.row}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.backRow}>
            <Ionicons name="chevron-back" size={22} color={colors.textWhite} />
            <AppText style={[adminType.title, styles.white]}>{title}</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, 12) }]}>
      <AppText style={[adminType.title, styles.white]}>{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.adminHeader,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftBlock: {
    flex: 1,
  },
  white: { color: colors.textWhite },
  whiteMuted: { color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
