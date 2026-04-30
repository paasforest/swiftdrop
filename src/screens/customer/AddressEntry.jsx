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
  StatusBar,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY } from '../../placesConfig';
import { spacing, radius, shadows } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

const MAX_SUGGESTIONS = 5;
const AUTOCOMPLETE_DEBOUNCE_MS = 180;

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
  const list = json.predictions || [];
  return list.slice(0, MAX_SUGGESTIONS);
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

/** Centers map on user GPS only — does not set pickup/delivery state. */
const AddressEntry = ({ navigation }) => {
  const mapRef = useRef(null);
  const cardSlideAnim = useRef(new Animated.Value(0)).current;

  const [mapCentering, setMapCentering] = useState(true);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const [pickupCoords, setPickupCoords] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);

  const [pickupPredictions, setPickupPredictions] = useState([]);
  const [deliveryPredictions, setDeliveryPredictions] = useState([]);
  const [placesLoadingPickup, setPlacesLoadingPickup] = useState(false);
  const [placesLoadingDelivery, setPlacesLoadingDelivery] = useState(false);
  const [placesErrorPickup, setPlacesErrorPickup] = useState(null);
  const [placesErrorDelivery, setPlacesErrorDelivery] = useState(null);

  const [focusedField, setFocusedField] = useState(null);

  const debouncedPickup = useDebounced(pickupAddress, AUTOCOMPLETE_DEBOUNCE_MS);
  const debouncedDelivery = useDebounced(deliveryAddress, AUTOCOMPLETE_DEBOUNCE_MS);

  const distanceKm = useMemo(
    () => (pickupCoords && dropoffCoords ? haversineKm(pickupCoords, dropoffCoords) : 0),
    [pickupCoords, dropoffCoords]
  );

  /** On open: only move camera to current location — never fill pickup field. */
  const centerMapOnCurrentLocation = useCallback(async () => {
    setMapCentering(true);
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
      mapRef.current?.animateToRegion(DEFAULT_REGION, 400);
    } finally {
      setMapCentering(false);
    }
  }, []);

  useEffect(() => {
    centerMapOnCurrentLocation();
  }, [centerMapOnCurrentLocation]);

  /** Pickup autocomplete — South Africa only (country:za in fetchPlacePredictions). */
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (focusedField !== 'pickup') {
        setPickupPredictions([]);
        return;
      }
      if (!debouncedPickup || debouncedPickup.trim().length < 2) {
        setPickupPredictions([]);
        setPlacesErrorPickup(null);
        return;
      }
      if (!GOOGLE_MAPS_API_KEY) {
        setPlacesErrorPickup('Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY or app.json googleMaps.apiKey');
        setPickupPredictions([]);
        return;
      }
      setPlacesLoadingPickup(true);
      setPlacesErrorPickup(null);
      try {
        const list = await fetchPlacePredictions(debouncedPickup);
        if (!cancelled) setPickupPredictions(list);
      } catch (e) {
        if (!cancelled) {
          setPlacesErrorPickup(e.message || 'Autocomplete failed');
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
        setPlacesErrorDelivery(null);
        return;
      }
      if (!GOOGLE_MAPS_API_KEY) {
        setPlacesErrorDelivery('Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY or app.json googleMaps.apiKey');
        setDeliveryPredictions([]);
        return;
      }
      setPlacesLoadingDelivery(true);
      setPlacesErrorDelivery(null);
      try {
        const list = await fetchPlacePredictions(debouncedDelivery);
        if (!cancelled) setDeliveryPredictions(list);
      } catch (e) {
        if (!cancelled) {
          setPlacesErrorDelivery(e.message || 'Autocomplete failed');
          setDeliveryPredictions([]);
        }
      } finally {
        if (!cancelled) setPlacesLoadingDelivery(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedDelivery, focusedField]);

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

  const onSelectPickupPrediction = useCallback(
    async (p) => {
      Keyboard.dismiss();
      setPickupPredictions([]);
      setPlacesErrorPickup(null);
      try {
        const details = await fetchPlaceDetails(p.place_id);
        const addr = details.formatted_address || p.description || '';
        setPickupAddress(addr);
        const coord = { latitude: details.latitude, longitude: details.longitude };
        setPickupCoords(coord);
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
        setPlacesErrorPickup(e.message || 'Could not load place');
      }
    },
    [dropoffCoords, fitBothPins]
  );

  const onSelectDeliveryPrediction = useCallback(
    async (p) => {
      Keyboard.dismiss();
      setDeliveryPredictions([]);
      setPlacesErrorDelivery(null);
      try {
        const details = await fetchPlaceDetails(p.place_id);
        const addr = details.formatted_address || p.description || '';
        setDeliveryAddress(addr);
        setDropoffCoords({
          latitude: details.latitude,
          longitude: details.longitude,
        });
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
        setPlacesErrorDelivery(e.message || 'Could not load place');
      }
    },
    [pickupCoords, fitBothPins]
  );

  /** Manual only — fills pickup from GPS + reverse geocode. Never called on mount. */
  const useCurrentLocation = useCallback(async () => {
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
      if (dropoffCoords) {
        setTimeout(() => fitBothPins(), 650);
      }
    } catch (e) {
      setLocationError(e.message || 'Could not get location');
    } finally {
      setLocationBusy(false);
    }
  }, [dropoffCoords, fitBothPins]);

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

  const showPickupDropdown =
    focusedField === 'pickup' && debouncedPickup.trim().length >= 2;
  const showDeliveryDropdown =
    focusedField === 'delivery' && debouncedDelivery.trim().length >= 2;

  const canConfirm =
    pickupCoords &&
    dropoffCoords &&
    pickupAddress.trim().length > 0 &&
    deliveryAddress.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Clean white header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          mapType="standard"
          rotateEnabled
          pitchEnabled={false}
        >
          {pickupCoords && (
            <Marker coordinate={pickupCoords} title="Pickup" pinColor="#00C853" />
          )}
          {dropoffCoords && (
            <Marker coordinate={dropoffCoords} title="Delivery" pinColor="#FF3B30" />
          )}
          {polylineCoords && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor="#00C853"
              strokeWidth={3}
              lineDashPattern={[8, 6]}
            />
          )}
        </MapView>

        <View style={styles.topBanner} pointerEvents="box-none">
          {mapCentering ? (
            <View style={styles.topBannerInner}>
              <ActivityIndicator color="#00C853" size="small" />
              <Text style={[styles.topBannerText, { marginLeft: 8 }]}>Loading map…</Text>
            </View>
          ) : locationError ? (
            <View style={styles.topBannerInner}>
              <Text style={styles.topBannerError}>{locationError}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>

        {/* Uber-style address card with connected dots */}
        <View style={styles.addressCard}>
          <View style={styles.addressRow}>
            <View style={styles.dotGreen} />
            <TextInput
              style={styles.addressInput}
              placeholder="Pickup address"
              placeholderTextColor="#9E9E9E"
              value={pickupAddress}
              onChangeText={(t) => {
                setPickupAddress(t);
                if (!t.trim()) setPickupCoords(null);
              }}
              returnKeyType="search"
              onFocus={() => setFocusedField('pickup')}
              onBlur={() => {
                setTimeout(() => setFocusedField((f) => (f === 'pickup' ? null : f)), 220);
              }}
            />
          </View>

          <View style={styles.addressConnector} />

          <View style={styles.addressRow}>
            <View style={styles.dotBlack} />
            <TextInput
              style={styles.addressInput}
              placeholder="Dropoff address"
              placeholderTextColor="#9E9E9E"
              value={deliveryAddress}
              onChangeText={(t) => {
                setDeliveryAddress(t);
                if (!t.trim()) setDropoffCoords(null);
              }}
              returnKeyType="search"
              onFocus={() => setFocusedField('delivery')}
              onBlur={() => {
                setTimeout(() => setFocusedField((f) => (f === 'delivery' ? null : f)), 220);
              }}
            />
          </View>
        </View>

        {/* Pickup predictions */}
        {showPickupDropdown ? (
          <PredictionDropdown
            loading={placesLoadingPickup}
            predictions={pickupPredictions}
            error={placesErrorPickup}
            onSelect={onSelectPickupPrediction}
          />
        ) : null}

        {/* Delivery predictions */}
        {showDeliveryDropdown ? (
          <PredictionDropdown
            loading={placesLoadingDelivery}
            predictions={deliveryPredictions}
            error={placesErrorDelivery}
            onSelect={onSelectDeliveryPrediction}
          />
        ) : null}

        <TouchableOpacity
          style={styles.useLocationLink}
          onPress={useCurrentLocation}
          disabled={locationBusy || mapCentering}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Use current location for pickup"
        >
          {locationBusy ? (
            <ActivityIndicator color="#00C853" size="small" />
          ) : (
            <Text style={styles.useLocationLinkText}>📍 Use current location</Text>
          )}
        </TouchableOpacity>

        {/* Confirm card — slides up when both addresses set */}
        <Animated.View
          style={[styles.confirmCard, { transform: [{ translateY: confirmTranslateY }] }]}
        >
          {canConfirm ? (
            <>
              <View style={styles.confirmRow}>
                <View style={styles.greenDotSmall} />
                <Text style={styles.confirmAddr} numberOfLines={2}>
                  {pickupAddress.trim()}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <View style={styles.blackDotSmall} />
                <Text style={styles.confirmAddr} numberOfLines={2}>
                  {deliveryAddress.trim()}
                </Text>
              </View>
              <Text style={styles.distanceText}>
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)} m apart`
                  : `${distanceKm.toFixed(1)} km apart`}
              </Text>
              <TouchableOpacity
                style={[styles.continueButton, !canConfirm && styles.continueButtonDisabled]}
                onPress={handleConfirm}
                disabled={!canConfirm}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.confirmHint}>
              Select pickup and delivery from the suggestions, or use &quot;Use current location&quot; for pickup.
            </Text>
          )}
        </Animated.View>

      </View>
    </SafeAreaView>
  );
};

function PredictionDropdown({ loading, predictions, error, onSelect }) {
  return (
    <View style={styles.predictionsWrap}>
      {loading ? (
        <View style={styles.predictionsLoadingInner}>
          <ActivityIndicator color="#00C853" size="small" />
        </View>
      ) : error ? (
        <Text style={styles.predictionsError}>{error}</Text>
      ) : predictions.length === 0 ? (
        <Text style={styles.predictionsEmpty}>No addresses found</Text>
      ) : (
        <ScrollView
          style={styles.predictionsScroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {predictions.map((item, index) => (
            <TouchableOpacity
              key={item.place_id}
              style={[
                styles.predictionRow,
                index === predictions.length - 1 && styles.predictionRowLast,
              ]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.predictionMain} numberOfLines={2}>
                {item.structured_formatting?.main_text || item.description}
              </Text>
              <Text style={styles.predictionSub} numberOfLines={2}>
                {item.structured_formatting?.secondary_text || ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

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
    backgroundColor: '#FFFFFF',
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
  backButton: {
    padding: 8,
  },
  backArrow: {
    fontSize: 22,
    color: '#000000',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  mapWrap: {
    flex: 1,
    minHeight: height * 0.32,
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
    color: '#000000',
    fontWeight: '600',
  },
  topBannerError: {
    fontSize: 13,
    color: '#FF3B30',
  },
  bottomPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
    maxHeight: height * 0.58,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00C853',
    marginRight: 14,
    flexShrink: 0,
  },
  dotBlack: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#000000',
    marginRight: 14,
    flexShrink: 0,
  },
  addressConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginLeft: 5,
  },
  addressInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    paddingVertical: 2,
  },
  useLocationLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 6,
    minHeight: 24,
    justifyContent: 'center',
  },
  useLocationLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  predictionsWrap: {
    marginBottom: 6,
    maxHeight: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  predictionsScroll: {
    maxHeight: 200,
  },
  predictionsLoadingInner: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionsError: {
    color: '#FF3B30',
    fontSize: 13,
    padding: spacing.md,
  },
  predictionsEmpty: {
    color: '#9E9E9E',
    fontSize: 14,
    padding: spacing.md,
    textAlign: 'center',
  },
  predictionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  predictionRowLast: {
    borderBottomWidth: 0,
  },
  predictionMain: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  predictionSub: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  confirmCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: radius.md,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    backgroundColor: '#00C853',
    marginTop: 6,
    marginRight: 10,
    flexShrink: 0,
  },
  blackDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#000000',
    marginTop: 6,
    marginRight: 10,
    flexShrink: 0,
  },
  confirmAddr: {
    flex: 1,
    fontSize: 13,
    color: '#000000',
    lineHeight: 18,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00C853',
    marginBottom: 12,
    marginLeft: 18,
  },
  continueButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  confirmHint: {
    fontSize: 13,
    color: '#9E9E9E',
    textAlign: 'center',
    paddingVertical: spacing.sm,
    lineHeight: 18,
  },
});

export default AddressEntry;
