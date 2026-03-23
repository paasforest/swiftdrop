import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { postJson } from '../../apiClient';
import { setAuth } from '../../authStore';
import { resetToRoleHome } from '../../navigationHelpers';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppText, AppButton, AppInput } from '../../components/ui';
import ParcelLogoIcon from '../../components/auth/ParcelLogoIcon';

const { width, height } = Dimensions.get('window');

function cleanLoginInput(value) {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .trim();
}

function normalizePhoneForApi(phoneInput) {
  let v = String(phoneInput ?? '').trim();
  v = v.replace(/\s+/g, '');
  if (v.startsWith('+')) v = v.slice(1);
  if (v.startsWith('0')) v = `27${v.slice(1)}`;
  if (v.startsWith('27')) return `+${v}`;
  if (/^[678]\d{8}$/.test(v)) return `+27${v}`;
  return '';
}

function passwordStrengthLabel(pwd) {
  if (!pwd) return { level: 0, label: '', color: colors.border };
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[a-z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  if (score <= 2) return { level: 1, label: 'Weak', color: colors.danger };
  if (score <= 4) return { level: 2, label: 'Medium', color: colors.warning };
  return { level: 3, label: 'Strong', color: colors.success };
}

const Login = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [signInPhone, setSignInPhone] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const strength = useMemo(() => passwordStrengthLabel(registerPassword), [registerPassword]);

  const handleLogin = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const phone = normalizePhoneForApi(signInPhone);
      const password = cleanLoginInput(signInPassword);
      if (!phone || !password) {
        setErrorMessage('Phone number and password are required.');
        return;
      }

      const data = await postJson('/api/auth/login', {
        phone,
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

  const handleForgotSubmit = async () => {
    const phone = normalizePhoneForApi(forgotPhone);
    if (!phone) {
      setErrorMessage('Enter a valid South African phone number.');
      return;
    }
    setForgotBusy(true);
    try {
      await postJson('/api/auth/forgot-password', { phone });
      setForgotModalVisible(false);
      setForgotPhone('');
      setErrorMessage(null);
      alert('OTP sent to your phone');
    } catch (e) {
      alert(e.message || 'Request failed');
    } finally {
      setForgotBusy(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (!registerName || !registerPhone || !registerPassword || !confirmPassword) {
        setErrorMessage('Please fill in all required fields.');
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

      const body = {
        full_name: registerName,
        phone,
        password: registerPassword,
      };
      if (registerEmail.trim()) {
        body.email = registerEmail.trim();
      }

      const data = await postJson('/api/auth/register-customer', body);

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

  const phonePrefix = (
    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>+27</Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Welcome')}
          hitSlop={12}
          accessibilityLabel="Back to welcome"
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <ParcelLogoIcon size={24} color={colors.primary} />
          </View>
          <AppText variant="h2" color="primary" style={styles.logoText}>
            SwiftDrop
          </AppText>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'signin' && styles.activeTab]}
            onPress={() => setActiveTab('signin')}
          >
            <AppText
              variant="h4"
              color={activeTab === 'signin' ? 'primary' : 'textSecondary'}
              style={{ fontWeight: activeTab === 'signin' ? '600' : '500' }}
            >
              Sign in
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
              Create account
            </AppText>
          </TouchableOpacity>
        </View>

        {activeTab === 'signin' && (
          <View style={styles.formContainer}>
            <AppInput
              label="Phone number"
              value={signInPhone}
              onChangeText={setSignInPhone}
              placeholder="82 123 4567"
              keyboardType="phone-pad"
              prefix={phonePrefix}
            />

            <AppInput
              label="Password"
              value={signInPassword}
              onChangeText={setSignInPassword}
              placeholder="Password"
              secureTextEntry={!showPassword}
              rightAccessory={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />

            <TouchableOpacity
              style={styles.forgotWrap}
              onPress={() => {
                setForgotPhone('');
                setForgotModalVisible(true);
              }}
            >
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
              label={isSubmitting ? 'Signing in…' : 'Sign in'}
              variant="primary"
              onPress={handleLogin}
              loading={isSubmitting}
              disabled={isSubmitting}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              onPress={() => setActiveTab('register')}
              disabled={isSubmitting}
              style={styles.linkWrap}
            >
              <Text style={styles.footerPrompt}>
                New to SwiftDrop?{' '}
                <Text style={styles.footerLink}>Create account</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'register' && (
          <View style={styles.formContainer}>
            <AppInput
              label="Full name"
              value={registerName}
              onChangeText={setRegisterName}
              placeholder="Your name"
            />

            <AppInput
              label="Phone number"
              value={registerPhone}
              onChangeText={setRegisterPhone}
              placeholder="82 123 4567"
              keyboardType="phone-pad"
              prefix={phonePrefix}
            />

            <AppInput
              label="Email (optional)"
              value={registerEmail}
              onChangeText={setRegisterEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View>
              <AppInput
                label="Password"
                value={registerPassword}
                onChangeText={setRegisterPassword}
                placeholder="Password"
                secureTextEntry={!showPassword}
                rightAccessory={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                }
              />
              {registerPassword ? (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthTrack}>
                    <View
                      style={[
                        styles.strengthFill,
                        {
                          width: `${(strength.level / 3) * 100}%`,
                          backgroundColor: strength.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              ) : null}
            </View>

            <AppInput
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              secureTextEntry={!showConfirmPassword}
              rightAccessory={
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={8}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />

            {errorMessage ? (
              <AppText variant="small" color="danger" style={styles.errorText}>
                {errorMessage}
              </AppText>
            ) : null}

            <AppButton
              label={isSubmitting ? 'Creating account…' : 'Create account'}
              variant="primary"
              onPress={handleRegister}
              loading={isSubmitting}
              disabled={isSubmitting}
            />

            <TouchableOpacity
              onPress={() => setActiveTab('signin')}
              disabled={isSubmitting}
              style={styles.linkWrap}
            >
              <Text style={styles.footerPrompt}>
                Already have an account?{' '}
                <Text style={styles.footerLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={forgotModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <AppText variant="h4" color="textPrimary">
              Reset password
            </AppText>
            <AppText variant="small" color="textSecondary" style={{ marginBottom: spacing.md }}>
              Enter your phone number. We&apos;ll send an OTP to reset your password.
            </AppText>
            <AppInput
              label="Phone number"
              value={forgotPhone}
              onChangeText={setForgotPhone}
              placeholder="82 123 4567"
              keyboardType="phone-pad"
              prefix={phonePrefix}
            />
            <View style={styles.modalActions}>
              <AppButton
                label="Cancel"
                variant="outline"
                fullWidth={false}
                onPress={() => setForgotModalVisible(false)}
                disabled={forgotBusy}
                style={styles.modalBtn}
              />
              <AppButton
                label={forgotBusy ? 'Sending…' : 'Send OTP'}
                variant="primary"
                fullWidth={false}
                onPress={handleForgotSubmit}
                loading={forgotBusy}
                disabled={forgotBusy}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  topBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 0,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 24,
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
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  forgot: {
    fontWeight: '600',
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  divider: {
    marginVertical: spacing.lg,
  },
  dividerLine: {
    height: 1,
    backgroundColor: colors.border,
  },
  linkWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerPrompt: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  strengthRow: {
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  strengthTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  strengthFill: {
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    alignItems: 'center',
  },
});

export default Login;
