import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';

export default function BookingDeclarationScreen({ route, navigation }) {
  const { bookingParams, estimate } = route.params;
  const [accepted, setAccepted] = useState(false);

  const handleContinue = () => {
    if (!accepted) return;
    navigation.navigate('Payment', { bookingParams, estimate });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.inner}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Parcel rules</Text>
          <Text style={styles.subtitle}>
            Quick check before we match a driver — same idea as other courier apps.
          </Text>

          <View style={styles.card}>
            <Text style={styles.bullet}>• No cash or negotiable instruments sent as parcel contents.</Text>
            <Text style={styles.bullet}>• No illegal or dangerous goods (batteries, weapons, drugs, etc.).</Text>
            <Text style={styles.bullet}>
              • Nothing over <Text style={styles.bulletStrong}>R5,000</Text> in value unless you’ve agreed
              separate cover with SwiftDrop — ordinary loss limits may apply.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setAccepted((v) => !v)}
            activeOpacity={0.85}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
              {accepted ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>
              I confirm my parcel follows these rules. I accept SwiftDrop’s terms for this delivery.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cta, !accepted && styles.ctaDisabled]}
            onPress={handleContinue}
            disabled={!accepted}
            activeOpacity={0.9}
          >
            <Text style={[styles.ctaText, !accepted && styles.ctaTextDisabled]}>Continue to payment</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.obsidian },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  inner: { paddingHorizontal: 24, paddingBottom: 32 },
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  backArrow: { fontSize: 22, color: theme.colors.volt },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textOnDarkMuted,
    lineHeight: 21,
    marginBottom: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bullet: {
    fontSize: 14,
    color: theme.colors.textOnDark,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletStrong: { color: theme.colors.volt, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 28 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  checkboxOn: { backgroundColor: theme.colors.volt },
  checkmark: { color: theme.colors.obsidian, fontSize: 14, fontWeight: '800' },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textLight,
    lineHeight: 21,
  },
  cta: {
    ...theme.components.accentButton,
    borderRadius: 14,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { ...theme.components.accentButtonText, fontSize: 16 },
  ctaTextDisabled: { color: 'rgba(10,10,15,0.35)' },
});
