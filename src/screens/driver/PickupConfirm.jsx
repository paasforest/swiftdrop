import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { API_BASE_URL } from '../../apiConfig';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';

const { width, height } = Dimensions.get('window');

const PickupConfirm = ({ navigation, route }) => {
  const orderId = route?.params?.orderId;

  const [arrivalMarked, setArrivalMarked] = useState(false);
  const [markingArrival, setMarkingArrival] = useState(true);
  const [arrivalError, setArrivalError] = useState(null);
  const [arrivalRetryKey, setArrivalRetryKey] = useState(0);
  const [order, setOrder] = useState(null);
  const [orderLoaded, setOrderLoaded] = useState(false);

  const [otp, setOtp] = useState(['', '', '', '']);
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
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const markArrivedAtPickup = async () => {
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
      body: JSON.stringify({ status: 'pickup_arrived' }),
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
        setOrderLoaded(true);
        return;
      }
      try {
        const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        if (cancelled) return;
        setOrder(data);
        if (data?.status === 'pickup_arrived') {
          setArrivalMarked(true);
          setArrivalError(null);
          setMarkingArrival(false);
        }
      } catch {
        // Best-effort; if it fails we still allow marking arrival normally.
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
        await markArrivedAtPickup();
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

  const handleConfirmOtp = async () => {
    if (!orderId) return;
    if (otpString.length !== 4) return;
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
      if (msg.includes('Invalid OTP')) {
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
        Ask the sender to read you their 4-digit code
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
          (otpString.length !== 4 || otpSubmitting) && styles.confirmButtonDisabled,
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
              <Text style={styles.cameraIcon}>📷</Text>
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
                <ActivityIndicator color="#1A73E8" />
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
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Pickup</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {!arrivalMarked ? (
          <View style={styles.stepContainer}>
            {markingArrival ? (
              <>
                <ActivityIndicator size="large" color="#1A73E8" />
                <Text style={styles.hintText}>Marking you as arrived at pickup...</Text>
              </>
            ) : (
              <>
                <Text style={styles.errorText}>{arrivalError || 'Could not start pickup confirmation'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => setArrivalRetryKey((k) => k + 1)}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : !otpConfirmed ? (
          renderOtpStep()
        ) : (
          renderPhotoStep()
        )}
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
  errorText: {
    marginBottom: 12,
    marginTop: -4,
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  hintText: {
    marginTop: 12,
    textAlign: 'center',
    color: '#666666',
    fontSize: 14,
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
    padding: 12,
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    marginBottom: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  retakeText: {
    fontSize: 14,
    color: '#666666',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTick: {
    color: '#4CAF50',
    fontSize: 28,
    marginRight: 10,
    fontWeight: '700',
  },
  successText: {
    color: '#4CAF50',
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
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 10,
  },
  usePhotoButtonText: {
    color: '#FFFFFF',
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
    color: '#1A73E8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PickupConfirm;
