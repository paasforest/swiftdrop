import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../apiConfig';
import ParcelLogoIcon from '../../components/auth/ParcelLogoIcon';

const UnsupportedAreaScreen = ({ navigation, route }) => {
  const latitude = route?.params?.latitude;
  const longitude = route?.params?.longitude;
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not save');
      setDone(true);
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoRow}>
            <ParcelLogoIcon size={40} color="#000" />
            <Text style={styles.wordmark}>SwiftDrop</Text>
          </View>

          <Text style={styles.pin}>📍</Text>

          <Text style={styles.heading}>{"We're not in your area yet"}</Text>
          <Text style={styles.body}>
            {
              "SwiftDrop currently delivers across Western Cape and Gauteng. We're growing fast — leave your email and we'll let you know the moment we launch near you."
            }
          </Text>

          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#9E9E9E"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!done}
          />

          {error ? <Text style={styles.err}>{error}</Text> : null}

          {done ? (
            <Text style={styles.success}>{"✓ You're on the list!"}</Text>
          ) : (
            <TouchableOpacity
              style={[styles.btn, submitting && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={submitting}
              activeOpacity={0.88}
            >
              <Text style={styles.btnText}>
                {submitting ? 'Sending…' : 'Notify me when you launch'}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.footer}>Currently serving Western Cape · Gauteng</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000',
  },
  pin: {
    fontSize: 48,
    marginBottom: 16,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#000',
    marginBottom: 12,
  },
  err: {
    color: '#C62828',
    fontSize: 14,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  btn: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  success: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#00C853',
    textAlign: 'center',
  },
  footer: {
    marginTop: 32,
    fontSize: 12,
    color: '#BDBDBD',
    textAlign: 'center',
  },
});

export default UnsupportedAreaScreen;
