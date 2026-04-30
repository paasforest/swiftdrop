import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { postJson } from '../../apiClient';
import { setAuth } from '../../authStore';

const DriverOTPScreen = ({ navigation, route }) => {
  const phone = route?.params?.phone;

  const [timeRemaining, setTimeRemaining] = useState(600);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

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

  const handleDigitChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const arr = Array.from({ length: 4 }, (_, i) => otp[i] || '');
    arr[index] = digit;
    setOtp(arr.join(''));
    if (digit && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && index > 0 && !otp[index]) {
      const arr = Array.from({ length: 4 }, (_, i) => otp[i] || '');
      arr[index - 1] = '';
      setOtp(arr.join(''));
      inputRefs[index - 1].current?.focus();
    }
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

      const data = await postJson('/api/auth/verify-phone', { phone, otp });

      setAuth({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      // IMPORTANT: return to DriverRegister flow (do NOT route to DriverHome yet).
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err.message || 'OTP verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = () => {
    setTimeRemaining(600);
    setOtp('');
    setErrorMessage(null);
    inputRefs[0].current?.focus();
  };

  const canVerify = otp.length === 4 && !isVerifying && timeRemaining > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top section */}
      <View style={styles.topSection}>
        <View style={styles.otpIconCircle}>
          <Text style={styles.otpIcon}>💬</Text>
        </View>
        <Text style={styles.otpTitle}>Verify your number</Text>
        <Text style={styles.otpSubtitle}>
          Enter the code sent to {phone || 'your phone'}
        </Text>
      </View>

      {/* OTP boxes */}
      <View style={styles.otpBoxRow}>
        {[0, 1, 2, 3].map((index) => (
          <TextInput
            key={index}
            ref={inputRefs[index]}
            style={[
              styles.otpBox,
              otp[index] ? styles.otpBoxFilled : null,
            ]}
            value={otp[index] || ''}
            onChangeText={(text) => handleDigitChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            editable={!isVerifying && timeRemaining > 0}
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Timer */}
      <Text style={styles.timerText}>
        {timeRemaining > 0
          ? `Code expires in ${formatTime(timeRemaining)}`
          : 'Code has expired'}
      </Text>

      {/* Error */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {/* Verify button */}
      <View style={styles.buttonWrap}>
        <TouchableOpacity
          style={[styles.verifyButton, !canVerify && { opacity: 0.4 }]}
          onPress={handleVerify}
          disabled={!canVerify}
        >
          {isVerifying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Resend */}
      <TouchableOpacity
        style={styles.resendWrap}
        onPress={handleResend}
        disabled={timeRemaining > 0}
      >
        <Text
          style={[
            styles.resendText,
            timeRemaining === 0 && styles.resendTextReady,
          ]}
        >
          {timeRemaining > 0
            ? `Resend code in ${formatTime(timeRemaining)}`
            : 'Resend code'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  otpIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  otpIcon: { fontSize: 32 },
  otpTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
  },
  otpBoxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 24,
  },
  otpBox: {
    width: 64,
    height: 72,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
  },
  otpBoxFilled: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  timerText: {
    fontSize: 14,
    color: '#BDBDBD',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  buttonWrap: {
    marginBottom: 20,
  },
  verifyButton: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  resendTextReady: {
    color: '#000000',
    fontWeight: '600',
  },
});

export default DriverOTPScreen;
