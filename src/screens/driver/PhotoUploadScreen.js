import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../../services/firebaseConfig';
import { theme } from '../../theme/theme';

export default function PhotoUploadScreen({ route, navigation }) {
  const { booking, stage } = route.params;
  const bookingId = booking?.bookingId || booking?.id;

  const [photoUri, setPhotoUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const isPickup = stage === 'pickup';
  const stageLabel = isPickup ? 'Take a photo of the parcel' : 'Take a photo of the delivered parcel';

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera required', 'Please allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const proceedAfterPhoto = async (token) => {
    const { postJson } = require('../../apiClient');
    if (isPickup) {
      navigation.replace('NavigateDropoff', { job: booking });
    } else {
      const data = await postJson(`/api/bookings/${bookingId}/complete`, {}, { token });
      const payout = data?.driver_payout ?? booking?.driverPayout ?? booking?.driver_payout;
      navigation.replace('DriverJobComplete', {
        booking: { ...booking, bookingId, driverPayout: payout, driver_payout: payout },
      });
    }
  };

  const handleConfirm = async () => {
    if (!photoUri) return;
    setUploading(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

      const formData = new FormData();
      formData.append('photo', {
        uri: photoUri,
        name: `${stage}_${bookingId}.jpg`,
        type: 'image/jpeg',
      });
      formData.append('stage', stage);

      const { API_BASE_URL } = require('../../apiConfig');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      // Do NOT set Content-Type manually — fetch sets it automatically with the
      // correct multipart boundary when body is FormData. Setting it manually
      // strips the boundary and breaks multer on the backend.
      const res = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/upload-photo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Upload failed (${res.status})`);
      }

      await proceedAfterPhoto(token);
    } catch (err) {
      if (err.name === 'AbortError') {
        Alert.alert('Upload timed out', 'The photo upload took too long. Please try again.');
      } else {
        Alert.alert('Upload failed', err.message || 'Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSkipDev = async () => {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      await proceedAfterPhoto(token);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Photo proof</Text>
      <Text style={styles.subtitle}>{stageLabel}</Text>

      {/* Camera area */}
      <TouchableOpacity
        style={styles.cameraArea}
        onPress={handleCamera}
        activeOpacity={0.8}
      >
        {photoUri ? (
          <>
            <Image source={{ uri: photoUri }} style={styles.preview} />
            <View style={styles.retakeOverlay}>
              <Text style={styles.retakeText}>Tap to retake</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.cameraIcon}>
              <Text style={styles.cameraIconText}>📷</Text>
            </View>
            <Text style={styles.cameraPrompt}>Tap to open camera</Text>
          </>
        )}
      </TouchableOpacity>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.cta, (!photoUri || uploading) && styles.ctaDisabled]}
        onPress={handleConfirm}
        disabled={!photoUri || uploading}
        activeOpacity={0.85}
      >
        {uploading
          ? <ActivityIndicator color={theme.colors.textLight} />
          : <Text style={styles.ctaText}>Confirm and continue</Text>
        }
      </TouchableOpacity>

      {__DEV__ && (
        <TouchableOpacity style={styles.devBtn} onPress={handleSkipDev}>
          <Text style={styles.devBtnText}>⚡ DEV: Skip photo</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  backArrow: { fontSize: 18, color: theme.colors.text },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 32,
  },

  cameraArea: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceElevated,
  },
  preview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  retakeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,15,0.55)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  retakeText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  cameraIcon: {
    marginBottom: 12,
  },
  cameraIconText: {
    fontSize: 48,
  },
  cameraPrompt: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },

  cta: {
    ...theme.components.ctaButton,
    marginBottom: 12,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { ...theme.components.ctaButtonText },
  devBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 20 },
  devBtnText: { fontSize: 12, fontWeight: '600', color: theme.colors.volt },
});
