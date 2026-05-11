import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, StatusBar, Modal, TextInput, Image,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { API_BASE_URL } from '../../apiConfig';

const ORDER_OTP_DIGITS = 6;

const TripDeliveryManager = ({ navigation, route }) => {
  const { routeId } = route.params;

  const [parcels, setParcels] = useState([]);
  const [tripRoute, setTripRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total: 0, collected: 0, delivered: 0 });
  const [activeParcel, setActiveParcel] = useState(null);
  const [phase, setPhase] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [photo, setPhoto] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  useFocusEffect(useCallback(() => {
    fetchParcels();
  }, []));

  async function fetchParcels() {
    setLoading(true);
    const auth = getAuth();
    try {
      const data = await getJson(`/api/driver-routes/${routeId}/parcels`, { token: auth?.token });
      setParcels(data.parcels);
      setTripRoute(data.route);
      setSummary({ total: data.total, collected: data.collected, delivered: data.delivered });
    } catch {
      setError('Could not load parcels');
    } finally {
      setLoading(false);
    }
  }

  function getParcelPhase(parcel) {
    if (['delivered', 'completed'].includes(parcel.status)) return 'done';
    if (parcel.pickup_confirmed_at && parcel.pickup_photo_url) return 'ready_to_deliver';
    if (parcel.pickup_confirmed_at) return 'needs_pickup_photo';
    return 'needs_collection';
  }

  function getStatusLabel(parcel) {
    const p = getParcelPhase(parcel);
    if (p === 'done') return 'Delivered ✓';
    if (p === 'ready_to_deliver') return 'Ready to deliver';
    if (p === 'needs_pickup_photo') return 'Take collection photo';
    return 'Awaiting collection';
  }

  function getStatusColor(parcel) {
    const p = getParcelPhase(parcel);
    if (p === 'done') return '#00C853';
    if (p === 'ready_to_deliver') return '#000000';
    return '#9E9E9E';
  }

  function closeModal() {
    setPhase(null);
    setActiveParcel(null);
    setOtpInput('');
    setPhoto(null);
    setError(null);
  }

  async function handleArrivedAtPickup() {
    setProcessing(true);
    const auth = getAuth();
    try {
      await postJson(
        `/api/orders/${activeParcel.id}/pickup-arrived`,
        {},
        { token: auth?.token }
      );
      setPhase('collection_otp');
    } catch (err) {
      setError(err.message || 'Could not update status. Try again.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleArrivedAtDelivery() {
    setProcessing(true);
    const auth = getAuth();
    try {
      await postJson(
        `/api/orders/${activeParcel.id}/delivery-arrived`,
        {},
        { token: auth?.token }
      );
      setPhase('delivery_otp');
    } catch (err) {
      setError(err.message || 'Could not update status.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirmCollectionOtp() {
    setProcessing(true);
    setError(null);
    const auth = getAuth();
    try {
      await postJson(`/api/orders/${activeParcel.id}/pickup-otp`, { otp: otpInput }, { token: auth?.token });
      setOtpInput('');
      setPhase('collection_photo');
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setProcessing(false);
    }
  }

  async function handleTakePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  }

  async function handleUploadCollectionPhoto() {
    setProcessing(true);
    const auth = getAuth();
    try {
      const formData = new FormData();
      formData.append('photo', { uri: photo, type: 'image/jpeg', name: `pickup_${activeParcel.id}.jpg` });
      await fetch(`${API_BASE_URL}/api/orders/${activeParcel.id}/pickup-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth?.token}` },
        body: formData,
      });
      setPhoto(null);
      setPhase(null);
      setActiveParcel(null);
      await fetchParcels();
    } catch {
      setError('Photo upload failed');
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirmDeliveryOtp() {
    setProcessing(true);
    setError(null);
    const auth = getAuth();
    try {
      await postJson(`/api/orders/${activeParcel.id}/delivery-otp`, { otp: otpInput }, { token: auth?.token });
      setOtpInput('');
      setPhase('delivery_photo');
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setProcessing(false);
    }
  }

  async function handleUploadDeliveryPhoto() {
    setProcessing(true);
    const auth = getAuth();
    try {
      const formData = new FormData();
      formData.append('photo', { uri: photo, type: 'image/jpeg', name: `delivery_${activeParcel.id}.jpg` });
      await fetch(`${API_BASE_URL}/api/orders/${activeParcel.id}/delivery-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth?.token}` },
        body: formData,
      });
      setPhoto(null);
      setPhase(null);
      setActiveParcel(null);
      await fetchParcels();
    } catch {
      setError('Photo upload failed');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color="#00C853" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My trip parcels</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressStat}>
          <Text style={styles.progressNum}>{summary.total}</Text>
          <Text style={styles.progressLabel}>Total</Text>
        </View>
        <View style={styles.progressDivider} />
        <View style={styles.progressStat}>
          <Text style={styles.progressNum}>{summary.collected}</Text>
          <Text style={styles.progressLabel}>Collected</Text>
        </View>
        <View style={styles.progressDivider} />
        <View style={styles.progressStat}>
          <Text style={[
            styles.progressNum,
            summary.delivered === summary.total && summary.total > 0 && { color: '#00C853' },
          ]}>
            {summary.delivered}
          </Text>
          <Text style={styles.progressLabel}>Delivered</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >
        {parcels.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#9E9E9E', marginTop: 40, fontSize: 15 }}>
            No parcels assigned to this trip yet.
          </Text>
        )}

        {parcels.map((parcel, index) => {
          const pPhase = getParcelPhase(parcel);
          const isDone = pPhase === 'done';

          return (
            <View key={parcel.id} style={styles.parcelCard}>
              <View style={styles.parcelHeader}>
                <View style={styles.parcelNumber}>
                  <Text style={styles.parcelNumText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.parcelSize}>
                    {parcel.parcel_size} parcel{parcel.parcel_type ? ` · ${parcel.parcel_type}` : ''}
                  </Text>
                  <Text style={[styles.parcelStatus, { color: getStatusColor(parcel) }]}>
                    {getStatusLabel(parcel)}
                  </Text>
                </View>
                {isDone && <Text style={styles.doneCheck}>✓</Text>}
              </View>

              <View style={styles.addressBlock}>
                <View style={styles.addressRow}>
                  <View style={styles.dotGreen} />
                  <Text style={styles.addressText} numberOfLines={1}>{parcel.pickup_address}</Text>
                </View>
                <View style={styles.addressRow}>
                  <View style={styles.dotBlack} />
                  <Text style={styles.addressText} numberOfLines={1}>{parcel.dropoff_address}</Text>
                </View>
              </View>

              {!isDone && (
                <TouchableOpacity
                  style={styles.parcelAction}
                  onPress={() => {
                    setActiveParcel(parcel);
                    if (pPhase === 'needs_collection') setPhase('collection_arrived');
                    else if (pPhase === 'needs_pickup_photo') setPhase('collection_photo');
                    else if (pPhase === 'ready_to_deliver') setPhase('delivery_arrived');
                  }}
                >
                  <Text style={styles.parcelActionText}>
                    {pPhase === 'needs_collection' && 'Collect parcel'}
                    {pPhase === 'needs_pickup_photo' && 'Take collection photo'}
                    {pPhase === 'ready_to_deliver' && 'Deliver parcel'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={phase !== null} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {phase === 'collection_arrived' && 'At pickup'}
              {phase === 'collection_otp' && 'Collection OTP'}
              {phase === 'collection_photo' && 'Collection photo'}
              {phase === 'delivery_arrived' && 'At delivery'}
              {phase === 'delivery_otp' && 'Delivery OTP'}
              {phase === 'delivery_photo' && 'Delivery photo'}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>

            {phase === 'collection_arrived' && (
              <View style={{ padding: 24 }}>
                <Text style={styles.modalInstruction}>
                  Go to the pickup address
                </Text>
                <Text style={styles.modalSub}>
                  {activeParcel?.pickup_address}
                </Text>

                <View style={styles.addressCard}>
                  <Text style={styles.addressCardIcon}>
                    📍
                  </Text>
                  <Text style={styles.addressCardText}>
                    {activeParcel?.pickup_address}
                  </Text>
                </View>

                <Text style={styles.arrivalNote}>
                  Once you are physically at the pickup address, tap the button below. An OTP will be sent to the sender.
                </Text>

                <TouchableOpacity
                  style={styles.arrivedButton}
                  onPress={handleArrivedAtPickup}
                  disabled={processing}
                >
                  {processing
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.arrivedButtonText}>
                      ✓ I have arrived at pickup
                    </Text>}
                </TouchableOpacity>
              </View>
            )}

            {phase === 'delivery_arrived' && (
              <View style={{ padding: 24 }}>
                <Text style={styles.modalInstruction}>
                  Go to the delivery address
                </Text>
                <Text style={styles.modalSub}>
                  {activeParcel?.dropoff_address}
                </Text>

                <View style={styles.addressCard}>
                  <Text style={styles.addressCardIcon}>
                    🏁
                  </Text>
                  <Text style={styles.addressCardText}>
                    {activeParcel?.dropoff_address}
                  </Text>
                </View>

                <Text style={styles.arrivalNote}>
                  Once you are at the delivery address, tap below. An OTP will be sent to the recipient.
                </Text>

                <TouchableOpacity
                  style={styles.arrivedButton}
                  onPress={handleArrivedAtDelivery}
                  disabled={processing}
                >
                  {processing
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.arrivedButtonText}>
                      ✓ I have arrived at delivery
                    </Text>}
                </TouchableOpacity>
              </View>
            )}

            {(phase === 'collection_otp' || phase === 'delivery_otp') && (
              <View>
                <Text style={styles.modalInstruction}>
                  {phase === 'collection_otp'
                    ? 'Ask the sender for the collection code'
                    : 'Ask the recipient for the delivery code'}
                </Text>
                <Text style={styles.modalSub}>
                  {phase === 'collection_otp'
                    ? activeParcel?.pickup_address
                    : activeParcel?.dropoff_address}
                </Text>

                <View style={styles.otpRow}>
                  {Array.from({ length: ORDER_OTP_DIGITS }, (_, i) => i).map((i) => (
                    <TextInput
                      key={i}
                      style={styles.otpBox}
                      maxLength={1}
                      keyboardType="numeric"
                      value={otpInput[i] || ''}
                      onChangeText={(text) => {
                        const arr = otpInput.split('');
                        arr[i] = text;
                        setOtpInput(arr.join('').slice(0, ORDER_OTP_DIGITS));
                      }}
                    />
                  ))}
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.modalButton, otpInput.length < ORDER_OTP_DIGITS && { opacity: 0.4 }]}
                  disabled={otpInput.length < ORDER_OTP_DIGITS || processing}
                  onPress={phase === 'collection_otp' ? handleConfirmCollectionOtp : handleConfirmDeliveryOtp}
                >
                  {processing
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.modalButtonText}>Confirm OTP</Text>}
                </TouchableOpacity>
              </View>
            )}

            {(phase === 'collection_photo' || phase === 'delivery_photo') && (
              <View>
                <Text style={styles.modalInstruction}>
                  {phase === 'collection_photo'
                    ? 'Take a photo of the parcel'
                    : 'Take a photo of the delivered parcel'}
                </Text>
                <Text style={styles.modalSub}>
                  {phase === 'collection_photo'
                    ? 'This proves the parcel was in good condition at collection'
                    : 'Proof of successful delivery'}
                </Text>

                <TouchableOpacity style={styles.photoArea} onPress={handleTakePhoto}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoEmpty}>
                      <Text style={styles.photoIcon}>📷</Text>
                      <Text style={styles.photoHint}>Tap to take photo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {error && <Text style={styles.errorText}>{error}</Text>}

                {photo && (
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={phase === 'collection_photo' ? handleUploadCollectionPhoto : handleUploadDeliveryPhoto}
                    disabled={processing}
                  >
                    {processing
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={styles.modalButtonText}>
                          {phase === 'collection_photo' ? 'Use this photo' : 'Complete delivery'}
                        </Text>}
                  </TouchableOpacity>
                )}
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000000' },
  progressCard: {
    flexDirection: 'row', backgroundColor: '#000000',
    margin: 16, borderRadius: 16, padding: 20, alignItems: 'center',
  },
  progressStat: { flex: 1, alignItems: 'center' },
  progressNum: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  progressLabel: { fontSize: 11, color: '#9E9E9E', fontWeight: '600' },
  progressDivider: { width: 1, height: 40, backgroundColor: '#333333' },
  scroll: { flex: 1 },
  parcelCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  parcelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  parcelNumber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  parcelNumText: { fontSize: 14, fontWeight: '700', color: '#000000' },
  parcelSize: { fontSize: 14, fontWeight: '600', color: '#000000', marginBottom: 2 },
  parcelStatus: { fontSize: 12, fontWeight: '600' },
  doneCheck: { fontSize: 20, color: '#00C853', fontWeight: '700' },
  addressBlock: { marginBottom: 12 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C853', marginRight: 10 },
  dotBlack: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#000000', marginRight: 10 },
  addressText: { fontSize: 13, color: '#757575', flex: 1 },
  parcelAction: {
    backgroundColor: '#000000', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  parcelActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  modalClose: { fontSize: 18, color: '#9E9E9E', padding: 4 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#000000' },
  modalInstruction: {
    fontSize: 20, fontWeight: '700', color: '#000000',
    marginBottom: 8, textAlign: 'center',
  },
  modalSub: {
    fontSize: 13, color: '#9E9E9E', textAlign: 'center',
    marginBottom: 32, lineHeight: 18,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  addressCardIcon: { fontSize: 20 },
  addressCardText: {
    flex: 1, fontSize: 14,
    color: '#000000', lineHeight: 20,
  },
  arrivalNote: {
    fontSize: 13, color: '#757575',
    lineHeight: 18, marginBottom: 24,
    textAlign: 'center',
  },
  arrivedButton: {
    backgroundColor: '#00C853',
    borderRadius: 14, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  arrivedButtonText: {
    color: '#FFFFFF', fontSize: 16,
    fontWeight: '700',
  },
  otpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
  },
  errorText: { color: '#FF3B30', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  modalButton: {
    backgroundColor: '#000000', borderRadius: 14,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  photoArea: {
    height: 200, borderRadius: 16, backgroundColor: '#F5F5F5',
    borderWidth: 1.5, borderColor: '#E0E0E0', borderStyle: 'dashed',
    overflow: 'hidden', marginBottom: 24, alignItems: 'center', justifyContent: 'center',
  },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoEmpty: { alignItems: 'center' },
  photoIcon: { fontSize: 40, marginBottom: 8 },
  photoHint: { fontSize: 13, color: '#9E9E9E' },
});

export default TripDeliveryManager;
