import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  View,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { theme } from '../../theme/theme';

function friendlyError(code) {
  switch (code) {
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function LoginScreen({ navigation, route }) {
  const role = route?.params?.role ?? null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert('Login failed', friendlyError(err.code));
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
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.mark}>
          <Text style={styles.markText}>→</Text>
        </View>

        <View style={styles.header}>
          {role && (
            <View style={[styles.roleChip, role === 'driver' ? styles.roleChipDriver : styles.roleChipSender]}>
              <Text style={styles.roleChipText}>{role.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            {role === 'driver' ? 'Sign in to your driver account'
              : role === 'sender' ? 'Sign in to your sender account'
              : 'Sign in to your SwiftDrop account'}
          </Text>
        </View>

        <View style={styles.fields}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor={theme.colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textFaint}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={theme.colors.textLight} /> : <Text style={styles.ctaText}>Sign in</Text>}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Create one</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  back: {
    width: 40, height: 40,
    borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  backText: { fontSize: 18, color: theme.colors.text },
  back: {
    width: 40, height: 40,
    borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  backText: { fontSize: 18, color: theme.colors.text },
  roleChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 999, marginBottom: 12,
  },
  roleChipDriver: { backgroundColor: theme.colors.signalGreen },
  roleChipSender: { backgroundColor: theme.colors.volt },
  roleChipText: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.5,
    color: theme.colors.obsidian,
  },
  mark: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.obsidian,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  markText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.volt,
  },
  roleChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, marginBottom: 10,
  },
  roleChipDriver: { backgroundColor: theme.colors.signalGreen },
  roleChipSender: { backgroundColor: theme.colors.volt },
  roleChipText: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.5,
    color: theme.colors.obsidian,
  },
  header: {
    marginBottom: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  fields: {
    marginBottom: 8,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: theme.colors.textMuted,
    marginBottom: 7,
  },
  input: {
    ...theme.components.input,
  },
  cta: {
    ...theme.components.ctaButton,
    marginTop: 24,
  },
  ctaText: {
    ...theme.components.ctaButtonText,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: theme.colors.textFaint,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.obsidian,
  },
});
