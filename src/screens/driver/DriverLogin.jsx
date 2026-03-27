import React, { useEffect, useState } from 'react';
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
import { clearAuth, setAuth } from '../../authStore';
import { resetToRoleHome } from '../../navigationHelpers';
import { normalizePhoneForApi, stripInvisible } from '../../utils/saPhoneNormalize';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppText, AppButton, AppInput } from '../../components/ui';

const { width, height } = Dimensions.get('window');

export default function DriverLogin({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const phonePrefix = (
    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>+27</Text>
  );

  useEffect(() => {
    void clearAuth();
  }, []);

  const handleLogin = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const phoneNorm = normalizePhoneForApi(phone);
      const pwd = stripInvisible(password).trim();
      if (!phoneNorm || !pwd) {
        setErrorMessage('Phone number and password are required.');
        return;
      }

      const data = await postJson('/api/auth/login', {
        phone: phoneNorm,
        password: pwd,
      }, { skipAuthRetry: true, omitAuthToken: true });

      setAuth({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      resetToRoleHome(navigation, data.user);
    } catch (err) {
      if (err.code === 'PHONE_NOT_VERIFIED') {
        setErrorMessage(
          'Verify your phone with the SMS code from registration, then sign in again.'
        );
      } else if (err.status === 403) {
        setErrorMessage(
          err.message ||
            'Your driver application is still under review. You can sign in once an admin approves your account.'
        );
      } else if (err.status === 401 && err.message === 'Invalid credentials') {
        setErrorMessage(
          'Incorrect phone or password. Use the same number you registered with (e.g. 071… next to +27). If you just registered, your account may still be pending approval — try again after approval.'
        );
      } else {
        setErrorMessage(err.message || 'Login failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async () => {
    const phoneNorm = normalizePhoneForApi(forgotPhone);
    if (!phoneNorm) {
      setErrorMessage('Enter a valid South African phone number.');
      return;
    }
    setForgotBusy(true);
    try {
      await postJson('/api/auth/forgot-password', { phone: phoneNorm }, { skipAuthRetry: true, omitAuthToken: true });
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.accent} />
          </TouchableOpacity>
          <View style={styles.headerMid}>
            <View style={styles.iconMark}>
              <Ionicons name="car-sport" size={22} color={colors.accent} />
            </View>
            <AppText variant="h2" style={{ color: colors.accent, fontWeight: '800' }}>
              Driver portal
            </AppText>
            <AppText variant="small" color="textSecondary" style={styles.subtitle}>
              Sign in to start earning
            </AppText>
          </View>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.formContainer}>
          <AppInput
            accent="accent"
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="82 123 4567"
            keyboardType="phone-pad"
            prefix={phonePrefix}
          />

          <AppInput
            accent="accent"
            label="Password"
            value={password}
            onChangeText={setPassword}
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
            <Text style={styles.forgot}>Forgot password?</Text>
          </TouchableOpacity>

          {errorMessage ? (
            <AppText variant="small" color="danger" style={styles.errorText}>
              {errorMessage}
            </AppText>
          ) : null}

          <AppButton
            label={isSubmitting ? 'Signing in…' : 'Sign in'}
            variant="accent"
            onPress={handleLogin}
            loading={isSubmitting}
            disabled={isSubmitting}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('DriverRegister')}
            style={styles.linkWrap}
          >
            <Text style={styles.footerPrompt}>
              New driver?{' '}
              <Text style={styles.footerLink}>Register here</Text>
            </Text>
          </TouchableOpacity>
        </View>
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
              accent="accent"
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
                variant="accent"
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    width,
    minHeight: height,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  headerMid: {
    flex: 1,
    alignItems: 'center',
  },
  iconMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  forgot: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  linkWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerPrompt: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerLink: {
    color: colors.accent,
    fontWeight: '700',
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
    gap: spacing.sm,
  },
  modalBtn: {
    flex: 1,
  },
});
