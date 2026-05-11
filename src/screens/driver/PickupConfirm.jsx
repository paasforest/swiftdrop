import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../apiConfig';
import { getAuth } from '../../authStore';
import { postJson } from '../../apiClient';
import { colors, spacing, radius } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

const ORDER_OTP_DIGITS = 6;

const PickupConfirm = ({ navigation, route }) => {
  const orderId = route?.params?.orderId;

  const [otp, setOtp] = useState(() => Array.from({ length: ORDER_OTP_DIGITS }, () => ''));
  const [otpConfirmed, setOtpConfirmed] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState(null);

  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [photoAsset, setPhotoAsset] = useState(null); // { uri, type, fileName }
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0..1
  const [uploadError, setUploadError] = useState(null);

  const inputRefs = useRef([]);

  const otpString = useMemo(() => otp.join(''), [otp]);

  const handleOtpChange = (value, index) => {
    const digit = String(value ?? '')
      .replace(/[^\d]/g, '')
      .slice(-1); // keep last digit only
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next input
    if (digit && index < ORDER_OTP_DIGITS - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirmOtp = async () => {
    if (!orderId) return;
    if (otpString.length !== ORDER_OTP_DIGITS) return;
    if (otpSubmitting) return;

    setOtpSubmitting(true);
    setOtpError(null);
    try {
      const auth = getAuth();
      if (!auth?.token) throw new Error('Not signed in');

      await postJson(`/api/orders/${orderId}/pickup-otp`, { otp: otpString }, { token: auth.token });
      setOtpConfirmed(true);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('attempts remaining')) {
        setOtpError(msg);
      } else if (msg.includes('Incorrect OTP')) {
        setOtpError('Incorrect code. Ask sender to check their SMS.');
      } else if (msg.includes('Too many incorrect attempts')) {
        setOtpError(msg);
      } else if (msg.includes('Invalid OTP')) {
        setOtpError('Incorrect code. Ask sender to check their SMS.');
      } else {
        setOtpError(msg || 'OTP verification failed');
      }
    } finally {
      setOtpSubmitting(false);
    }
  };

  const ensureCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission?.granted) {
      throw new Error('Camera permission is required');
    }
  };

  const handleTakePhoto = async () => {
    if (capturingPhoto || uploading) return;
    setUploadError(null);
    setOtpError(null);

    try {
      setCapturingPhoto(true);
      await ensureCameraPermission();

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error('No photo captured');

      setPhotoAsset({
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        fileName: asset.fileName || `pickup-${Date.now()}.jpg`,
      });
    } catch (e) {
      setUploadError(e.message || 'Failed to capture photo');
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleUploadPickupPhoto = async () => {
    if (!orderId || !photoAsset) return;
    if (uploading) return;

    const auth = getAuth();
    if (!auth?.token) throw new Error('Not signed in');

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const url = `${API_BASE_URL}/api/orders/${orderId}/pickup-photo`;

    try {
      await new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('photo', {
          uri: photoAsset.uri,
          type: photoAsset.type,
          name: photoAsset.fileName,
        });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const p = evt.loaded / evt.total;
            setUploadProgress(p);
          }
        };

        xhr.onload = () => {
          const statusOk = xhr.status >= 200 && xhr.status < 300;
          const text = xhr.responseText || '';
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }

          if (!statusOk) {
            reject(new Error(json?.error || json?.message || `Upload failed with HTTP ${xhr.status}`));
            return;
          }

          resolve(json ?? {});
        };

        xhr.onerror = () => {
          reject(new Error('Upload failed'));
        };

        xhr.send(formData);
      });

      navigation.navigate('EnRouteDelivery', { orderId });
    } catch (e) {
      setUploadError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRetakePhoto = () => {
    setPhotoAsset(null);
    setUploadError(null);
    setUploadProgress(0);
  };

  const renderOtpStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>1 of 2</Text>
        <Text style={styles.stepTitle}>Enter OTP</Text>
      </View>

      <Text style={styles.instructionText}>
        Ask the sender to read you their 6-digit code
      </Text>

      {/* OTP Input */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
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

      {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

      <TouchableOpacity
        style={[
          styles.confirmButton,
          (otpString.length !== ORDER_OTP_DIGITS || otpSubmitting) && styles.confirmButtonDisabled,
        ]}
        onPress={handleConfirmOtp}
        disabled={otpString.length !== ORDER_OTP_DIGITS || otpSubmitting}
      >
        <Text style={styles.confirmButtonText}>{otpSubmitting ? 'Verifying...' : 'Confirm OTP'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPhotoStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>2 of 2</Text>
        <Text style={styles.stepTitle}>Take Parcel Photo</Text>
      </View>

      <Text style={styles.instructionText}>Take a clear photo of the parcel before you leave</Text>

      <View style={styles.successRow}>
        <Text style={styles.successTick}>✓</Text>
        <Text style={styles.successText}>OTP verified. Photo upload required.</Text>
      </View>

      {/* Camera Area */}
      <View style={styles.cameraContainer}>
        {!photoAsset ? (
          <TouchableOpacity style={styles.cameraButton} onPress={handleTakePhoto} disabled={capturingPhoto || uploading}>
            <View style={styles.cameraInner}>
              <Ionicons name="camera-outline" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
              <Text style={styles.cameraText}>{capturingPhoto ? 'Capturing...' : 'Tap to capture'}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photoAsset.uri }} style={styles.previewImage} resizeMode="cover" />
            <Text style={styles.photoText}>Photo captured</Text>

            {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}

            {uploading ? (
              <View style={styles.progressBlock}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.progressText}>{`Uploading ${Math.round(uploadProgress * 100)}%`}</Text>
              </View>
            ) : (
              <View style={styles.photoButtonRow}>
                <TouchableOpacity style={[styles.retakeButton, { flex: 1 }]} onPress={handleRetakePhoto} disabled={uploading}>
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.usePhotoButton, { flex: 1 }]}
                  onPress={handleUploadPickupPhoto}
                  disabled={uploading}
                >
                  <Text style={styles.usePhotoButtonText}>Use This Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Pickup</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {!otpConfirmed ? renderOtpStep() : renderPhotoStep()}
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 28,
  },
  stepContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepNumber: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  instructionText: {
    fontSize: 16,
    color: colors.textSecondary,
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
    width: 46,
    height: 56,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginHorizontal: 4,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: 32,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.border,
  },
  confirmButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    marginBottom: 12,
    marginTop: -4,
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  hintText: {
    marginTop: 12,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    marginBottom: 32,
  },
  cameraButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraInner: {
    alignItems: 'center',
  },
  cameraText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  photoPreview: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  photoIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  photoText: {
    fontSize: 16,
    color: colors.success,
    fontWeight: '500',
    marginBottom: 16,
  },
  retakeButton: {
    backgroundColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  retakeText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  photoButtonRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 6,
  },
  usePhotoButton: {
    backgroundColor: colors.success,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 10,
  },
  usePhotoButtonText: {
    color: colors.textWhite,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressBlock: {
    marginTop: 8,
    alignItems: 'center',
  },
  progressText: {
    marginTop: 8,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PickupConfirm;
