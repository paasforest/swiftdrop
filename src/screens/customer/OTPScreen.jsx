import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { postJson } from '../../apiClient';
import { setAuth } from '../../authStore';
import { resetToRoleHome } from '../../navigationHelpers';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppText, AppButton } from '../../components/ui';
import ParcelLogoIcon from '../../components/auth/ParcelLogoIcon';

const { width, height } = Dimensions.get('window');

function maskPhoneTail(phone) {
  if (!phone) return '';
  const d = String(phone).replace(/\D/g, '');
  if (d.length < 4) return 'your number';
  return `•••• ••• ${d.slice(-4)}`;
}

const OTPScreen = ({ navigation, route }) => {
  const phone = route?.params?.phone;

  const [timeRemaining, setTimeRemaining] = useState(600);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [otpFocused, setOtpFocused] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerify = async () => {
    setErrorMessage(null);
    setIsVerifying(true);
    try {
      if (!phone) {
        setErrorMessage('Missing phone number for verification.');
        return;
      }
      if (!otp || otp.length < 4) {
        setErrorMessage('Please enter the 4-digit OTP.');
        return;
      }

      const data = await postJson('/api/auth/verify-phone', {
        phone,
        otp,
      });

      setAuth({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      resetToRoleHome(navigation, data.user);
    } catch (err) {
      setErrorMessage(err.message || 'OTP verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            hitSlop={12}
            accessibilityLabel="Back to sign in"
          >
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <ParcelLogoIcon size={24} color={colors.primary} />
            </View>
            <AppText variant="h2" color="primary" style={styles.logoText}>
              SwiftDrop
            </AppText>
          </View>

          <AppText variant="h3" color="textPrimary" style={styles.screenTitle}>
            Verify your phone
          </AppText>
          <AppText variant="small" color="textSecondary" style={styles.screenSub}>
            Code sent to {maskPhoneTail(phone)}
          </AppText>

          <View style={styles.infoBox}>
            <AppText variant="body" color="primary" style={styles.infoText}>
              Enter the 4-digit code we sent by SMS.
            </AppText>
          </View>

          <AppText variant="small" color="textSecondary" style={styles.fieldLabel}>
            Verification code
          </AppText>
          <View
            style={[
              styles.otpField,
              { borderColor: otpFocused ? colors.primary : colors.border },
            ]}
          >
            <TextInput
              style={styles.otpInput}
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="0 0 0 0"
              placeholderTextColor={colors.textLight}
              editable={!isVerifying && timeRemaining > 0}
              maxLength={4}
              onFocus={() => setOtpFocused(true)}
              onBlur={() => setOtpFocused(false)}
              textAlign="center"
              selectionColor={colors.primary}
            />
          </View>

          <Text style={styles.expiryText}>
            {timeRemaining > 0
              ? `Code expires in ${formatTime(timeRemaining)}`
              : 'Code expired — go back and request a new one'}
          </Text>

          {errorMessage ? (
            <AppText variant="small" color="danger" style={styles.errorText}>
              {errorMessage}
            </AppText>
          ) : null}

          <AppButton
            label="Confirm OTP"
            onPress={handleVerify}
            variant="primary"
            loading={isVerifying}
            disabled={isVerifying || timeRemaining <= 0}
          />

          <TouchableOpacity
            style={styles.resendHint}
            onPress={() => navigation.navigate('Login')}
            disabled={isVerifying}
          >
            <AppText variant="small" color="primary" style={styles.resendHintText}>
              Wrong number? Go back
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
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
  screenTitle: {
    textAlign: 'center',
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  screenSub: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  infoBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(26, 115, 232, 0.12)',
  },
  infoText: {
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  fieldLabel: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  otpField: {
    width: '100%',
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    justifyContent: 'center',
    ...shadows.card,
    shadowOpacity: 0.06,
    elevation: 1,
  },
  otpInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  expiryText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  resendHint: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendHintText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default OTPScreen;
