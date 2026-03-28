import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { auth } from '../../services/firebaseConfig';
import { postJson } from '../../apiClient';
import { useAuthStore } from '../../authStore';
import { theme } from '../../theme/theme';

const VEHICLE_TYPES = ['Motorcycle', 'Car', 'Bakkie', 'Van'];

export default function DriverProfileScreen() {
  const [idNumber, setIdNumber] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [loading, setLoading] = useState(false);
  const { setProfileComplete } = useAuthStore();

  const handleComplete = async () => {
    if (!idNumber || !vehicle || !vehicleReg) {
      Alert.alert('Missing info', 'Please fill in all fields.');
      return;
    }
    if (!isValidSAId(idNumber)) {
      Alert.alert('Invalid ID', 'Please enter a valid 13-digit South African ID number.');
      return;
    }
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      await postJson(
        '/api/auth/complete-profile',
        {
          idNumber: idNumber.trim(),
          vehicleType: vehicle,
          vehicleReg: vehicleReg.trim().toUpperCase(),
        },
        { token }
      );
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
        <Text style={styles.chipText}>DRIVER SETUP</Text>
      </View>
      <Text style={styles.title}>Driver profile</Text>
      <Text style={styles.subtitle}>
        We need a few details to verify you. Your info is kept secure.
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>SA ID NUMBER</Text>
        <TextInput
          style={styles.input}
          placeholder="13-digit ID number"
          placeholderTextColor={theme.colors.textFaint}
          keyboardType="numeric"
          maxLength={13}
          value={idNumber}
          onChangeText={setIdNumber}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>VEHICLE TYPE</Text>
        <View style={styles.vehicleRow}>
          {VEHICLE_TYPES.map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.vehicleChip, vehicle === v && styles.vehicleChipSelected]}
              onPress={() => setVehicle(v)}
            >
              <Text style={[styles.vehicleChipText, vehicle === v && styles.vehicleChipTextSelected]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>VEHICLE REGISTRATION</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. CA 441 GP"
          placeholderTextColor={theme.colors.textFaint}
          autoCapitalize="characters"
          value={vehicleReg}
          onChangeText={setVehicleReg}
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How earning works</Text>
        <Text style={styles.infoItem}>→ Accept jobs that appear on your dashboard</Text>
        <Text style={styles.infoItem}>→ Navigate to pickup, verify with OTP</Text>
        <Text style={styles.infoItem}>→ Deliver, take photo proof, get paid</Text>
        <Text style={styles.infoItem}>→ Gauteng & Western Cape only for now</Text>
      </View>

      <TouchableOpacity style={styles.cta} onPress={handleComplete} disabled={loading} activeOpacity={0.85}>
        {loading ? <ActivityIndicator color={theme.colors.obsidian} /> : <Text style={styles.ctaText}>Start driving</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function isValidSAId(id) {
  return /^[0-9]{13}$/.test(id);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  inner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  chip: { alignSelf: 'flex-start', backgroundColor: theme.colors.signalGreen, borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 24 },
  chipText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#fff' },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 20, marginBottom: 32 },
  fieldGroup: { marginBottom: 22 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginBottom: 7 },
  input: { ...theme.components.input },
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vehicleChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.full, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  vehicleChipSelected: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.obsidian },
  vehicleChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  vehicleChipTextSelected: { color: theme.colors.textLight },
  infoCard: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 16, padding: 18, marginBottom: 32, gap: 10 },
  infoTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  infoItem: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
  cta: { ...theme.components.accentButton },
  ctaText: { ...theme.components.accentButtonText },
});
