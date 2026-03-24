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
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import polyline from '@mapbox/polyline';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { API_BASE_URL } from '../../apiConfig';
import DriverLocationService from './DriverLocationService';

const { width, height } = Dimensions.get('window');

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const ActiveDelivery = ({ navigation, route }) => {
  const { orderId, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = route.params;

  const mapRef = useRef(null);
  const bottomSheetRef = useRef(null);
  const inputRefs = useRef([]);

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
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
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
          <Text style={styles.header}>Head to pickup</Text>
          <Text style={styles.address}>{pickup_address}</Text>
          {eta && <View style={styles.etaChip}><Text style={styles.etaText}>~{eta} min</Text></View>}
          <TouchableOpacity style={styles.primaryButton} onPress={handleArrivedAtPickup}>
            <Text style={styles.primaryButtonText}>I've arrived at pickup</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'PICKUP_ARRIVED') {
      return (
        <View style={styles.sheetContent}>
          <Text style={styles.header}>Enter pickup OTP</Text>
          <Text style={styles.subtext}>Ask the sender for their OTP code</Text>
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
                autoFocus={index === 0}
              />
            ))}
          </View>
          {otpError && <Text style={styles.errorText}>{otpError}</Text>}
          <TouchableOpacity
            style={[styles.primaryButton, (otpString.length !== 4 || otpSubmitting) && styles.buttonDisabled]}
            onPress={handleConfirmPickupOtp}
            disabled={otpString.length !== 4 || otpSubmitting}
          >
            <Text style={styles.primaryButtonText}>{otpSubmitting ? 'Verifying...' : 'Confirm OTP'}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'PICKUP_PHOTO') {
      return (
        <View style={styles.sheetContent}>
          <Text style={styles.header}>Take parcel photo</Text>
          <Text style={styles.subtext}>Photo required before proceeding</Text>
          {!pickupPhoto ? (
            <TouchableOpacity style={styles.cameraButton} onPress={() => handleTakePhoto(true)} disabled={capturingPhoto}>
              <Text style={styles.cameraButtonText}>{capturingPhoto ? 'Opening camera...' : '📷 Take Photo'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Image source={{ uri: pickupPhoto.uri }} style={styles.photoPreview} />
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.retakeButton} onPress={() => setPickupPhoto(null)}>
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.uploadButton, uploading && styles.buttonDisabled]}
                  onPress={handleUploadPickupPhoto}
                  disabled={uploading}
                >
                  <Text style={styles.primaryButtonText}>
                    {uploading ? `Uploading ${Math.round(uploadProgress * 100)}%` : 'Use this photo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          {uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
        </View>
      );
    }

    if (phase === 'EN_ROUTE_DELIVERY') {
      return (
        <View style={styles.sheetContent}>
          <Text style={styles.header}>Head to dropoff</Text>
          <Text style={styles.address}>{dropoff_address}</Text>
          {eta && <View style={styles.etaChip}><Text style={styles.etaText}>~{eta} min</Text></View>}
          <TouchableOpacity style={styles.primaryButton} onPress={handleArrivedAtDelivery}>
            <Text style={styles.primaryButtonText}>I've arrived at delivery</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'DELIVERY_ARRIVED') {
      return (
        <View style={styles.sheetContent}>
          <Text style={styles.header}>Enter delivery OTP</Text>
          <Text style={styles.subtext}>Ask the recipient for their OTP code</Text>
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
                autoFocus={index === 0}
              />
            ))}
          </View>
          {otpError && <Text style={styles.errorText}>{otpError}</Text>}
          <TouchableOpacity
            style={[styles.primaryButton, (otpString.length !== 4 || otpSubmitting) && styles.buttonDisabled]}
            onPress={handleConfirmDeliveryOtp}
            disabled={otpString.length !== 4 || otpSubmitting}
          >
            <Text style={styles.primaryButtonText}>{otpSubmitting ? 'Verifying...' : 'Confirm OTP'}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'DELIVERY_PHOTO') {
      return (
        <View style={styles.sheetContent}>
          <Text style={styles.header}>Take delivery photo</Text>
          <Text style={styles.subtext}>Photo required to complete delivery</Text>
          {!deliveryPhoto ? (
            <TouchableOpacity style={styles.cameraButton} onPress={() => handleTakePhoto(false)} disabled={capturingPhoto}>
              <Text style={styles.cameraButtonText}>{capturingPhoto ? 'Opening camera...' : '📷 Take Photo'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Image source={{ uri: deliveryPhoto.uri }} style={styles.photoPreview} />
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.retakeButton} onPress={() => setDeliveryPhoto(null)}>
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.uploadButton, uploading && styles.buttonDisabled]}
                  onPress={handleUploadDeliveryPhoto}
                  disabled={uploading}
                >
                  <Text style={styles.primaryButtonText}>
                    {uploading ? `Uploading ${Math.round(uploadProgress * 100)}%` : 'Use this photo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          {uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
        </View>
      );
    }

    if (phase === 'COMPLETE') {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.completeIcon}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={styles.completeHeader}>Delivery Complete!</Text>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>You earned</Text>
            <Text style={styles.earningsAmount}>R{order?.driver_earnings?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#9E9E9E' }}>
              Today: {todayCount} {todayCount === 1 ? 'delivery' : 'deliveries'} · R{todayTotal.toFixed(2)} earned
            </Text>
          </View>
          <Text style={styles.redirectText}>Returning to home...</Text>
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
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={false}
      >
        {/* Driver marker */}
        {driverCoords && (
          <Marker
            coordinate={driverCoords}
            title="You"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>🚗</Text>
            </View>
          </Marker>
        )}

        {/* Pickup marker */}
        {(phase === 'EN_ROUTE_PICKUP' || phase === 'PICKUP_ARRIVED') && (
          <Marker
            coordinate={{ latitude: Number(pickup_lat), longitude: Number(pickup_lng) }}
            title="Pickup"
            description={pickup_address}
            pinColor="#1A73E8"
          />
        )}

        {/* Dropoff marker */}
        {(phase === 'EN_ROUTE_DELIVERY' || phase === 'DELIVERY_ARRIVED' || phase === 'DELIVERY_PHOTO') && (
          <Marker
            coordinate={{ latitude: Number(dropoff_lat), longitude: Number(dropoff_lng) }}
            title="Dropoff"
            description={dropoff_address}
            pinColor="#EF4444"
          />
        )}

        {/* Route polyline */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#1A73E8"
            strokeWidth={4}
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
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  driverMarker: {
    backgroundColor: '#22C55E',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  driverMarkerText: {
    fontSize: 20,
  },
  bottomSheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
    height: 4,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sheetContent: {
    padding: 20,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  address: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 22,
  },
  etaChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  etaText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#000',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpInput: {
    width: 56,
    height: 64,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  cameraButton: {
    backgroundColor: '#F3F4F6',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cameraButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  uploadButton: {
    flex: 2,
  },
  completeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  checkmark: {
    fontSize: 48,
    color: '#FFF',
    fontWeight: 'bold',
  },
  completeHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 24,
  },
  earningsCard: {
    backgroundColor: '#F0FDF4',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  redirectText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default ActiveDelivery;
