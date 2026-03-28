import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { auth } from '../../services/firebaseConfig';
import { postJson } from '../../apiClient';
import { useAuthStore } from '../../authStore';
import { theme } from '../../theme/theme';

export default function SenderProfileScreen() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const { setProfileComplete } = useAuthStore();

  const handleComplete = async () => {
    if (!address.trim()) {
      Alert.alert('Missing info', 'Please enter your default pickup address.');
      return;
    }
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      await postJson('/api/auth/complete-profile', { defaultAddress: address.trim() }, { token });
      setProfileComplete();
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
      <View style={styles.chip}>
        <Text style={styles.chipText}>SENDER SETUP</Text>
      </View>
      <Text style={styles.title}>One last thing</Text>
      <Text style={styles.subtitle}>
        Add your most common pickup address. You can always change this later.
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>DEFAULT PICKUP ADDRESS</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 12 Bree St, Cape Town"
          placeholderTextColor={theme.colors.textFaint}
          autoCapitalize="words"
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>What happens next</Text>
        <Text style={styles.infoItem}>→ Search for available drivers nearby</Text>
        <Text style={styles.infoItem}>→ Track your driver live on the map</Text>
        <Text style={styles.infoItem}>→ Get OTP-verified pickup and delivery</Text>
        <Text style={styles.infoItem}>→ Photo proof on every delivery</Text>
      </View>

      <TouchableOpacity style={styles.cta} onPress={handleComplete} disabled={loading} activeOpacity={0.85}>
        {loading ? <ActivityIndicator color={theme.colors.textLight} /> : <Text style={styles.ctaText}>Start sending parcels</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  inner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  chip: { alignSelf: 'flex-start', backgroundColor: theme.colors.obsidian, borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 24 },
  chipText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.volt },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 20, marginBottom: 32 },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginBottom: 7 },
  input: { ...theme.components.input, height: 72, paddingTop: 14, textAlignVertical: 'top' },
  infoCard: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 16, padding: 18, marginBottom: 32, gap: 10 },
  infoTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  infoItem: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
  cta: { ...theme.components.ctaButton },
  ctaText: { ...theme.components.ctaButtonText },
});
