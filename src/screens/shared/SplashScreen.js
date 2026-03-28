import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <Text style={styles.markIcon}>→</Text>
      </View>
      <Text style={styles.wordmark}>SwiftDrop</Text>
      <Text style={styles.tagline}>PARCELS. DELIVERED.</Text>
      <ActivityIndicator color={theme.colors.volt} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 64,
    height: 64,
    backgroundColor: theme.colors.volt,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  markIcon: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.obsidian,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textOnDarkMuted,
    letterSpacing: 3,
  },
  spinner: {
    marginTop: 24,
  },
});
