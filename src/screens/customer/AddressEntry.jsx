import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY } from '../../placesConfig';
import { colors, spacing, radius, shadows } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

const DEFAULT_REGION = {
  latitude: -33.9249,
  longitude: 18.4241,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

function haversineKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function formatAddressFromGeocode(place) {
  if (!place) return '';
  const parts = [
    place.name,
    place.street,
    place.streetNumber,
    place.district,
    place.city,
    place.subregion,
    place.region,
    place.postalCode,
    place.country,
  ].filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.join(', ') || '';
}

async function fetchPlacePredictions(input) {
  const key = GOOGLE_MAPS_API_KEY;
  if (!key || input.trim().length < 2) return [];
  const searchText = input.trim();
  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
    `input=${encodeURIComponent(searchText)}&components=country:za&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status === 'ZERO_RESULTS') return [];
  if (json.status !== 'OK') {
    throw new Error(json.error_message || json.status || 'Places error');
  }
  return json.predictions || [];
}

async function fetchPlaceDetails(placeId) {
  const key = GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('Google Maps API key not configured');
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${encodeURIComponent(placeId)}` +
    `&fields=geometry,formatted_address&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK') {
    throw new Error(json.error_message || json.status || 'Place details failed');
  }
  const loc = json.result?.geometry?.location;
  if (!loc) throw new Error('No location for place');
  return {
    latitude: loc.lat,
    longitude: loc.lng,
    formatted_address: json.result.formatted_address || '',
  };
}

const AddressEntry = ({ navigation }) => {
  const mapRef = useRef(null);
  const reverseDebounceRef = useRef(null);
  const cardSlideAnim = useRef(new Animated.Value(0)).current;
  const programmaticMapMoveRef = useRef(false);

  const [locating, setLocating] = useState(true);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);

  const [reverseBusy, setReverseBusy] = useState(false);

  const [pickupPredictions, setPickupPredictions] = useState([]);
  const [deliveryPredictions, setDeliveryPredictions] = useState([]);
  const [placesLoadingPickup, setPlacesLoadingPickup] = useState(false);
  const [placesLoadingDelivery, setPlacesLoadingDelivery] = useState(false);
  const [placesError, setPlacesError] = useState(null);

  /** Which field's autocomplete list to show */
  const [focusedField, setFocusedField] = useState(null);

  const debouncedPickup = useDebounced(pickupAddress, 350);
  const debouncedDelivery = useDebounced(deliveryAddress, 350);

  const distanceKm = useMemo(
    () => (pickupCoords && dropoffCoords ? haversineKm(pickupCoords, dropoffCoords) : 0),
    [pickupCoords, dropoffCoords]
  );

  const reverseGeocodePickup = useCallback((center) => {
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
    reverseDebounceRef.current = setTimeout(async () => {
      setReverseBusy(true);
      try {
        const [place] = await Location.reverseGeocodeAsync(center);
        const line = formatAddressFromGeocode(place);
        setPickupAddress(line || 'Selected location');
      } catch {
        setPickupAddress(
          `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`
        );
      } finally {
        setReverseBusy(false);
      }
    }, 400);
  }, []);

  const runInitialGps = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coord = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      programmaticMapMoveRef.current = true;
      setPickupCoords(coord);
      mapRef.current?.animateToRegion(
        {
          ...coord,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        600
      );
      try {
        const [place] = await Location.reverseGeocodeAsync(coord);
        const line = formatAddressFromGeocode(place);
        setPickupAddress(line || `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
      } catch {
        setPickupAddress(`${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
      }
    } catch (e) {
      setLocationError(e.message || 'Could not get location');
      programmaticMapMoveRef.current = true;
      mapRef.current?.animateToRegion(DEFAULT_REGION, 400);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    runInitialGps();
  }, [runInitialGps]);

  /** Pickup autocomplete */
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (focusedField !== 'pickup') {
        setPickupPredictions([]);
        return;
      }
      if (!debouncedPickup || debouncedPickup.trim().length < 2) {
        setPickupPredictions([]);
        setPlacesError(null);
        return;
      }
      if (!GOOGLE_MAPS_API_KEY) {
        setPlacesError('Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY or app.json googleMaps.apiKey');
        setPickupPredictions([]);
        return;
      }
      setPlacesLoadingPickup(true);
      setPlacesError(null);
      try {
        const list = await fetchPlacePredictions(debouncedPickup);
        if (!cancelled) setPickupPredictions(list);
      } catch (e) {
        if (!cancelled) {
          setPlacesError(e.message || 'Autocomplete failed');
          setPickupPredictions([]);
        }
      } finally {
        if (!cancelled) setPlacesLoadingPickup(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedPickup, focusedField]);

  /** Delivery autocomplete */
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (focusedField !== 'delivery') {
        setDeliveryPredictions([]);
        return;
      }
      if (!debouncedDelivery || debouncedDelivery.trim().length < 2) {
        setDeliveryPredictions([]);
        return;
      }
      if (!GOOGLE_MAPS_API_KEY) {
        setDeliveryPredictions([]);
        return;
      }
      setPlacesLoadingDelivery(true);
      try {
        const list = await fetchPlacePredictions(debouncedDelivery);
        if (!cancelled) setDeliveryPredictions(list);
      } catch (e) {
        if (!cancelled) setDeliveryPredictions([]);
      } finally {
        if (!cancelled) setPlacesLoadingDelivery(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedDelivery, focusedField]);

  const onRegionChangeComplete = useCallback(
    (region) => {
      if (programmaticMapMoveRef.current) {
        programmaticMapMoveRef.current = false;
        return;
      }
      const center = {
        latitude: region.latitude,
        longitude: region.longitude,
      };
      setPickupCoords(center);
      reverseGeocodePickup(center);
    },
    [reverseGeocodePickup]
  );

  const fitBothPins = useCallback(() => {
    if (!mapRef.current || !pickupCoords || !dropoffCoords) return;
    mapRef.current.fitToCoordinates([pickupCoords, dropoffCoords], {
      edgePadding: { top: 120, right: 80, bottom: 200, left: 80 },
      animated: true,
    });
  }, [pickupCoords, dropoffCoords]);

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      const t = setTimeout(fitBothPins, 400);
      return () => clearTimeout(t);
    }
  }, [pickupCoords, dropoffCoords, fitBothPins]);

  useEffect(() => {
    const ready =
      pickupCoords &&
      dropoffCoords &&
      pickupAddress.trim().length > 0 &&
      deliveryAddress.trim().length > 0;
    if (ready) {
      Animated.spring(cardSlideAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    } else {
      cardSlideAnim.setValue(0);
    }
  }, [pickupCoords, dropoffCoords, pickupAddress, deliveryAddress, cardSlideAnim]);

  const onSelectPickupPrediction = useCallback(async (p) => {
    Keyboard.dismiss();
    setPickupPredictions([]);
    setPlacesError(null);
    try {
      const details = await fetchPlaceDetails(p.place_id);
      const addr = details.formatted_address || p.description || '';
      setPickupAddress(addr);
      const coord = { latitude: details.latitude, longitude: details.longitude };
      setPickupCoords(coord);
      programmaticMapMoveRef.current = true;
      mapRef.current?.animateToRegion(
        {
          latitude: coord.latitude,
          longitude: coord.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
      if (dropoffCoords) {
        setTimeout(() => fitBothPins(), 600);
      }
    } catch (e) {
      setPlacesError(e.message || 'Could not load place');
    }
  }, [dropoffCoords, fitBothPins]);

  const onSelectDeliveryPrediction = useCallback(async (p) => {
    Keyboard.dismiss();
    setDeliveryPredictions([]);
    setPlacesError(null);
    try {
      const details = await fetchPlaceDetails(p.place_id);
      setDeliveryAddress(p.description || details.formatted_address);
      setDropoffCoords({
        latitude: details.latitude,
        longitude: details.longitude,
      });
      programmaticMapMoveRef.current = true;
      mapRef.current?.animateToRegion(
        {
          latitude: details.latitude,
          longitude: details.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
      if (pickupCoords) {
        setTimeout(() => fitBothPins(), 600);
      }
    } catch (e) {
      setPlacesError(e.message || 'Could not load place');
    }
  }, [pickupCoords, fitBothPins]);

  const useMyLocation = useCallback(async () => {
    setLocationBusy(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coord = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      programmaticMapMoveRef.current = true;
      setPickupCoords(coord);
      try {
        const [place] = await Location.reverseGeocodeAsync(coord);
        const line = formatAddressFromGeocode(place);
        setPickupAddress(line || `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
      } catch {
        setPickupAddress(`${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
      }
      mapRef.current?.animateToRegion(
        {
          ...coord,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        600
      );
    } catch (e) {
      setLocationError(e.message || 'Could not get location');
    } finally {
      setLocationBusy(false);
    }
  }, []);

  const handleConfirm = () => {
    if (!pickupCoords || !dropoffCoords) return;
    const p = pickupAddress.trim();
    const d = deliveryAddress.trim();
    if (!p || !d) return;
    navigation.navigate('ParcelDescription', {
      pickup_address: p,
      pickup_lat: pickupCoords.latitude,
      pickup_lng: pickupCoords.longitude,
      dropoff_address: d,
      dropoff_lat: dropoffCoords.latitude,
      dropoff_lng: dropoffCoords.longitude,
    });
  };

  const confirmTranslateY = cardSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  const polylineCoords =
    pickupCoords && dropoffCoords ? [pickupCoords, dropoffCoords] : null;

  const predictions =
    focusedField === 'pickup'
      ? pickupPredictions
      : focusedField === 'delivery'
        ? deliveryPredictions
        : [];
  const predictionsLoading =
    focusedField === 'pickup' ? placesLoadingPickup : placesLoadingDelivery;

  const canConfirm =
    pickupCoords &&
    dropoffCoords &&
    pickupAddress.trim().length > 0 &&
    deliveryAddress.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          mapType="standard"
          onRegionChangeComplete={onRegionChangeComplete}
          rotateEnabled
          pitchEnabled={false}
        >
          {pickupCoords && (
            <Marker coordinate={pickupCoords} title="Pickup" pinColor={colors.success} />
          )}
          {dropoffCoords && (
            <Marker coordinate={dropoffCoords} title="Delivery" pinColor={colors.danger} />
          )}
          {polylineCoords && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[8, 6]}
            />
          )}
        </MapView>

        <View style={styles.topBanner} pointerEvents="box-none">
          {locating ? (
            <View style={styles.topBannerInner}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.topBannerText, { marginLeft: 8 }]}>
                Getting your location…
              </Text>
            </View>
          ) : locationError ? (
            <View style={styles.topBannerInner}>
              <Text style={styles.topBannerError}>{locationError}</Text>
            </View>
          ) : reverseBusy ? (
            <View style={styles.topBannerInner}>
              <Text style={styles.topBannerSubtle}>Updating pickup from map…</Text>
            </View>
          ) : null}
        </View>

      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.inputBlock}>
          <View style={styles.row}>
            <View style={styles.greenDot} />
            <TextInput
              style={styles.input}
              value={pickupAddress}
              onChangeText={(t) => {
                setPickupAddress(t);
                if (!t.trim()) {
                  setPickupCoords(null);
                }
              }}
              placeholder="Enter pickup address"
              placeholderTextColor={colors.textLight}
              returnKeyType="search"
              onFocus={() => setFocusedField('pickup')}
              onBlur={() => {
                setTimeout(() => setFocusedField((f) => (f === 'pickup' ? null : f)), 200);
              }}
            />
            <TouchableOpacity
              style={styles.inlineLocate}
              onPress={useMyLocation}
              disabled={locationBusy || locating}
              hitSlop={8}
              accessibilityLabel="Use my location for pickup"
            >
              <Ionicons name="navigate-circle-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={styles.redDot} />
            <TextInput
              style={styles.input}
              value={deliveryAddress}
              onChangeText={(t) => {
                setDeliveryAddress(t);
                if (!t.trim()) setDropoffCoords(null);
              }}
              placeholder="Enter delivery address"
              placeholderTextColor={colors.textLight}
              returnKeyType="search"
              onFocus={() => setFocusedField('delivery')}
              onBlur={() => {
                setTimeout(() => setFocusedField((f) => (f === 'delivery' ? null : f)), 200);
              }}
            />
          </View>

          {placesError ? <Text style={styles.placesErrorText}>{placesError}</Text> : null}

          {predictions.length > 0 && focusedField && (
            <ScrollView
              style={styles.predictions}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {predictions.map((item) => (
                <TouchableOpacity
                  key={item.place_id}
                  style={styles.predictionRow}
                  onPress={() =>
                    focusedField === 'pickup'
                      ? onSelectPickupPrediction(item)
                      : onSelectDeliveryPrediction(item)
                  }
                >
                  <Text style={styles.predictionMain} numberOfLines={2}>
                    {item.structured_formatting?.main_text || item.description}
                  </Text>
                  <Text style={styles.predictionSub} numberOfLines={1}>
                    {item.structured_formatting?.secondary_text || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {predictionsLoading ? (
            <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />
          ) : null}

          <Text style={styles.mapHint}>
            Tip: drag the map to adjust pickup — the green pin follows the centre.
          </Text>
        </View>

        <Animated.View
          style={[styles.confirmCard, { transform: [{ translateY: confirmTranslateY }] }]}
        >
          {canConfirm ? (
            <>
              <View style={styles.confirmRow}>
                <View style={styles.greenDotSmall} />
                <Text style={styles.confirmAddr} numberOfLines={3}>
                  {pickupAddress.trim()}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <View style={styles.redDotSmall} />
                <Text style={styles.confirmAddr} numberOfLines={3}>
                  {deliveryAddress.trim()}
                </Text>
              </View>
              <Text style={styles.distanceText}>
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)} m apart`
                  : `${distanceKm.toFixed(1)} km apart`}
              </Text>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.confirmHint}>
              Enter pickup and delivery addresses (or drag the map for pickup), then choose
              suggestions.
            </Text>
          )}
        </Animated.View>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[styles.backLinkText, { marginLeft: 4 }]}>Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  mapWrap: {
    flex: 1,
    minHeight: height * 0.38,
  },
  topBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 8 : 12,
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
  topBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    maxWidth: width - 32,
    ...shadows.card,
  },
  topBannerText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  topBannerSubtle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  topBannerError: {
    fontSize: 13,
    color: colors.danger,
  },
  bottomPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
    maxHeight: height * 0.52,
  },
  inputBlock: {
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    marginLeft: spacing.sm,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    marginLeft: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inlineLocate: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  predictions: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  predictionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  predictionMain: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  predictionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  placesErrorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  mapHint: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 4,
    lineHeight: 16,
  },
  confirmCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  greenDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginTop: 6,
    marginRight: 10,
  },
  redDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    marginTop: 6,
    marginRight: 10,
  },
  confirmAddr: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
    marginLeft: 18,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  confirmHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    lineHeight: 18,
  },
  backLink: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  backLinkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AddressEntry;
