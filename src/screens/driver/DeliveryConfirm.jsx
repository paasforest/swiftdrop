import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../apiConfig';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { colors, spacing, radius, typography, shadows } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

const DeliveryConfirm = ({ navigation, route }) => {
  const orderId = route?.params?.orderId;

  // Step 1: driver marks arrival at delivery -> triggers push + (backend) SMS.
  const [arrivalMarked, setArrivalMarked] = useState(false);
  const [markingArrival, setMarkingArrival] = useState(true);
  const [arrivalError, setArrivalError] = useState(null);
  const [arrivalRetryKey, setArrivalRetryKey] = useState(0);

  // Step 2: delivery OTP entry
  const [otp, setOtp] = useState(['', '', '', '']);
  const otpString = useMemo(() => otp.join(''), [otp]);
  const [otpConfirmed, setOtpConfirmed] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const inputRefs = useRef([]);

  // Step 3: mandatory delivery photo upload
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [photoAsset, setPhotoAsset] = useState(null); // { uri, type, fileName }
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0..1
  const [uploadError, setUploadError] = useState(null);

  const [deliveryComplete, setDeliveryComplete] = useState(false);
  const [order, setOrder] = useState(null);
  const [orderLoaded, setOrderLoaded] = useState(false);

  const markArrivedAtDelivery = async () => {
    if (!orderId) throw new Error('Missing orderId');
    const auth = getAuth();
    if (!auth?.token) throw new Error('Not signed in');

    setMarkingArrival(true);
    setArrivalError(null);

    const url = `${API_BASE_URL}/api/orders/${orderId}/status`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ status: 'delivery_arrived' }),
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!res.ok) {
      throw new Error(json?.error || json?.message || `Request failed with HTTP ${res.status}`);
    }

    setArrivalMarked(true);
  };

  useEffect(() => {
    let cancelled = false;
    async function loadOrder() {
      if (!orderId) return;
      const auth = getAuth();
      if (!auth?.token) {
        if (!cancelled) setOrderLoaded(true);
        return;
      }
      try {
        const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        if (cancelled) return;
        setOrder(data);
        if (data?.status === 'delivery_arrived') {
          setArrivalMarked(true);
          setArrivalError(null);
          setMarkingArrival(false);
        }
      } catch {
        // Earnings is best-effort.
      } finally {
        if (!cancelled) setOrderLoaded(true);
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!orderId) return;
      if (arrivalMarked) return;
      if (!orderLoaded) return;

      try {
        await markArrivedAtDelivery();
        if (cancelled) return;
      } catch (e) {
        if (cancelled) return;
        setArrivalError(e.message || 'Failed to mark arrival');
      } finally {
        if (!cancelled) setMarkingArrival(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, arrivalRetryKey, arrivalMarked, orderLoaded]);

  const handleOtpChange = (value, index) => {
    const digit = String(value ?? '')
      .replace(/[^\d]/g, '')
      .slice(-1); // keep last digit only
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirmOtp = async () => {
    if (!orderId) return;
    if (otpString.length !== 4) return;
    if (otpSubmitting) return;

    setOtpSubmitting(true);
    setOtpError(null);

    try {
      const auth = getAuth();
      if (!auth?.token) throw new Error('Not signed in');

      await postJson(`/api/orders/${orderId}/delivery-otp`, { otp: otpString }, { token: auth.token });
      setOtpConfirmed(true);
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('Invalid OTP')) {
        setOtpError('Incorrect code. Ask receiver to check their SMS.');
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
        fileName: asset.fileName || `delivery-${Date.now()}.jpg`,
      });
    } catch (e) {
      setUploadError(e?.message || 'Failed to capture photo');
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleRetakePhoto = () => {
    setPhotoAsset(null);
    setUploadError(null);
    setUploadProgress(0);
  };

  const handleUploadDeliveryPhoto = async () => {
    if (!orderId || !photoAsset) return;
    if (uploading) return;

    const auth = getAuth();
    if (!auth?.token) throw new Error('Not signed in');

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const url = `${API_BASE_URL}/api/orders/${orderId}/delivery-photo`;

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

        xhr.onerror = () => reject(new Error('Upload failed'));

        xhr.send(formData);
      });

      setDeliveryComplete(true);
    } catch (e) {
      setUploadError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!deliveryComplete) return;
    const t = setTimeout(() => {
      navigation.navigate('DriverHome');
    }, 3000);
    return () => clearTimeout(t);
  }, [deliveryComplete, navigation]);

  const earnings = order?.driver_earnings ?? null;

  const renderOtpStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>1 of 2</Text>
        <Text style={styles.stepTitle}>Enter receiver OTP</Text>
      </View>

      <Text style={styles.instructionText}>
        Ask the receiver to provide their 4-digit confirmation code
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
          (otpString.length !== 4 || otpSubmitting) && styles.confirmButtonDisabled
        ]}
        onPress={handleConfirmOtp}
        disabled={otpString.length !== 4 || otpSubmitting}
      >
        <Text style={styles.confirmButtonText}>{otpSubmitting ? 'Verifying...' : 'Confirm OTP'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPhotoStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>2 of 2</Text>
        <Text style={styles.stepTitle}>Take Delivery Photo</Text>
      </View>

      <Text style={styles.instructionText}>
        Take a clear photo of the parcel at the door/delivery point
      </Text>

      {/* Success tick unlocks the mandatory photo step */}
      <View style={styles.successRow}>
        <Text style={styles.successTick}>✓</Text>
        <Text style={styles.successText}>OTP verified. Photo upload required.</Text>
      </View>

      {/* Camera Area */}
      <View style={styles.cameraContainer}>
        {!photoAsset ? (
          <TouchableOpacity style={styles.cameraButton} onPress={handleTakePhoto} disabled={capturingPhoto || uploading}>
            <View style={styles.cameraInner}>
              <Ionicons name="camera-outline" size={48} color={colors.primary} style={styles.cameraIcon} />
              <Text style={styles.cameraText}>{capturingPhoto ? 'Capturing...' : 'Tap to capture delivery photo'}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photoAsset.uri }} style={styles.previewImage} resizeMode="cover" />
            <Text style={styles.photoText}>Delivery photo captured</Text>

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
                <TouchableOpacity style={[styles.usePhotoButton, { flex: 1 }]} onPress={handleUploadDeliveryPhoto} disabled={uploading}>
                  <Text style={styles.usePhotoButtonText}>Use This Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );

  const renderSuccessScreen = () => (
    <View style={styles.successContainer}>
      {/* Success Animation */}
      <View style={styles.successCircle}>
        <Text style={styles.checkmark}>✓</Text>
      </View>

      {/* Success Message */}
      <Text style={styles.successTitle}>Delivery Complete!</Text>
      <Text style={styles.successSubtitle}>
        Great job! The parcel has been successfully delivered.
      </Text>

      {/* Earnings Card */}
      <View style={styles.earningsCard}>
        <Text style={styles.earningsLabel}>You earned</Text>
        <Text style={styles.earningsAmount}>
          {earnings != null ? `R${Number(earnings).toFixed(0)}` : 'R--'}
        </Text>
        <Text style={styles.earningsSubtext}>Added to your pending payout</Text>
      </View>
      <Text style={styles.successHint}>Going back to Driver Home...</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      {!deliveryComplete && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirm Delivery</Text>
          <View style={styles.placeholder} />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {!arrivalMarked ? (
          <View style={styles.stepContainer}>
            {markingArrival ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.hintText}>Marking you as arrived at delivery...</Text>
              </>
            ) : (
              <>
                <Text style={styles.errorText}>{arrivalError || 'Could not start delivery confirmation'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => setArrivalRetryKey((k) => k + 1)}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : !otpConfirmed && !deliveryComplete ? (
          renderOtpStep()
        ) : otpConfirmed && !deliveryComplete ? (
          renderPhotoStep()
        ) : (
          deliveryComplete && renderSuccessScreen()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.textWhite,
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
    color: colors.primary,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
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
    width: 60,
    height: 60,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginHorizontal: 8,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
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
  nextStepPreview: {
    marginTop: 20,
  },
  lockedStep: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    opacity: 0.6,
  },
  lockedStepNumber: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 4,
  },
  lockedStepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
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
    color: colors.textLight,
  },
  cameraContainer: {
    marginBottom: 32,
  },
  cameraButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
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
    color: colors.textSecondary,
  },
  photoPreview: {
    backgroundColor: colors.background,
    borderRadius: 12,
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
  completeButton: {
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingTop: 60,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmark: {
    fontSize: 40,
    color: colors.textWhite,
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  earningsCard: {
    backgroundColor: colors.accentLight,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  earningsLabel: {
    fontSize: 16,
    color: colors.accent,
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
  },
  earningsSubtext: {
    fontSize: 14,
    color: colors.accent,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
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
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTick: {
    color: colors.success,
    fontSize: 28,
    marginRight: 10,
    fontWeight: '700',
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
  successHint: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default DeliveryConfirm;
