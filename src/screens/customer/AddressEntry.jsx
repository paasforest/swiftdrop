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
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY } from '../../placesConfig';

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

  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);

  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);

  const [predictions, setPredictions] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState(null);

  const debouncedDelivery = useDebounced(deliveryAddress, 350);

  const distanceKm = useMemo(
    () => (pickupCoords && dropoffCoords ? haversineKm(pickupCoords, dropoffCoords) : 0),
    [pickupCoords, dropoffCoords]
  );

  const openInitialLocation = useCallback(async () => {
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
      const region = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
      setPickupCoords({
        latitude: region.latitude,
        longitude: region.longitude,
      });
      mapRef.current?.animateToRegion(region, 600);
    } catch (e) {
      setLocationError(e.message || 'Could not get location');
      mapRef.current?.animateToRegion(DEFAULT_REGION, 400);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    openInitialLocation();
  }, [openInitialLocation]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!debouncedDelivery || debouncedDelivery.trim().length < 2) {
        setPredictions([]);
        setPlacesError(null);
        return;
      }
      if (!GOOGLE_MAPS_API_KEY) {
        setPlacesError('Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY or app.json googleMaps.apiKey');
        setPredictions([]);
        return;
      }
      setPlacesLoading(true);
      setPlacesError(null);
      try {
        const list = await fetchPlacePredictions(debouncedDelivery);
        if (!cancelled) setPredictions(list);
      } catch (e) {
        if (!cancelled) {
          setPlacesError(e.message || 'Autocomplete failed');
          setPredictions([]);
        }
      } finally {
        if (!cancelled) setPlacesLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedDelivery]);

  const reverseGeocodeCenter = useCallback((center) => {
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

  const onRegionChange = useCallback(() => {
    setIsDraggingMap(true);
  }, []);

  const onRegionChangeComplete = useCallback(
    (region) => {
      setIsDraggingMap(false);
      const center = {
        latitude: region.latitude,
        longitude: region.longitude,
      };
      setPickupCoords(center);
      reverseGeocodeCenter(center);
    },
    [reverseGeocodeCenter]
  );

  const fitBothPins = useCallback(() => {
    if (!mapRef.current || !pickupCoords || !dropoffCoords) return;
    mapRef.current.fitToCoordinates([pickupCoords, dropoffCoords], {
      edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
      animated: true,
    });
  }, [pickupCoords, dropoffCoords]);

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      const t = setTimeout(fitBothPins, 350);
      return () => clearTimeout(t);
    }
  }, [pickupCoords, dropoffCoords, fitBothPins]);

  useEffect(() => {
    if (dropoffCoords) {
      Animated.spring(cardSlideAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    } else {
      cardSlideAnim.setValue(0);
    }
  }, [dropoffCoords, cardSlideAnim]);

  const onSelectPrediction = useCallback(
    async (p) => {
      Keyboard.dismiss();
      setPredictions([]);
      setPlacesError(null);
      try {
        const details = await fetchPlaceDetails(p.place_id);
        setDeliveryAddress(p.description || details.formatted_address);
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
      } catch (e) {
        setPlacesError(e.message || 'Could not load place');
      }
    },
    []
  );

  const handleConfirm = () => {
    if (!pickupCoords || !dropoffCoords) return;
    const drop = deliveryAddress.trim();
    if (!drop || !pickupAddress.trim()) return;
    navigation.navigate('ParcelDescription', {
      pickup_address: pickupAddress.trim(),
      pickup_lat: pickupCoords.latitude,
      pickup_lng: pickupCoords.longitude,
      dropoff_address: drop,
      dropoff_lat: dropoffCoords.latitude,
      dropoff_lng: dropoffCoords.longitude,
    });
  };

  const confirmTranslateY = cardSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  const polylineCoords =
    pickupCoords && dropoffCoords
      ? [pickupCoords, dropoffCoords]
      : null;

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
          onRegionChange={onRegionChange}
          onRegionChangeComplete={onRegionChangeComplete}
          rotateEnabled
          pitchEnabled={false}
        >
          {dropoffCoords && (
            <Marker coordinate={dropoffCoords} title="Delivery" pinColor="#FF6B35" />
          )}
          {polylineCoords && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor="#1A73E8"
              strokeWidth={3}
              lineDashPattern={[8, 6]}
            />
          )}
        </MapView>

        {/* Fixed centre pickup pin (Uber-style): map moves underneath */}
        <View style={styles.centerPinContainer} pointerEvents="none">
          <View
            style={[
              styles.centerPinShadow,
              isDraggingMap && styles.centerPinShadowDragging,
            ]}
          />
          <View style={styles.centerPinMarker}>
            <View style={styles.greenPinDisc} />
            <View style={styles.greenPinTriangle} />
          </View>
        </View>

        <View style={styles.topBanner} pointerEvents="none">
          {locating ? (
            <View style={styles.topBannerInner}>
              <ActivityIndicator color="#1A73E8" size="small" />
              <Text style={[styles.topBannerText, { marginLeft: 8 }]}>
                Getting your location…
              </Text>
            </View>
          ) : locationError ? (
            <View style={styles.topBannerInner}>
              <Text style={styles.topBannerError}>⚠️ {locationError}</Text>
            </View>
          ) : reverseBusy ? (
            <View style={styles.topBannerInner}>
              <Text style={styles.topBannerSubtle}>Updating pickup address…</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={openInitialLocation}
          disabled={locating}
        >
          <Text style={styles.recenterBtnText}>⊙</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.inputBlock}>
          <View style={styles.row}>
            <View style={styles.greenDot} />
            <TextInput
              style={[styles.input, styles.inputReadonly]}
              value={pickupAddress || (locating ? '…' : 'Move map to set pickup')}
              editable={false}
              placeholder="Pickup"
              placeholderTextColor="#888"
            />
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
              placeholder="Where to?"
              placeholderTextColor="#888"
              returnKeyType="search"
            />
          </View>

          {placesError ? (
            <Text style={styles.placesErrorText}>{placesError}</Text>
          ) : null}

          {predictions.length > 0 && (
            <ScrollView
              style={styles.predictions}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {predictions.map((item) => (
                <TouchableOpacity
                  key={item.place_id}
                  style={styles.predictionRow}
                  onPress={() => onSelectPrediction(item)}
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

          {placesLoading ? (
            <ActivityIndicator style={{ marginTop: 8 }} color="#1A73E8" />
          ) : null}
        </View>

        <Animated.View
          style={[
            styles.confirmCard,
            { transform: [{ translateY: confirmTranslateY }] },
          ]}
        >
          {dropoffCoords ? (
            <>
              <View style={styles.confirmRow}>
                <View style={styles.greenDotSmall} />
                <Text style={styles.confirmAddr} numberOfLines={2}>
                  {pickupAddress || 'Pickup'}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <View style={styles.redDotSmall} />
                <Text style={styles.confirmAddr} numberOfLines={2}>
                  {deliveryAddress || 'Delivery'}
                </Text>
              </View>
              <Text style={styles.distanceText}>
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)} m apart`
                  : `${distanceKm.toFixed(1)} km apart`}
              </Text>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!pickupAddress.trim() || !deliveryAddress.trim()) &&
                    styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!pickupAddress.trim() || !deliveryAddress.trim()}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.confirmHint}>
              Search a delivery address to see route and confirm.
            </Text>
          )}
        </Animated.View>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
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

const PIN_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapWrap: {
    flex: 1,
    minHeight: height * 0.42,
  },
  centerPinContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: PIN_SIZE * 0.85,
  },
  centerPinShadow: {
    position: 'absolute',
    bottom: 4,
    width: 14,
    height: 6,
    borderRadius: 7,
    backgroundColor: '#000',
    opacity: 0.12,
  },
  centerPinShadowDragging: {
    opacity: 0.28,
    transform: [{ scaleX: 1.25 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  centerPinMarker: {
    marginTop: -36,
    alignItems: 'center',
  },
  greenPinDisc: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34A853',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  greenPinTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#34A853',
    marginTop: -2,
  },
  topBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 8 : 12,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  topBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: width - 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  topBannerText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
    marginLeft: 8,
  },
  topBannerSubtle: {
    fontSize: 13,
    color: '#666',
  },
  topBannerError: {
    fontSize: 13,
    color: '#c5221f',
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  recenterBtnText: {
    fontSize: 22,
    color: '#1A73E8',
    fontWeight: '700',
  },
  bottomPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
    maxHeight: height * 0.48,
  },
  inputBlock: {
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34A853',
    marginLeft: 12,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EA4335',
    marginLeft: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#202124',
  },
  inputReadonly: {
    color: '#5F6368',
  },
  predictions: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: '#E8EAED',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  predictionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EAED',
  },
  predictionMain: {
    fontSize: 15,
    color: '#202124',
    fontWeight: '500',
  },
  predictionSub: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 2,
  },
  placesErrorText: {
    color: '#c5221f',
    fontSize: 12,
    marginTop: 4,
  },
  confirmCard: {
    backgroundColor: '#F8FAFD',
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#D2E3FC',
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
    backgroundColor: '#34A853',
    marginTop: 6,
    marginRight: 10,
  },
  redDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EA4335',
    marginTop: 6,
    marginRight: 10,
  },
  confirmAddr: {
    flex: 1,
    fontSize: 14,
    color: '#202124',
    lineHeight: 20,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A73E8',
    marginBottom: 12,
    marginLeft: 18,
  },
  confirmButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmHint: {
    fontSize: 13,
    color: '#5F6368',
    textAlign: 'center',
    paddingVertical: 8,
  },
  backLink: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  backLinkText: {
    color: '#1A73E8',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AddressEntry;
