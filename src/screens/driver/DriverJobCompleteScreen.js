import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';

export default function DriverJobCompleteScreen({ route, navigation }) {
  const { booking } = route.params;
  const payout = booking?.driverPayout ?? booking?.driver_payout ?? 65;

  const handleBack = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'DriverHome' }],
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Checkmark */}
      <View style={styles.checkWrap}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>
      </View>

      <Text style={styles.title}>Delivery complete</Text>
      <Text style={styles.sub}>Great job. Payment has been logged.</Text>

      {/* Earnings */}
      <View style={styles.earningsCard}>
        <Text style={styles.earningsLabel}>YOU EARNED</Text>
        <Text style={styles.earningsAmount}>
          R {Number(payout).toFixed(2)}
        </Text>
      </View>

      <TouchableOpacity style={styles.cta} onPress={handleBack} activeOpacity={0.85}>
        <Text style={styles.ctaText}>Back to dashboard</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  checkWrap: {
    marginBottom: 32,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 44,
    color: theme.colors.obsidian,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    fontSize: 14,
    color: theme.colors.textOnDarkMuted,
    textAlign: 'center',
    marginBottom: 48,
  },
  earningsCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderAccent,
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 40,
  },
  earningsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.textOnDarkMuted,
    marginBottom: 10,
  },
  earningsAmount: {
    fontSize: 44,
    fontWeight: '700',
    color: theme.colors.volt,
    letterSpacing: -1,
  },
  cta: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textOnDark,
  },
});
