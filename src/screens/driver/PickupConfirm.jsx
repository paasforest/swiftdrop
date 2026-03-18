import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, TextInput, ScrollView } from 'react-native';

const { width, height } = Dimensions.get('window');

const PickupConfirm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpConfirmed, setOtpConfirmed] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);

  const inputRefs = [];

  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs[index + 1].focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].focus();
    }
  };

  const handleConfirmOtp = () => {
    const otpString = otp.join('');
    if (otpString.length === 4) {
      setOtpConfirmed(true);
      console.log('OTP confirmed:', otpString);
    }
  };

  const handleTakePhoto = () => {
    setPhotoTaken(true);
    console.log('Photo taken');
  };

  const handleConfirmDelivery = () => {
    console.log('Pickup confirmed, starting delivery');
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      if (currentStep === 2) {
        setOtpConfirmed(false);
      }
    } else {
      console.log('Back to navigation');
    }
  };

  const renderOtpStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>1 of 2</Text>
        <Text style={styles.stepTitle}>Enter OTP</Text>
      </View>

      <Text style={styles.instructionText}>
        Ask the sender to read you their 4-digit code
      </Text>

      {/* OTP Input */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs[index] = ref)}
            style={styles.otpInput}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={(e) => handleOtpKeyPress(e, index)}
            keyboardType="numeric"
            maxLength={1}
            textAlign="center"
            secureTextEntry={false}
            autoFocus={index === 0}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.confirmButton,
          otp.join('').length !== 4 && styles.confirmButtonDisabled
        ]}
        onPress={handleConfirmOtp}
        disabled={otp.join('').length !== 4}
      >
        <Text style={styles.confirmButtonText}>Confirm OTP</Text>
      </TouchableOpacity>

      {/* Next Step Preview */}
      <View style={styles.nextStepPreview}>
        <View style={styles.lockedStep}>
          <Text style={styles.lockedStepNumber}>2 of 2</Text>
          <Text style={styles.lockedStepTitle}>Take Parcel Photo</Text>
          <View style={styles.lockedContent}>
            <Text style={styles.lockedIcon}>📷</Text>
            <Text style={styles.lockedText}>Take a clear photo of the parcel before you leave</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderPhotoStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>2 of 2</Text>
        <Text style={styles.stepTitle}>Take Parcel Photo</Text>
      </View>

      <Text style={styles.instructionText}>
        Take a clear photo of the parcel before you leave
      </Text>

      {/* Camera Area */}
      <View style={styles.cameraContainer}>
        {photoTaken ? (
          <View style={styles.photoPreview}>
            <Text style={styles.photoIcon}>📦</Text>
            <Text style={styles.photoText}>Photo captured</Text>
            <TouchableOpacity style={styles.retakeButton} onPress={() => setPhotoTaken(false)}>
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraButton} onPress={handleTakePhoto}>
            <View style={styles.cameraInner}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.cameraText}>Tap to capture</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {photoTaken && (
        <TouchableOpacity style={styles.finalConfirmButton} onPress={handleConfirmDelivery}>
          <Text style={styles.finalConfirmButtonText}>Confirm & Start Delivery</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Pickup</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Step 1 - OTP */}
        {!otpConfirmed && renderOtpStep()}

        {/* Step 2 - Photo */}
        {otpConfirmed && renderPhotoStep()}
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backArrow: {
    fontSize: 24,
    color: '#1A73E8',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 24,
  },
  stepContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepNumber: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  instructionText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  otpInput: {
    width: 60,
    height: 60,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginHorizontal: 8,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  confirmButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextStepPreview: {
    marginTop: 20,
  },
  lockedStep: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    opacity: 0.6,
  },
  lockedStepNumber: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 4,
  },
  lockedStepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999999',
    textAlign: 'center',
    marginBottom: 16,
  },
  lockedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  lockedText: {
    flex: 1,
    fontSize: 14,
    color: '#999999',
  },
  cameraContainer: {
    marginBottom: 32,
  },
  cameraButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraInner: {
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cameraText: {
    fontSize: 16,
    color: '#666666',
  },
  photoPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  photoText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
    marginBottom: 16,
  },
  retakeButton: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retakeText: {
    fontSize: 14,
    color: '#666666',
  },
  finalConfirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  finalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PickupConfirm;
