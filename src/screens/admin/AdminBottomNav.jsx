import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TABS = [
  { name: 'Overview', icon: '📊', screen: 'AdminOverview' },
  { name: 'Deliveries', icon: '📦', screen: 'Deliveries' },
  { name: 'Drivers', icon: '🚗', screen: 'DriverReview' },
  { name: 'Reports', icon: '📈', screen: 'Reports' },
];

export default function AdminBottomNav({ navigation, activeScreen }) {
  return (
    <View style={styles.bottomNav}>
      {TABS.map((tab) => {
        const active = tab.screen === activeScreen;
        return (
          <TouchableOpacity
            key={tab.screen}
            style={styles.navTab}
            onPress={() => {
              if (tab.screen !== activeScreen) {
                navigation.navigate(tab.screen);
              }
            }}
          >
            <Text style={styles.navIcon}>{tab.icon}</Text>
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
    paddingBottom: 20,
    paddingTop: 8,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  navIcon: { fontSize: 20 },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9E9E9E',
    marginTop: 2,
  },
  navLabelActive: { color: '#000000' },
});
