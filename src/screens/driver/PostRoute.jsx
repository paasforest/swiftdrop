import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { postJson } from '../../apiClient';
import { GOOGLE_MAPS_API_KEY } from '../../placesConfig';
import { fetchPlacePredictions, fetchPlaceDetails } from '../../services/googlePlaces';
import { colors, spacing, radius, typography, shadows } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

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
  /** Android: date then time (datetime mode not reliable on all API levels). */
  const [androidPickerMode, setAndroidPickerMode] = useState(null);

  const [bootSpace, setBootSpace] = useState(null);
  const [maxParcels, setMaxParcels] = useState(2);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const navigateTimerRef = useRef(null);

  // Trip type
  const [tripType, setTripType] = useState('local');

  // Pickup method
  const [pickupMethod, setPickupMethod] = useState('driver_collects');

  // Meeting point (only used when sender_drops_off)
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
    return () => {
      cancelled = true;
    };
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
    return () => {
      cancelled = true;
    };
  }, [debouncedTo]);

  // Meeting point autocomplete — same pattern as From/To
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
    return () => {
      cancelled = true;
    };
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
    if (!fromAddress.trim()) {
      return 'From address is required.';
    }
    if (fromLat == null || fromLng == null) {
      return 'Choose a From address from the suggestions so we have a location.';
    }
    if (!toAddress.trim()) {
      return 'To address is required.';
    }
    if (toLat == null || toLng == null) {
      return 'Choose a To address from the suggestions so we have a location.';
    }
    if (!(departureAt instanceof Date) || Number.isNaN(departureAt.getTime())) {
      return 'Departure time is invalid.';
    }
    if (departureAt.getTime() <= Date.now()) {
      return 'Departure time must be in the future.';
    }
    if (!Number.isInteger(maxParcels) || maxParcels < 1 || maxParcels > 5) {
      return 'Max parcels must be between 1 and 5.';
    }
    if (!bootSpace || !['small', 'medium', 'large'].includes(bootSpace)) {
      return 'Please select boot space.';
    }
    if (pickupMethod === 'sender_drops_off' && (!meetingPointAddress.trim() || meetingPointLat == null)) {
      return 'Please enter a meeting point address';
    }
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

  const handleBack = () => {
    navigation.goBack();
  };

  const bootSpaceOptions = [
    { key: 'small', label: 'Small' },
    { key: 'medium', label: 'Medium' },
    { key: 'large', label: 'Large' },
  ];

  const incrementParcels = () => {
    if (maxParcels < 5) setMaxParcels(maxParcels + 1);
  };

  const decrementParcels = () => {
    if (maxParcels > 1) setMaxParcels(maxParcels - 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Post Your Route</Text>
          <View style={{ width: 28 }} />
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
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.inputLabel}>Trip type</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { key: 'local',     label: 'Local delivery' },
                { key: 'intercity', label: 'Intercity trip'  },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setTripType(opt.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 24,
                    alignItems: 'center',
                    backgroundColor: tripType === opt.key ? '#000000' : 'transparent',
                    borderWidth: 1.5,
                    borderColor: tripType === opt.key ? '#000000' : '#E0E0E0',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: tripType === opt.key ? '#FFFFFF' : '#757575',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {tripType === 'intercity' && (
              <Text style={{ fontSize: 12, color: '#9E9E9E', marginTop: 8, lineHeight: 16 }}>
                Post your route so clients can book parcels on your trip
              </Text>
            )}
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>From</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={20} color={colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={fromAddress}
                onChangeText={(t) => {
                  setFromAddress(t);
                  if (!t.trim()) {
                    setFromLat(null);
                    setFromLng(null);
                  }
                }}
                placeholder="Search starting address"
                placeholderTextColor={colors.textLight}
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
            {fromPlacesLoading ? <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} /> : null}
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>To</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={20} color={colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={toAddress}
                onChangeText={(t) => {
                  setToAddress(t);
                  if (!t.trim()) {
                    setToLat(null);
                    setToLng(null);
                  }
                }}
                placeholder="Search destination address"
                placeholderTextColor={colors.textLight}
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
            {toPlacesLoading ? <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} /> : null}
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Departure time</Text>
            <TouchableOpacity
              style={styles.dateContainer}
              onPress={() => {
                if (Platform.OS === 'android') {
                  setAndroidPickerMode('date');
                }
                setShowDeparturePicker(true);
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.primary} style={styles.dateIcon} />
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

          {/* Pickup method toggle */}
          <View style={{ marginTop: 24 }}>
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
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: pickupMethod === opt.key ? '#000000' : '#E0E0E0',
                  backgroundColor: pickupMethod === opt.key ? '#F5F5F5' : '#FAFAFA',
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: pickupMethod === opt.key ? '#000' : '#E0E0E0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  {pickupMethod === opt.key && (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>{opt.label}</Text>
                  <Text style={{ fontSize: 12, color: '#9E9E9E', marginTop: 2 }}>{opt.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Meeting point — only when sender_drops_off */}
            {pickupMethod === 'sender_drops_off' && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.inputLabel}>Meeting point address</Text>
                <Text style={{ fontSize: 12, color: '#9E9E9E', marginBottom: 8 }}>
                  Where should the sender bring the parcel?
                </Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="location-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter meeting point address"
                    placeholderTextColor={colors.textLight}
                    value={meetingPointAddress}
                    onChangeText={(t) => {
                      setMeetingPointAddress(t);
                      if (!t.trim()) {
                        setMeetingPointLat(null);
                        setMeetingPointLng(null);
                      }
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
                  <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />
                ) : null}
              </View>
            )}
          </View>
        </View>

        <View style={styles.noticeBanner}>
          <Ionicons name="notifications-outline" size={22} color={colors.accent} style={styles.noticeIcon} />
          <Text style={styles.noticeText}>
            You will be notified when parcels match your route. You choose which ones to accept.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.postButton, submitting && styles.postButtonDisabled]}
          onPress={handlePostRoute}
          disabled={submitting || Boolean(successMessage)}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textWhite} />
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
    backgroundColor: colors.textWhite,
    width: width,
    minHeight: height,
  },
  scrollContent: {
    paddingBottom: 120,
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
  explanationContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  explanationText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerLight,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  successBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successLight,
  },
  successBannerText: {
    color: colors.success,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 4,
  },
  inputIcon: {
    fontSize: 20,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  placesErrorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 6,
  },
  predictionsBox: {
    marginTop: 8,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.textWhite,
  },
  predictionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  predictionMain: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  predictionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  dateIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  dateText: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  },
  iosPickerDone: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  iosPickerDoneText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: colors.textWhite,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 4,
  },
  stepperButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperText: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: 'bold',
  },
  stepperTextDisabled: {
    color: colors.textLight,
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  noticeBanner: {
    backgroundColor: colors.warningLight,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  noticeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: colors.warning,
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
    backgroundColor: colors.textWhite,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  postButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  postButtonDisabled: {
    opacity: 0.85,
  },
  postButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PostRoute;
