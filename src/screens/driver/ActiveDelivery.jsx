import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { launchCameraImageOptions } from '../../utils/cameraPickerOptions';
import polyline from '@mapbox/polyline';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { API_BASE_URL } from '../../apiConfig';
import DriverLocationService from './DriverLocationService';

const { width, height } = Dimensions.get('window');

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const UBER_MAP_STYLE = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f1eb' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fdfcf8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f8c967' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e9bc62' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c9d2d3' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dde9cb' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
];

const ActiveDelivery = ({ navigation, route }) => {
  const { orderId, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = route.params;

  const mapRef = useRef(null);
  const bottomSheetRef = useRef(null);
  const inputRefs = useRef([]);
  const otpScaleRefs = useRef(Array.from({ length: 4 }, () => new Animated.Value(1)));
  const completeScale = useRef(new Animated.Value(0)).current;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('EN_ROUTE_PICKUP');
  const [driverCoords, setDriverCoords] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [eta, setEta] = useState(null);

  // OTP state
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [focusedOtpIndex, setFocusedOtpIndex] = useState(null);

  // Photo state - separate for pickup and delivery
  const [pickupPhoto, setPickupPhoto] = useState(null);
  const [deliveryPhoto, setDeliveryPhoto] = useState(null);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  // Today's earnings state
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [redirectCountdown, setRedirectCountdown] = useState(4);

  const snapPoints = ['25%', '50%', '85%'];

  // Poll order status
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const auth = getAuth();
        if (!auth?.token) return;
        const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        if (!cancelled) {
          setOrder(data);
          setLoading(false);
        }
      } catch (e) {
        console.error('[ActiveDelivery] Poll error:', e);
        if (!cancelled) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId]);

  // Update phase based on order status
  useEffect(() => {
    if (!order) return;

    if (order.status === 'accepted' || order.status === 'pickup_en_route') {
      setPhase('EN_ROUTE_PICKUP');
    } else if (order.status === 'pickup_arrived') {
      setPhase('PICKUP_ARRIVED');
    } else if (order.status === 'collected') {
      setPhase('EN_ROUTE_DELIVERY');
    } else if (order.status === 'delivery_en_route') {
      setPhase('EN_ROUTE_DELIVERY');
    } else if (order.status === 'delivery_arrived') {
      setPhase('DELIVERY_ARRIVED');
    } else if (order.status === 'delivered' || order.status === 'completed') {
      setPhase('COMPLETE');
    }
  }, [order?.status]);

  // Snap bottom sheet based on phase
  useEffect(() => {
    if (!bottomSheetRef.current) return;

    if (phase === 'EN_ROUTE_PICKUP' || phase === 'EN_ROUTE_DELIVERY') {
      bottomSheetRef.current.snapToIndex(0); // Minimize when driving
    } else if (phase === 'PICKUP_ARRIVED' || phase === 'DELIVERY_ARRIVED' || phase === 'PICKUP_PHOTO' || phase === 'DELIVERY_PHOTO') {
      bottomSheetRef.current.snapToIndex(1); // Expand for action
    } else if (phase === 'COMPLETE') {
      bottomSheetRef.current.snapToIndex(2); // Full expand for completion
    }
  }, [phase]);

  // Fetch route from Google Directions API
  useEffect(() => {
    if (!driverCoords) return;

    const fetchRoute = async () => {
      try {
        let origin, destination;

        if (phase === 'EN_ROUTE_PICKUP') {
          origin = `${driverCoords.latitude},${driverCoords.longitude}`;
          destination = `${pickup_lat},${pickup_lng}`;
        } else if (phase === 'EN_ROUTE_DELIVERY') {
          origin = `${driverCoords.latitude},${driverCoords.longitude}`;
          destination = `${dropoff_lat},${dropoff_lng}`;
        } else {
          setRouteCoords([]);
          setEta(null);
          return;
        }

        if (!GOOGLE_MAPS_API_KEY) {
          console.warn('[ActiveDelivery] No Google Maps API key configured');
          return;
        }

        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.routes?.length > 0) {
          const route = data.routes[0];
          const points = polyline.decode(route.overview_polyline.points);
          const coords = points.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
          setRouteCoords(coords);

          const duration = route.legs[0]?.duration_in_traffic?.value || route.legs[0]?.duration?.value;
          if (duration) {
            setEta(Math.round(duration / 60));
          }
        }
      } catch (e) {
        console.error('[ActiveDelivery] Route fetch error:', e);
      }
    };

    fetchRoute();
  }, [driverCoords, phase, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng]);

  // Center map on driver
  useEffect(() => {
    if (!mapRef.current || !driverCoords) return;

    mapRef.current.animateToRegion({
      latitude: driverCoords.latitude,
      longitude: driverCoords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 1000);
  }, [driverCoords]);

  useEffect(() => {
    if (phase !== 'COMPLETE') {
      completeScale.setValue(0);
      setRedirectCountdown(4);
      return;
    }

    Animated.spring(completeScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 60,
    }).start();

    let remaining = 4;
    setRedirectCountdown(remaining);
    const intervalId = setInterval(() => {
      remaining -= 1;
      if (remaining >= 1) {
        setRedirectCountdown(remaining);
      } else {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [phase, completeScale]);

  // Fetch today's earnings when delivery completes
  useEffect(() => {
    if (phase === 'COMPLETE') {
      const fetchTodayEarnings = async () => {
        try {
          const auth = getAuth();
          if (!auth?.token) return;
          const data = await getJson('/api/drivers/earnings/today', { token: auth.token });
          setTodayTotal(data.total || 0);
          setTodayCount(data.count || 0);
        } catch (err) {
          console.error('Failed to fetch today earnings:', err);
        }
      };
      fetchTodayEarnings();
    }
  }, [phase]);

  // Navigate to DriverHome after completion
  useEffect(() => {
    if (phase === 'COMPLETE') {
      const timer = setTimeout(() => {
        // Check if driver is dedicated type - stay online
        const driverType = route.params?.driver_type;
        if (driverType === 'dedicated') {
          navigation.navigate('DriverHome', { stayOnline: true });
        } else {
          navigation.navigate('DriverHome');
        }
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [phase, navigation, route.params]);

  const handleLocationUpdate = useCallback((coords) => {
    setDriverCoords(coords);
  }, []);

  const handleArrivedAtPickup = async () => {
    try {
      const auth = getAuth();
      if (!auth?.token) throw new Error('Not signed in');
      
      const url = `${API_BASE_URL}/api/orders/${orderId}/status`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ status: 'pickup_arrived' }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }
      
      setPhase('PICKUP_ARRIVED');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update status');
    }
  };

  const handleArrivedAtDelivery = async () => {
    try {
      const auth = getAuth();
      if (!auth?.token) throw new Error('Not signed in');
      
      const url = `${API_BASE_URL}/api/orders/${orderId}/status`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ status: 'delivery_arrived' }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }
      
      setPhase('DELIVERY_ARRIVED');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update status');
    }
  };

  // OTP handlers
  const otpString = otp.join('');

  const handleOtpChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const animateOtpScale = (index, toValue) => {
    Animated.spring(otpScaleRefs.current[index], {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 70,
    }).start();
  };

  const handleOtpFocus = (index) => {
    setFocusedOtpIndex(index);
    animateOtpScale(index, 1.04);
  };

  const handleOtpBlur = (index) => {
    setFocusedOtpIndex((current) => (current === index ? null : current));
    animateOtpScale(index, 1);
  };

  const phaseLabel =
    phase === 'EN_ROUTE_PICKUP'
      ? 'Pickup'
      : phase === 'PICKUP_ARRIVED'
        ? 'Pickup verification'
        : phase === 'PICKUP_PHOTO'
          ? 'Pickup photo'
          : phase === 'EN_ROUTE_DELIVERY'
            ? 'Dropoff'
            : phase === 'DELIVERY_ARRIVED'
              ? 'Delivery verification'
              : phase === 'DELIVERY_PHOTO'
                ? 'Delivery photo'
                : 'Completed';

  const handleConfirmPickupOtp = async () => {
    if (otpString.length !== 4 || otpSubmitting) return;
    setOtpSubmitting(true);
    setOtpError(null);
    try {
      const auth = getAuth();
      if (!auth?.token) throw new Error('Not signed in');
      await postJson(`/api/orders/${orderId}/pickup-otp`, { otp: otpString }, { token: auth.token });
      setPhase('PICKUP_PHOTO');
      setOtp(['', '', '', '']);
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

  const handleConfirmDeliveryOtp = async () => {
    if (otpString.length !== 4 || otpSubmitting) return;
    setOtpSubmitting(true);
    setOtpError(null);
    try {
      const auth = getAuth();
      if (!auth?.token) throw new Error('Not signed in');
      await postJson(`/api/orders/${orderId}/delivery-otp`, { otp: otpString }, { token: auth.token });
      setPhase('DELIVERY_PHOTO');
      setOtp(['', '', '', '']);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('Invalid OTP')) {
        setOtpError('Incorrect code. Ask recipient to check their SMS.');
      } else {
        setOtpError(msg || 'OTP verification failed');
      }
    } finally {
      setOtpSubmitting(false);
    }
  };

  // Photo handlers
  const ensureCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission?.granted) {
      throw new Error('Camera permission is required');
    }
  };

  const handleTakePhoto = async (isPickup) => {
    if (capturingPhoto || uploading) return;
    setUploadError(null);
    try {
      setCapturingPhoto(true);
      await ensureCameraPermission();
      const result = await ImagePicker.launchCameraAsync(launchCameraImageOptions);
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error('No photo captured');
      const photoData = {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        fileName: asset.fileName || `photo-${Date.now()}.jpg`,
      };
      if (isPickup) {
        setPickupPhoto(photoData);
      } else {
        setDeliveryPhoto(photoData);
      }
    } catch (e) {
      setUploadError(e.message || 'Failed to capture photo');
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleUploadPickupPhoto = async () => {
    if (!orderId || !pickupPhoto || uploading) return;
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
          uri: pickupPhoto.uri,
          type: pickupPhoto.type,
          name: pickupPhoto.fileName,
        });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setUploadProgress(evt.loaded / evt.total);
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

      setPhase('EN_ROUTE_DELIVERY');
      setPickupPhoto(null);
    } catch (e) {
      setUploadError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadDeliveryPhoto = async () => {
    if (!orderId || !deliveryPhoto || uploading) return;
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
          uri: deliveryPhoto.uri,
          type: deliveryPhoto.type,
          name: deliveryPhoto.fileName,
        });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setUploadProgress(evt.loaded / evt.total);
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

      setPhase('COMPLETE');
      setDeliveryPhoto(null);
    } catch (e) {
      setUploadError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const renderBottomSheetContent = () => {
    if (phase === 'EN_ROUTE_PICKUP') {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.phaseHeaderBlock}>
            <Text style={styles.phaseLabel}>{phaseLabel}</Text>
            <Text style={styles.header}>Head to pickup</Text>
          </View>
          <Text style={styles.address}>{pickup_address}</Text>
          {eta && <View style={styles.etaChip}><Text style={styles.etaText}>⏱ ~{eta} min</Text></View>}
          <TouchableOpacity style={styles.primaryButton} onPress={handleArrivedAtPickup}>
            <Text style={styles.primaryButtonText}>I've arrived at pickup</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'PICKUP_ARRIVED') {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.phaseHeaderBlock}>
            <Text style={styles.phaseLabel}>{phaseLabel}</Text>
            <Text style={styles.header}>Enter pickup OTP</Text>
          </View>
          <Text style={styles.subtext}>Ask the sender for their OTP code</Text>
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <Animated.View
                key={index}
                style={{ transform: [{ scale: otpScaleRefs.current[index] }] }}
              >
                <TextInput
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    styles.otpInput,
                    (focusedOtpIndex === index || digit) && styles.otpInputActive,
                    otpError ? styles.otpInputError : null,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  onFocus={() => handleOtpFocus(index)}
                  onBlur={() => handleOtpBlur(index)}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={index === 0}
                />
              </Animated.View>
            ))}
          </View>
          {otpError && <Text style={styles.errorText}>{otpError}</Text>}
          <TouchableOpacity
            style={[styles.primaryButton, (otpString.length !== 4 || otpSubmitting) && styles.buttonDisabled]}
            onPress={handleConfirmPickupOtp}
            disabled={otpString.length !== 4 || otpSubmitting}
          >
            {otpSubmitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryButtonText}>Confirm OTP</Text>}
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'PICKUP_PHOTO') {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.phaseHeaderBlock}>
            <Text style={styles.phaseLabel}>{phaseLabel}</Text>
            <Text style={styles.header}>Take parcel photo</Text>
          </View>
          <Text style={styles.subtext}>Photo required before proceeding</Text>
          {!pickupPhoto ? (
            <TouchableOpacity style={styles.photoCaptureArea} onPress={() => handleTakePhoto(true)} disabled={capturingPhoto}>
              <Text style={styles.cameraEmoji}>📷</Text>
              <Text style={styles.cameraHintText}>{capturingPhoto ? 'Opening camera...' : 'Tap to take photo'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.photoCaptureArea}>
              <Image source={{ uri: pickupPhoto.uri }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.retakeOverlayButton} onPress={() => setPickupPhoto(null)}>
                <Text style={styles.retakeOverlayText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}
          {pickupPhoto ? (
            <TouchableOpacity
              style={[styles.primaryButton, uploading && styles.buttonDisabled]}
              onPress={handleUploadPickupPhoto}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryButtonText}>Use this photo</Text>}
            </TouchableOpacity>
          ) : null}
          {uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
        </View>
      );
    }

    if (phase === 'EN_ROUTE_DELIVERY') {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.phaseHeaderBlock}>
            <Text style={styles.phaseLabel}>{phaseLabel}</Text>
            <Text style={styles.header}>Head to dropoff</Text>
          </View>
          <Text style={styles.address}>{dropoff_address}</Text>
          {eta && <View style={styles.etaChip}><Text style={styles.etaText}>⏱ ~{eta} min</Text></View>}
          <TouchableOpacity style={styles.primaryButton} onPress={handleArrivedAtDelivery}>
            <Text style={styles.primaryButtonText}>I've arrived at delivery</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'DELIVERY_ARRIVED') {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.phaseHeaderBlock}>
            <Text style={styles.phaseLabel}>{phaseLabel}</Text>
            <Text style={styles.header}>Enter delivery OTP</Text>
          </View>
          <Text style={styles.subtext}>Ask the recipient for their OTP code</Text>
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <Animated.View
                key={index}
                style={{ transform: [{ scale: otpScaleRefs.current[index] }] }}
              >
                <TextInput
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    styles.otpInput,
                    (focusedOtpIndex === index || digit) && styles.otpInputActive,
                    otpError ? styles.otpInputError : null,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  onFocus={() => handleOtpFocus(index)}
                  onBlur={() => handleOtpBlur(index)}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={index === 0}
                />
              </Animated.View>
            ))}
          </View>
          {otpError && <Text style={styles.errorText}>{otpError}</Text>}
          <TouchableOpacity
            style={[styles.primaryButton, (otpString.length !== 4 || otpSubmitting) && styles.buttonDisabled]}
            onPress={handleConfirmDeliveryOtp}
            disabled={otpString.length !== 4 || otpSubmitting}
          >
            {otpSubmitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryButtonText}>Confirm OTP</Text>}
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'DELIVERY_PHOTO') {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.phaseHeaderBlock}>
            <Text style={styles.phaseLabel}>{phaseLabel}</Text>
            <Text style={styles.header}>Take delivery photo</Text>
          </View>
          <Text style={styles.subtext}>Photo required to complete delivery</Text>
          {!deliveryPhoto ? (
            <TouchableOpacity style={styles.photoCaptureArea} onPress={() => handleTakePhoto(false)} disabled={capturingPhoto}>
              <Text style={styles.cameraEmoji}>📷</Text>
              <Text style={styles.cameraHintText}>{capturingPhoto ? 'Opening camera...' : 'Tap to take photo'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.photoCaptureArea}>
              <Image source={{ uri: deliveryPhoto.uri }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.retakeOverlayButton} onPress={() => setDeliveryPhoto(null)}>
                <Text style={styles.retakeOverlayText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}
          {deliveryPhoto ? (
            <TouchableOpacity
              style={[styles.primaryButton, uploading && styles.buttonDisabled]}
              onPress={handleUploadDeliveryPhoto}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryButtonText}>Use this photo</Text>}
            </TouchableOpacity>
          ) : null}
          {uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
        </View>
      );
    }

    if (phase === 'COMPLETE') {
      return (
        <View style={styles.completeSheetContent}>
          <Animated.View style={[styles.completeIcon, { transform: [{ scale: completeScale }] }]}>
            <Text style={styles.checkmark}>✓</Text>
          </Animated.View>
          <Text style={styles.completeHeader}>Delivery Complete!</Text>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>You earned</Text>
            <Text style={styles.earningsAmount}>R{order?.driver_earnings?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.todayEarningsRow}>
            <Text style={styles.todayEarningsText}>
              Today: {todayCount} {todayCount === 1 ? 'delivery' : 'deliveries'} · R{todayTotal.toFixed(2)} earned
            </Text>
          </View>
          <Text style={styles.redirectText}>Returning to home in {redirectCountdown}s...</Text>
        </View>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const initialRegion = driverCoords
    ? {
        latitude: driverCoords.latitude,
        longitude: driverCoords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: Number(pickup_lat),
        longitude: Number(pickup_lng),
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={false}
        customMapStyle={UBER_MAP_STYLE}
      >
        {/* Driver marker */}
        {driverCoords && (
          <Marker
            coordinate={driverCoords}
            title="You"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarkerWrap}>
              <View style={styles.driverMarkerRing} />
              <View style={styles.driverMarker} />
            </View>
          </Marker>
        )}

        {/* Pickup marker */}
        {(phase === 'EN_ROUTE_PICKUP' || phase === 'PICKUP_ARRIVED') && (
          <Marker
            coordinate={{ latitude: Number(pickup_lat), longitude: Number(pickup_lng) }}
            title="Pickup"
            description={pickup_address}
          >
            <View style={styles.pickupMarkerWrap}>
              <View style={styles.pickupMarkerRing} />
              <View style={styles.pickupMarker} />
            </View>
          </Marker>
        )}

        {/* Dropoff marker */}
        {(phase === 'EN_ROUTE_DELIVERY' || phase === 'DELIVERY_ARRIVED' || phase === 'DELIVERY_PHOTO') && (
          <Marker
            coordinate={{ latitude: Number(dropoff_lat), longitude: Number(dropoff_lng) }}
            title="Dropoff"
            description={dropoff_address}
          >
            <View style={styles.dropoffMarker} />
          </Marker>
        )}

        {/* Route polyline */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#000000"
            strokeWidth={4}
            lineCap="round"
          />
        )}
      </MapView>

      <DriverLocationService orderId={orderId} onLocationUpdate={handleLocationUpdate} />

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          {renderBottomSheetContent()}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3EF',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F3EF',
  },
  driverMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  driverMarker: {
    backgroundColor: '#000000',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pickupMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMarkerRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(41,121,255,0.15)',
  },
  pickupMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2979FF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  dropoffMarker: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#000000',
  },
  bottomSheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handleIndicator: {
    backgroundColor: '#E0E0E0',
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingBottom: 44,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  completeSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    alignItems: 'center',
  },
  phaseHeaderBlock: {
    marginBottom: 12,
  },
  phaseLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9E9E9E',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  subtext: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 12,
    lineHeight: 20,
  },
  address: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 0,
    lineHeight: 20,
  },
  etaChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 14,
  },
  etaText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  otpInput: {
    width: 64,
    height: 72,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
    backgroundColor: '#FAFAFA',
  },
  otpInputActive: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  otpInputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
  },
  photoCaptureArea: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    overflow: 'hidden',
  },
  cameraEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  cameraHintText: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
  },
  retakeOverlayButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    margin: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  completeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  checkmark: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  completeHeader: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  earningsCard: {
    backgroundColor: '#F9F9F9',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  earningsLabel: {
    fontSize: 13,
    color: '#9E9E9E',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#000000',
  },
  todayEarningsRow: {
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
  },
  todayEarningsText: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
  },
  redirectText: {
    fontSize: 12,
    color: '#BDBDBD',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default ActiveDelivery;
