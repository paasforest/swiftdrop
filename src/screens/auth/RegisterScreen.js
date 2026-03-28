import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, ScrollView,
} from 'react-native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { postJson } from '../../apiClient';
import { theme } from '../../theme/theme';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !phone || !password || !confirmPass) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPass) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (!isValidSAPhone(phone)) {
      Alert.alert('Invalid phone', 'Enter a valid SA number e.g. 0821234567');
      return;
    }
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      await updateProfile(user, { displayName: name.trim() });
      const token = await user.getIdToken();
      await postJson(
        '/api/auth/register',
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: normalizePhone(phone),
          firebaseUid: user.uid,
        },
        { token }
      );
      // App.js onAuthStateChanged takes over — will route to RoleSelect (no role yet)
    } catch (err) {
      Alert.alert('Registration failed', friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join SwiftDrop — takes 60 seconds</Text>
        </View>

        {[
          { label: 'FULL NAME', value: name, setter: setName, placeholder: 'Your full name', keyboard: 'default', caps: 'words', secure: false },
          { label: 'EMAIL', value: email, setter: setEmail, placeholder: 'you@email.com', keyboard: 'email-address', caps: 'none', secure: false },
          { label: 'SA PHONE', value: phone, setter: setPhone, placeholder: '082 123 4567', keyboard: 'phone-pad', caps: 'none', secure: false },
          { label: 'PASSWORD', value: password, setter: setPassword, placeholder: 'Min. 6 characters', keyboard: 'default', caps: 'none', secure: true },
          { label: 'CONFIRM', value: confirmPass, setter: setConfirmPass, placeholder: 'Repeat your password', keyboard: 'default', caps: 'none', secure: true },
        ].map((f) => (
          <View key={f.label} style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={f.placeholder}
              placeholderTextColor={theme.colors.textFaint}
              keyboardType={f.keyboard}
              autoCapitalize={f.caps}
              autoCorrect={false}
              secureTextEntry={f.secure}
              value={f.value}
              onChangeText={f.setter}
            />
          </View>
        ))}

        <TouchableOpacity
          style={styles.cta}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={theme.colors.textLight} />
            : <Text style={styles.ctaText}>Create account</Text>
          }
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          By registering you agree to SwiftDrop's Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function isValidSAPhone(p) {
  return /^0[6-8][0-9]{8}$/.test(p.replace(/\s/g, ''));
}

function normalizePhone(p) {
  const c = p.replace(/\s/g, '');
  return c.startsWith('0') ? '+27' + c.slice(1) : c;
}

function friendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    default: return 'Something went wrong. Please try again.';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  inner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  back: {
    width: 40, height: 40, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  backText: { fontSize: 18, color: theme.colors.text },
  header: { marginBottom: 32 },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 14, color: theme.colors.textMuted },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginBottom: 7 },
  input: { ...theme.components.input },
  cta: { ...theme.components.ctaButton, marginTop: 8, marginBottom: 20 },
  ctaText: { ...theme.components.ctaButtonText },
  footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  footerText: { fontSize: 13, color: theme.colors.textMuted },
  footerLink: { fontSize: 13, fontWeight: '700', color: theme.colors.obsidian },
  legal: { fontSize: 11, color: theme.colors.textFaint, textAlign: 'center', lineHeight: 16 },
});
