import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { postJson } from '../../apiClient';
import { setAuth } from '../../authStore';

const { width, height } = Dimensions.get('window');

const DriverOTPScreen = ({ navigation, route }) => {
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

      // IMPORTANT: return to DriverRegister flow (do NOT route to DriverHome yet).
      navigation.goBack();
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

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Enter the 4-digit code we sent to your phone.
          </Text>
        </View>

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

        <Text style={styles.expiryText}>
          This code expires in {formatTime(timeRemaining)}
        </Text>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.confirmButton, isVerifying && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={isVerifying || timeRemaining <= 0}
        >
          <Text style={styles.confirmButtonText}>
            {isVerifying ? 'Verifying...' : 'Confirm OTP'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width,
    height,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 40,
  },
  infoBox: {
    backgroundColor: '#E8F4FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
    width: '100%',
  },
  infoText: {
    fontSize: 16,
    color: '#1A73E8',
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
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 22,
    textAlign: 'center',
  },
  expiryText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 40,
  },
  errorText: {
    color: '#d93025',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DriverOTPScreen;

