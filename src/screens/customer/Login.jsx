import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { postJson } from '../../apiClient';
import { setAuth } from '../../authStore';
import { resetToRoleHome } from '../../navigationHelpers';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppText, AppButton } from '../../components/ui';

const { width, height } = Dimensions.get('window');

function cleanLoginInput(value) {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .trim();
}

const Login = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizePhoneForApi = (phoneInput) => {
    let v = String(phoneInput ?? '').trim();
    v = v.replace(/\s+/g, '');
    if (v.startsWith('+')) v = v.slice(1);
    if (v.startsWith('0')) v = `27${v.slice(1)}`;
    if (v.startsWith('27')) return `+${v}`;
    if (/^[678]\d{8}$/.test(v)) return `+27${v}`;
    return '';
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const email = cleanLoginInput(loginEmail).toLowerCase();
      const password = cleanLoginInput(loginPassword);
      if (!email || !password) {
        setErrorMessage('Email and password are required.');
        return;
      }

      const data = await postJson('/api/auth/login', {
        email,
        password,
      });

      setAuth({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      resetToRoleHome(navigation, data.user);
    } catch (err) {
      setErrorMessage(err.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (!registerName || !registerEmail || !registerPassword || !confirmPassword) {
        setErrorMessage('Please fill in all registration fields.');
        return;
      }
      if (registerPassword.length < 8) {
        setErrorMessage('Password must be at least 8 characters.');
        return;
      }
      if (registerPassword !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      const phone = normalizePhoneForApi(registerPhone);
      if (!phone) {
        setErrorMessage('Enter a valid South African phone number.');
        return;
      }

      const data = await postJson('/api/auth/register-customer', {
        full_name: registerName,
        email: registerEmail.trim(),
        phone,
        password: registerPassword,
      });

      if (data.phoneVerificationRequired === false && data.token && data.refreshToken) {
        setAuth({
          token: data.token,
          refreshToken: data.refreshToken,
          user: data.user,
        });
        resetToRoleHome(navigation, data.user);
        return;
      }

      navigation.navigate('OTPScreen', { phone });
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {};

  const handleForgotPassword = () => {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <AppText variant="h1" color="primary" style={styles.logo}>
            SwiftDrop
          </AppText>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'login' && styles.activeTab]}
            onPress={() => setActiveTab('login')}
          >
            <AppText
              variant="h4"
              color={activeTab === 'login' ? 'primary' : 'textSecondary'}
              style={{ fontWeight: activeTab === 'login' ? '600' : '500' }}
            >
              Login
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'register' && styles.activeTab]}
            onPress={() => setActiveTab('register')}
          >
            <AppText
              variant="h4"
              color={activeTab === 'register' ? 'primary' : 'textSecondary'}
              style={{ fontWeight: activeTab === 'register' ? '600' : '500' }}
            >
              Register
            </AppText>
          </TouchableOpacity>
        </View>

        {activeTab === 'login' && (
          <View style={styles.formContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Email or phone"
              placeholderTextColor={colors.textLight}
              value={loginEmail}
              onChangeText={setLoginEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInputInner}
                placeholder="Password"
                placeholderTextColor={colors.textLight}
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleForgotPassword}>
              <AppText variant="small" color="primary" style={styles.forgot}>
                Forgot password?
              </AppText>
            </TouchableOpacity>

            {errorMessage ? (
              <AppText variant="small" color="danger" style={styles.errorText}>
                {errorMessage}
              </AppText>
            ) : null}

            <AppButton
              label={isSubmitting ? 'Logging in…' : 'Login'}
              variant="primary"
              onPress={handleLogin}
              loading={isSubmitting}
              disabled={isSubmitting}
            />

            <AppButton
              label="Register as driver"
              variant="outline"
              onPress={() => navigation.navigate('DriverRegister')}
              disabled={isSubmitting}
              style={{ marginTop: spacing.sm }}
            />

            <TouchableOpacity
              onPress={() => setActiveTab('register')}
              disabled={isSubmitting}
              style={styles.linkWrap}
            >
              <AppText variant="small" color="primary" style={styles.link}>
                Register as customer
              </AppText>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <AppText variant="small" color="textSecondary" style={styles.dividerText}>
                or
              </AppText>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} activeOpacity={0.85}>
              <Ionicons name="logo-google" size={20} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
              <AppText variant="h4" style={{ color: colors.textSecondary, fontWeight: '500' }}>
                Sign in with Google
              </AppText>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'register' && (
          <View style={styles.formContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Full name"
              placeholderTextColor={colors.textLight}
              value={registerName}
              onChangeText={setRegisterName}
            />

            <TextInput
              style={styles.textInput}
              placeholder="Email"
              placeholderTextColor={colors.textLight}
              value={registerEmail}
              onChangeText={setRegisterEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.phoneContainer}>
              <AppText variant="body" color="textSecondary" style={styles.phonePrefix}>
                +27
              </AppText>
              <TextInput
                style={styles.phoneInputInner}
                placeholder="Phone number"
                placeholderTextColor={colors.textLight}
                value={registerPhone}
                onChangeText={setRegisterPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInputInner}
                placeholder="Password"
                placeholderTextColor={colors.textLight}
                value={registerPassword}
                onChangeText={setRegisterPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInputInner}
                placeholder="Confirm password"
                placeholderTextColor={colors.textLight}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={8}>
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {errorMessage ? (
              <AppText variant="small" color="danger" style={styles.errorText}>
                {errorMessage}
              </AppText>
            ) : null}

            <AppButton
              label={isSubmitting ? 'Registering…' : 'Create account'}
              variant="primary"
              onPress={handleRegister}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    width,
    minHeight: height,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  logo: {
    fontSize: 32,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  activeTab: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  formContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
    paddingRight: spacing.sm,
  },
  passwordInputInner: {
    flex: 1,
    padding: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  eyeBtn: {
    padding: spacing.sm,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  phonePrefix: {
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  phoneInputInner: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  forgot: {
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  linkWrap: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  link: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
});

export default Login;
