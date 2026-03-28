import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { theme } from '../../theme/theme';

const ROLES = [
  {
    id: 'driver',
    tag: 'DRIVER',
    title: 'I deliver parcels',
    desc: 'Accept jobs, navigate, earn per delivery.',
    accent: theme.colors.signalGreen,
    dark: true,
  },
  {
    id: 'sender',
    tag: 'SENDER',
    title: 'I need to send a parcel',
    desc: 'Request pickups, track live, get proof of delivery.',
    accent: theme.colors.volt,
    dark: true,
  },
];

export default function WelcomeScreen({ navigation }) {
  const [selected, setSelected] = useState(null);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Logo */}
      <View style={styles.logoWrap}>
        <View style={styles.logoMark}>
          <Text style={styles.logoArrow}>→</Text>
        </View>
        <Text style={styles.wordmark}>SwiftDrop</Text>
        <Text style={styles.tagline}>PARCELS. DELIVERED.</Text>
      </View>

      {/* Role cards */}
      <View style={styles.cards}>
        {ROLES.map((role) => {
          const isSelected = selected === role.id;
          return (
            <TouchableOpacity
              key={role.id}
              style={[styles.card, isSelected && { borderColor: role.accent, borderWidth: 2 }]}
              onPress={() => setSelected(isSelected ? null : role.id)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={[styles.tag, { backgroundColor: role.accent }]}>
                  <Text style={[styles.tagText, { color: theme.colors.obsidian }]}>{role.tag}</Text>
                </View>
                {/* Selection circle */}
                <View style={[styles.circle, isSelected && { backgroundColor: role.accent, borderColor: role.accent }]}>
                  {isSelected && <View style={styles.circleDot} />}
                </View>
              </View>
              <Text style={styles.cardTitle}>{role.title}</Text>
              <Text style={styles.cardDesc}>{role.desc}</Text>

              {/* Expanded action buttons when selected */}
              {isSelected && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: role.accent }]}
                    onPress={() => navigation.navigate('Register', { role: role.id })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionBtnTextDark}>New setup</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => navigation.navigate('Login', { role: role.id })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionBtnTextLight}>Log in</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.footer}>
        SwiftDrop · Gauteng &amp; Western Cape
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.obsidian,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },

  // Logo
  logoWrap: { alignItems: 'center', marginTop: 16 },
  logoMark: {
    width: 56, height: 56,
    backgroundColor: theme.colors.volt,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  logoArrow: { fontSize: 24, fontWeight: '700', color: theme.colors.obsidian },
  wordmark: {
    fontSize: 28, fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.5, marginBottom: 4,
  },
  tagline: {
    fontSize: 10, fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 3,
  },

  // Cards
  cards: { gap: 14 },
  card: {
    backgroundColor: theme.colors.surfaceDark,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.5,
  },
  circle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  circleDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: theme.colors.obsidian,
  },
  cardTitle: {
    fontSize: 16, fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.2, marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12, color: theme.colors.textOnDarkMuted, lineHeight: 18,
  },

  // Action buttons (shown when card selected)
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  actionBtn: {
    flex: 1, height: 44,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnOutline: {
    flex: 1, height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnTextDark: {
    fontSize: 14, fontWeight: '700', color: theme.colors.obsidian,
  },
  actionBtnTextLight: {
    fontSize: 14, fontWeight: '600', color: theme.colors.textLight,
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 0.5,
  },
});
