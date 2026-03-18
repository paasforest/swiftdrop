import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const OTPScreen = () => {
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [codeConfirmed, setCodeConfirmed] = useState(false);

  const otpCode = '7429';
  const driverInfo = {
    name: 'Sipho M.',
    photo: '👨‍💼',
    vehicle: 'Toyota Corolla',
    plate: 'CA 123-456'
  };

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

  const handleCodeConfirm = () => {
    setCodeConfirmed(true);
    console.log('Code confirmed - parcel collected');
  };

  const renderOTPDigit = (digit, index) => (
    <View key={index} style={styles.otpDigit}>
      <Text style={styles.otpDigitText}>{digit}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>Driver Has Arrived</Text>

        {/* Driver Illustration */}
        <View style={styles.illustrationContainer}>
          <Text style={styles.illustration}>🚚🚪</Text>
        </View>

        {/* OTP Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Read this code to your driver to confirm pickup
          </Text>
        </View>

        {/* OTP Display */}
        <View style={styles.otpContainer}>
          {otpCode.split('').map((digit, index) => renderOTPDigit(digit, index))}
        </View>

        {/* Expiry Notice */}
        <Text style={styles.expiryText}>
          This code expires in {formatTime(timeRemaining)}
        </Text>

        {/* Driver Details Card */}
        <View style={styles.driverCard}>
          <View style={styles.driverHeader}>
            <View style={styles.driverPhoto}>
              <Text style={styles.driverAvatar}>{driverInfo.photo}</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverInfo.name}</Text>
              <Text style={styles.driverVehicle}>
                {driverInfo.vehicle} • {driverInfo.plate}
              </Text>
            </View>
          </View>
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          style={[
            styles.confirmButton,
            codeConfirmed && styles.confirmButtonPressed
          ]}
          onPress={handleCodeConfirm}
          disabled={codeConfirmed}
        >
          <Text style={styles.confirmButtonText}>
            {codeConfirmed ? '✓ Code Confirmed' : 'Code Confirmed — Parcel Collected'}
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
    width: width,
    height: height,
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
  illustrationContainer: {
    marginBottom: 40,
  },
  illustration: {
    fontSize: 80,
    textAlign: 'center',
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  otpDigit: {
    width: 60,
    height: 60,
    backgroundColor: '#E8F4FF',
    borderWidth: 2,
    borderColor: '#1A73E8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  otpDigitText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A73E8',
  },
  expiryText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 40,
  },
  driverCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  driverAvatar: {
    fontSize: 24,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  driverVehicle: {
    fontSize: 14,
    color: '#666666',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  confirmButtonPressed: {
    backgroundColor: '#45A049',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OTPScreen;
