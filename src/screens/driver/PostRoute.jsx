import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Keyboard,
  StatusBar,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { postJson } from '../../apiClient';
import { GOOGLE_MAPS_API_KEY } from '../../placesConfig';
import { fetchPlacePredictions, fetchPlaceDetails } from '../../services/googlePlaces';

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatDepartureDisplay(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PostRoute = ({ navigation }) => {
  const [fromAddress, setFromAddress] = useState('');
  const [fromLat, setFromLat] = useState(null);
  const [fromLng, setFromLng] = useState(null);

  const [toAddress, setToAddress] = useState('');
  const [toLat, setToLat] = useState(null);
  const [toLng, setToLng] = useState(null);

  const [fromPredictions, setFromPredictions] = useState([]);
  const [toPredictions, setToPredictions] = useState([]);
  const [fromPlacesLoading, setFromPlacesLoading] = useState(false);
  const [toPlacesLoading, setToPlacesLoading] = useState(false);
  const [fromPlacesError, setFromPlacesError] = useState(null);
  const [toPlacesError, setToPlacesError] = useState(null);

  const debouncedFrom = useDebounced(fromAddress, 350);
  const debouncedTo = useDebounced(toAddress, 350);

  const [departureAt, setDepartureAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [showDeparturePicker, setShowDeparturePicker] = useState(false);
  const [androidPickerMode, setAndroidPickerMode] = useState(null);

  const [bootSpace, setBootSpace] = useState(null);
  const [maxParcels, setMaxParcels] = useState(2);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const navigateTimerRef = useRef(null);

  const [tripType, setTripType] = useState('local');
  const [pickupMethod, setPickupMethod] = useState('driver_collects');

  const [meetingPointAddress, setMeetingPointAddress] = useState('');
  const [meetingPointLat, setMeetingPointLat] = useState(null);
  const [meetingPointLng, setMeetingPointLng] = useState(null);
  const [meetingPredictions, setMeetingPredictions] = useState([]);
  const [meetingPlacesLoading, setMeetingPlacesLoading] = useState(false);
  const [meetingPlacesError, setMeetingPlacesError] = useState(null);
  const debouncedMeeting = useDebounced(meetingPointAddress, 350);

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!debouncedFrom || debouncedFrom.trim().length < 2) {
        setFromPredictions([]);
        setFromPlacesError(null);
        return;
      }
      if (!GOOGLE_MAPS_API_KEY) {
        setFromPlacesError('Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
        setFromPredictions([]);
        return;
      }
      setFromPlacesLoading(true);
      setFromPlacesError(null);
      try {
        const list = await fetchPlacePredictions(debouncedFrom);
        if (!cancelled) setFromPredictions(list);
      } catch (e) {
        if (!cancelled) {
          setFromPlacesError(e.message || 'Autocomplete failed');
          setFromPredictions([]);
        }
      } finally {
        if (!cancelled) setFromPlacesLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [debouncedFrom]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!debouncedTo || debouncedTo.trim().length < 2) {
        setToPredictions([]);
        setToPlacesError(null);
        return;
      }
      if (!GOOGLE_MAPS_API_KEY) {
        setToPlacesError('Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
        setToPredictions([]);
        return;
      }
      setToPlacesLoading(true);
      setToPlacesError(null);
      try {
        const list = await fetchPlacePredictions(debouncedTo);
        if (!cancelled) setToPredictions(list);
      } catch (e) {
        if (!cancelled) {
          setToPlacesError(e.message || 'Autocomplete failed');
          setToPredictions([]);
        }
      } finally {
        if (!cancelled) setToPlacesLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [debouncedTo]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!debouncedMeeting || debouncedMeeting.trim().length < 2) {
        setMeetingPredictions([]);
        setMeetingPlacesError(null);
        return;
      }
      if (!GOOGLE_MAPS_API_KEY) {
        setMeetingPlacesError('Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
        setMeetingPredictions([]);
        return;
      }
      setMeetingPlacesLoading(true);
      setMeetingPlacesError(null);
      try {
        const list = await fetchPlacePredictions(debouncedMeeting);
        if (!cancelled) setMeetingPredictions(list);
      } catch (e) {
        if (!cancelled) {
          setMeetingPlacesError(e.message || 'Autocomplete failed');
          setMeetingPredictions([]);
        }
      } finally {
        if (!cancelled) setMeetingPlacesLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [debouncedMeeting]);

  const onSelectMeetingPrediction = useCallback(async (p) => {
    Keyboard.dismiss();
    setMeetingPredictions([]);
    setMeetingPlacesError(null);
    try {
      const details = await fetchPlaceDetails(p.place_id);
      setMeetingPointAddress(details.formatted_address || p.description || '');
      setMeetingPointLat(details.latitude);
      setMeetingPointLng(details.longitude);
    } catch (e) {
      setMeetingPlacesError(e.message || 'Could not load place');
    }
  }, []);

  const onSelectFromPrediction = useCallback(async (p) => {
    Keyboard.dismiss();
    setFromPredictions([]);
    setFromPlacesError(null);
    try {
      const details = await fetchPlaceDetails(p.place_id);
      setFromAddress(details.formatted_address || p.description || '');
      setFromLat(details.latitude);
      setFromLng(details.longitude);
    } catch (e) {
      setFromPlacesError(e.message || 'Could not load place');
    }
  }, []);

  const onSelectToPrediction = useCallback(async (p) => {
    Keyboard.dismiss();
    setToPredictions([]);
    setToPlacesError(null);
    try {
      const details = await fetchPlaceDetails(p.place_id);
      setToAddress(details.formatted_address || p.description || '');
      setToLat(details.latitude);
      setToLng(details.longitude);
    } catch (e) {
      setToPlacesError(e.message || 'Could not load place');
    }
  }, []);

  const onDepartureChange = useCallback((event, date) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'dismissed') {
        setShowDeparturePicker(false);
        setAndroidPickerMode(null);
        return;
      }
      if (date) {
        if (androidPickerMode === 'date') {
          setDepartureAt((prev) => {
            const n = new Date(prev);
            n.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
            return n;
          });
          setAndroidPickerMode('time');
        } else {
          setDepartureAt((prev) => {
            const n = new Date(prev);
            n.setHours(date.getHours(), date.getMinutes(), 0, 0);
            return n;
          });
          setShowDeparturePicker(false);
          setAndroidPickerMode(null);
        }
      }
      return;
    }
    if (event?.type === 'dismissed') return;
    if (date) setDepartureAt(date);
  }, [androidPickerMode]);

  const validate = useCallback(() => {
    if (!fromAddress.trim()) return 'From address is required.';
    if (fromLat == null || fromLng == null) return 'Choose a From address from the suggestions so we have a location.';
    if (!toAddress.trim()) return 'To address is required.';
    if (toLat == null || toLng == null) return 'Choose a To address from the suggestions so we have a location.';
    if (!(departureAt instanceof Date) || Number.isNaN(departureAt.getTime())) return 'Departure time is invalid.';
    if (departureAt.getTime() <= Date.now()) return 'Departure time must be in the future.';
    if (!Number.isInteger(maxParcels) || maxParcels < 1 || maxParcels > 5) return 'Max parcels must be between 1 and 5.';
    if (!bootSpace || !['small', 'medium', 'large'].includes(bootSpace)) return 'Please select boot space.';
    if (pickupMethod === 'sender_drops_off' && (!meetingPointAddress.trim() || meetingPointLat == null)) return 'Please enter a meeting point address';
    return null;
  }, [
    fromAddress, fromLat, fromLng,
    toAddress, toLat, toLng,
    departureAt, maxParcels, bootSpace,
    pickupMethod, meetingPointAddress, meetingPointLat,
  ]);

  const handlePostRoute = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const v = validate();
    if (v) {
      setErrorMessage(v);
      return;
    }

    const auth = getAuth();
    if (!auth?.token) {
      setErrorMessage('Not signed in. Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        from_address: fromAddress.trim(),
        from_lat: Number(fromLat),
        from_lng: Number(fromLng),
        to_address: toAddress.trim(),
        to_lat: Number(toLat),
        to_lng: Number(toLng),
        departure_time: departureAt.toISOString(),
        max_parcels: maxParcels,
        boot_space: bootSpace,
        trip_type: tripType,
        pickup_method: pickupMethod,
        meeting_point_address: pickupMethod === 'sender_drops_off' ? meetingPointAddress : null,
        meeting_point_lat:     pickupMethod === 'sender_drops_off' ? meetingPointLat     : null,
        meeting_point_lng:     pickupMethod === 'sender_drops_off' ? meetingPointLng     : null,
      };

      await postJson('/api/driver-routes', body, { token: auth.token });

      setSuccessMessage('Route posted! We will notify you when parcels match your route.');
      navigateTimerRef.current = setTimeout(() => {
        navigation.navigate('DriverHome');
      }, 2000);
    } catch (e) {
      setErrorMessage(e.message || 'Could not post route. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const bootSpaceOptions = [
    { key: 'small', label: 'Small' },
    { key: 'medium', label: 'Medium' },
    { key: 'large', label: 'Large' },
  ];

  const incrementParcels = () => { if (maxParcels < 5) setMaxParcels(maxParcels + 1); };
  const decrementParcels = () => { if (maxParcels > 1) setMaxParcels(maxParcels - 1); };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post a trip</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.explanationContainer}>
          <Text style={styles.explanationText}>
            Share where you are going and earn by delivering parcels along your way.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{successMessage}</Text>
          </View>
        ) : null}

        <View style={styles.formContainer}>

          {/* Trip type selector */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Trip type</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { key: 'local',     label: 'Local delivery' },
                { key: 'intercity', label: 'Intercity trip'  },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setTripType(opt.key)}
                  style={[
                    styles.tripTypePill,
                    tripType === opt.key && styles.tripTypePillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.tripTypePillText,
                      tripType === opt.key && styles.tripTypePillTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {tripType === 'intercity' && (
              <Text style={styles.intercityHint}>
                Post your route so clients can book parcels on your trip
              </Text>
            )}
          </View>

          {/* From */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>From</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={20} color="#000000" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={fromAddress}
                onChangeText={(t) => {
                  setFromAddress(t);
                  if (!t.trim()) { setFromLat(null); setFromLng(null); }
                }}
                placeholder="Search starting address"
                placeholderTextColor="#BDBDBD"
              />
            </View>
            {fromPlacesError ? <Text style={styles.placesErrorText}>{fromPlacesError}</Text> : null}
            {fromPredictions.length > 0 && (
              <View style={styles.predictionsBox}>
                {fromPredictions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.predictionRow}
                    onPress={() => onSelectFromPrediction(item)}
                  >
                    <Text style={styles.predictionMain} numberOfLines={2}>
                      {item.structured_formatting?.main_text || item.description}
                    </Text>
                    <Text style={styles.predictionSub} numberOfLines={1}>
                      {item.structured_formatting?.secondary_text || ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {fromPlacesLoading ? <ActivityIndicator style={{ marginTop: 8 }} color="#000000" /> : null}
          </View>

          {/* To */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>To</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={20} color="#000000" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={toAddress}
                onChangeText={(t) => {
                  setToAddress(t);
                  if (!t.trim()) { setToLat(null); setToLng(null); }
                }}
                placeholder="Search destination address"
                placeholderTextColor="#BDBDBD"
              />
            </View>
            {toPlacesError ? <Text style={styles.placesErrorText}>{toPlacesError}</Text> : null}
            {toPredictions.length > 0 && (
              <View style={styles.predictionsBox}>
                {toPredictions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.predictionRow}
                    onPress={() => onSelectToPrediction(item)}
                  >
                    <Text style={styles.predictionMain} numberOfLines={2}>
                      {item.structured_formatting?.main_text || item.description}
                    </Text>
                    <Text style={styles.predictionSub} numberOfLines={1}>
                      {item.structured_formatting?.secondary_text || ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {toPlacesLoading ? <ActivityIndicator style={{ marginTop: 8 }} color="#000000" /> : null}
          </View>

          {/* Departure time */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Departure time</Text>
            <TouchableOpacity
              style={styles.dateContainer}
              onPress={() => {
                if (Platform.OS === 'android') setAndroidPickerMode('date');
                setShowDeparturePicker(true);
              }}
            >
              <Ionicons name="calendar-outline" size={20} color="#000000" style={styles.dateIcon} />
              <Text style={styles.dateText}>{formatDepartureDisplay(departureAt)}</Text>
            </TouchableOpacity>
            {showDeparturePicker && Platform.OS === 'ios' && (
              <>
                <DateTimePicker
                  value={departureAt}
                  mode="datetime"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={onDepartureChange}
                />
                <TouchableOpacity
                  style={styles.iosPickerDone}
                  onPress={() => setShowDeparturePicker(false)}
                >
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
            {showDeparturePicker && Platform.OS === 'android' && androidPickerMode && (
              <DateTimePicker
                value={departureAt}
                mode={androidPickerMode === 'date' ? 'date' : 'time'}
                display="default"
                minimumDate={androidPickerMode === 'date' ? new Date() : undefined}
                onChange={onDepartureChange}
              />
            )}
          </View>

          {/* Boot space */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Boot space</Text>
            <View style={styles.chipsContainer}>
              {bootSpaceOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chip, bootSpace === opt.key && styles.chipSelected]}
                  onPress={() => setBootSpace(opt.key)}
                >
                  <Text style={[styles.chipText, bootSpace === opt.key && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Max parcels */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Max parcels</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={decrementParcels}
                disabled={maxParcels <= 1}
              >
                <Text style={[styles.stepperText, maxParcels <= 1 && styles.stepperTextDisabled]}>−</Text>
              </TouchableOpacity>
              <View style={styles.stepperValue}>
                <Text style={styles.stepperNumber}>{maxParcels}</Text>
              </View>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={incrementParcels}
                disabled={maxParcels >= 5}
              >
                <Text style={[styles.stepperText, maxParcels >= 5 && styles.stepperTextDisabled]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pickup method */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>How will you collect parcels?</Text>

            {[
              {
                key:   'driver_collects',
                label: 'I will collect from sender',
                sub:   'You go to the sender before departing',
              },
              {
                key:   'sender_drops_off',
                label: 'Sender drops off to me',
                sub:   'Client brings parcel to your location',
              },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setPickupMethod(opt.key)}
                style={[
                  styles.pickupOption,
                  pickupMethod === opt.key && styles.pickupOptionSelected,
                ]}
              >
                <View
                  style={[
                    styles.radioCircle,
                    pickupMethod === opt.key && styles.radioCircleSelected,
                  ]}
                >
                  {pickupMethod === opt.key && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickupLabel}>{opt.label}</Text>
                  <Text style={styles.pickupSub}>{opt.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {pickupMethod === 'sender_drops_off' && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.inputLabel}>Meeting point address</Text>
                <Text style={styles.meetingHint}>Where should the sender bring the parcel?</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="location-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter meeting point address"
                    placeholderTextColor="#BDBDBD"
                    value={meetingPointAddress}
                    onChangeText={(t) => {
                      setMeetingPointAddress(t);
                      if (!t.trim()) { setMeetingPointLat(null); setMeetingPointLng(null); }
                    }}
                  />
                </View>
                {meetingPlacesError ? (
                  <Text style={styles.placesErrorText}>{meetingPlacesError}</Text>
                ) : null}
                {meetingPredictions.length > 0 && (
                  <View style={styles.predictionsBox}>
                    {meetingPredictions.map((item) => (
                      <TouchableOpacity
                        key={item.place_id}
                        style={styles.predictionRow}
                        onPress={() => onSelectMeetingPrediction(item)}
                      >
                        <Text style={styles.predictionMain} numberOfLines={2}>
                          {item.structured_formatting?.main_text || item.description}
                        </Text>
                        <Text style={styles.predictionSub} numberOfLines={1}>
                          {item.structured_formatting?.secondary_text || ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {meetingPlacesLoading ? (
                  <ActivityIndicator style={{ marginTop: 8 }} color="#000000" />
                ) : null}
              </View>
            )}
          </View>

        </View>

        <View style={styles.noticeBanner}>
          <Ionicons name="notifications-outline" size={22} color="#F59E0B" style={styles.noticeIcon} />
          <Text style={styles.noticeText}>
            You will be notified when parcels match your route. You choose which ones to accept.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.postButton, submitting && { opacity: 0.6 }]}
          onPress={handlePostRoute}
          disabled={submitting || Boolean(successMessage)}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.postButtonText}>Post Route</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000000' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  explanationContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    marginBottom: 16,
  },
  explanationText: {
    fontSize: 14,
    color: '#9E9E9E',
    lineHeight: 20,
    textAlign: 'center',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
  },
  successBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  successBannerText: {
    color: '#15803D',
    fontSize: 14,
    lineHeight: 20,
  },
  formContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  tripTypePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  tripTypePillSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  tripTypePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  tripTypePillTextSelected: {
    color: '#FFFFFF',
  },
  intercityHint: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 8,
    lineHeight: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
    fontSize: 15,
    color: '#000000',
  },
  placesErrorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 6,
  },
  predictionsBox: {
    marginTop: 8,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  predictionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  predictionMain: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  predictionSub: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateIcon: {
    marginRight: 12,
  },
  dateText: {
    fontSize: 15,
    color: '#000000',
    flex: 1,
  },
  iosPickerDone: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  iosPickerDoneText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  chipText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepperButton: {
    width: 48,
    height: 48,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  stepperText: {
    fontSize: 22,
    color: '#000000',
    fontWeight: 'bold',
  },
  stepperTextDisabled: {
    color: '#BDBDBD',
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  pickupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    marginBottom: 10,
  },
  pickupOptionSelected: {
    borderColor: '#000000',
    backgroundColor: '#F5F5F5',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: '#000000',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  pickupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  pickupSub: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  meetingHint: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 8,
  },
  noticeBanner: {
    backgroundColor: '#FFFBEB',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noticeIcon: {
    marginRight: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  postButton: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PostRoute;
