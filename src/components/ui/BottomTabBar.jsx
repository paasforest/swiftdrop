import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme/theme';
import AppText from './AppText';

/**
 * @param {'customer' | 'driver'} variant
 * @param {'home' | 'track' | 'history' | 'profile' | 'jobs' | 'earnings'} active
 */
export default function BottomTabBar({ navigation, variant = 'customer', active = 'home' }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, spacing.sm);

  if (variant === 'customer') {
    const tabs = [
      { key: 'home', label: 'Home', icon: 'home', iconOutline: 'home-outline', route: 'Home' },
      { key: 'track', label: 'Track', icon: 'location', iconOutline: 'location-outline', route: 'Tracking' },
      { key: 'history', label: 'History', icon: 'time', iconOutline: 'time-outline', route: 'OrderHistory' },
      { key: 'profile', label: 'Profile', icon: 'person', iconOutline: 'person-outline', route: 'Profile' },
    ];

    return (
      <View style={[styles.bar, { paddingBottom: bottomPad }]}>
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.item}
              onPress={() => navigation.navigate(t.route)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? t.icon : t.iconOutline}
                size={24}
                color={isActive ? '#000000' : colors.textLight}
              />
              <AppText
                variant="small"
                style={[styles.tabLabel, { color: isActive ? '#000000' : colors.textLight }]}
              >
                {t.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (variant === 'driver') {
    const tabs = [
      { key: 'home', label: 'Home', icon: 'home', iconOutline: 'home-outline', route: 'DriverHome' },
      { key: 'jobs', label: 'Jobs', icon: 'briefcase', iconOutline: 'briefcase-outline', route: 'JobOffer' },
      { key: 'earnings', label: 'Earnings', icon: 'wallet', iconOutline: 'wallet-outline', route: 'EarningsScreen' },
      { key: 'profile', label: 'Profile', icon: 'person', iconOutline: 'person-outline', route: 'Profile' },
    ];

    return (
      <View style={[styles.bar, { paddingBottom: bottomPad }]}>
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.item}
              onPress={() => navigation.navigate(t.route)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? t.icon : t.iconOutline}
                size={24}
                color={isActive ? '#000000' : colors.textLight}
              />
              <AppText
                variant="small"
                style={[styles.tabLabel, { color: isActive ? '#000000' : colors.textLight }]}
              >
                {t.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  tabLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
});
