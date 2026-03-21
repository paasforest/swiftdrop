import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions, TextInput } from 'react-native';
import { postJson } from '../../apiClient';
import { setAuth } from '../../authStore';
import { resetToRoleHome } from '../../navigationHelpers';
import { colors, spacing, radius, typography } from '../../theme/theme';
import { AppButton } from '../../components/ui';

const { width, height } = Dimensions.get('window');

const OTPScreen = ({ navigation, route }) => {
  const phone = route?.params?.phone;

  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

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
      <View style={styles.content}>
        <Text style={styles.title}>Verify your phone</Text>

        {/* OTP Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Enter the 4-digit code we sent to your phone.
          </Text>
        </View>

        {/* OTP Input */}
        <View style={styles.otpInputRow}>
          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 4))}
            keyboardType="number-pad"
            placeholder="1234"
            editable={!isVerifying && timeRemaining > 0}
            maxLength={4}
          />
        </View>

        {/* Expiry Notice */}
        <Text style={styles.expiryText}>
          This code expires in {formatTime(timeRemaining)}
        </Text>

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <AppButton
          label="Confirm OTP"
          onPress={handleVerify}
          variant="primary"
          loading={isVerifying}
          disabled={isVerifying || timeRemaining <= 0}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    width: width,
    height: height,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 40,
  },
  infoBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 40,
    width: '100%',
  },
  infoText: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
  otpInputRow: {
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  otpInput: {
    width: '60%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    fontSize: 22,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  expiryText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
});

export default OTPScreen;
