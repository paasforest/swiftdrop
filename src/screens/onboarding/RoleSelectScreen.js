import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { auth } from '../../services/firebaseConfig';
import { postJson } from '../../apiClient';
import { useAuthStore } from '../../authStore';
import { theme } from '../../theme/theme';

const ROLES = [
  {
    id: 'sender',
    tag: 'SENDER',
    title: 'I need to send parcels',
    desc: 'Request pickups, track live, get delivery proof on every job.',
  },
  {
    id: 'driver',
    tag: 'DRIVER',
    title: 'I want to earn delivering',
    desc: 'Accept jobs nearby, navigate, and earn per successful delivery.',
  },
];

export default function RoleSelectScreen({ navigation }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const { setRole } = useAuthStore();

  const handleContinue = async () => {
    if (!selected) {
      Alert.alert('Pick a role', 'Please select how you will use SwiftDrop.');
      return;
    }
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      await postJson('/api/auth/set-role', { role: selected }, { token });
      setRole(selected);
      navigation.navigate(selected === 'sender' ? 'SenderProfile' : 'DriverProfile');
    } catch {
      Alert.alert('Error', 'Could not save your role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>How will you use{'\n'}SwiftDrop?</Text>
        <Text style={styles.subtitle}>
          Choose your role carefully — this cannot be changed later.
        </Text>
      </View>

      <View style={styles.cards}>
        {ROLES.map((role) => {
          const isSelected = selected === role.id;
          const isDark = role.id === 'sender';
          return (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.card,
                isDark ? styles.cardDark : styles.cardLight,
                isSelected && (isDark ? styles.cardDarkSelected : styles.cardLightSelected),
              ]}
              onPress={() => setSelected(role.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.cardTag, isDark ? styles.tagDark : styles.tagLight]}>{role.tag}</Text>
              <Text style={[styles.cardTitle, isDark ? styles.titleDark : styles.titleLight]}>{role.title}</Text>
              <Text style={[styles.cardDesc, isDark ? styles.descDark : styles.descLight]}>{role.desc}</Text>
              <View style={[styles.indicator, isSelected && styles.indicatorSelected]}>
                {isSelected && <View style={styles.indicatorDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.cta, !selected && styles.ctaDisabled]}
        onPress={handleContinue}
        disabled={!selected || loading}
        activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator color={theme.colors.textLight} /> : <Text style={styles.ctaText}>Continue</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  inner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  header: { marginBottom: 36 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5, lineHeight: 34, marginBottom: 10 },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 20 },
  cards: { gap: 14, marginBottom: 32 },
  card: { borderRadius: 20, padding: 22, borderWidth: 2, position: 'relative' },
  cardDark: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.obsidian },
  cardLight: { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
  cardDarkSelected: { borderColor: theme.colors.volt },
  cardLightSelected: { borderColor: theme.colors.obsidian },
  cardTag: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  tagDark: { color: theme.colors.volt },
  tagLight: { color: theme.colors.textMuted },
  cardTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, marginBottom: 6 },
  titleDark: { color: theme.colors.textLight },
  titleLight: { color: theme.colors.text },
  cardDesc: { fontSize: 12, lineHeight: 18 },
  descDark: { color: theme.colors.textOnDarkMuted },
  descLight: { color: theme.colors.textMuted },
  indicator: { position: 'absolute', top: 20, right: 20, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  indicatorSelected: { borderColor: theme.colors.volt, backgroundColor: 'rgba(232,255,0,0.15)' },
  indicatorDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.volt },
  cta: { ...theme.components.ctaButton },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { ...theme.components.ctaButtonText },
});
