import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  Alert,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { fetchPlacePredictions, fetchPlaceDetails } from '../../services/googlePlaces';

// ─── Inner component ──────────────────────────────────────────────────────────

function TripCard({ trip, onBook }) {
  const slotsRemaining = trip.slots_remaining;
  const isAlmostFull   = slotsRemaining === 1;

  return (
    <TouchableOpacity
      style={styles.tripCard}
      onPress={onBook}
      activeOpacity={0.8}
    >
      {/* Driver info row */}
      <View style={styles.driverRow}>
        <View style={styles.driverAvatar}>
          <Text style={styles.driverInitial}>
            {trip.driver_name?.[0] || 'D'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{trip.driver_name}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.star}>★</Text>
            <Text style={styles.rating}>
              {Number(trip.driver_rating || 0).toFixed(1)}
            </Text>
            <Text style={styles.verifiedBadge}>· ✓ Verified</Text>
          </View>
        </View>
        <View style={[styles.slotsBadge, isAlmostFull && styles.slotsBadgeWarning]}>
          <Text style={[styles.slotsText, isAlmostFull && styles.slotsTextWarning]}>
            {slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} left
          </Text>
        </View>
      </View>

      {/* Route row */}
      <View style={styles.routeRow}>
        <View style={styles.routeDots}>
          <View style={styles.routeDotGreen} />
          <View style={styles.routeLine} />
          <View style={styles.routeDotBlack} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.cityName} numberOfLines={1}>
            {trip.from_city || trip.from_address?.split(',')[0]}
          </Text>
          <Text style={styles.routeAddress} numberOfLines={1}>
            {trip.from_address}
          </Text>
          <View style={{ height: 12 }} />
          <Text style={styles.cityName} numberOfLines={1}>
            {trip.to_city || trip.to_address?.split(',')[0]}
          </Text>
          <Text style={styles.routeAddress} numberOfLines={1}>
            {trip.to_address}
          </Text>
        </View>
      </View>

      {/* Departure + pickup method + radius */}
      <View style={styles.tripMeta}>
        <View style={styles.tripMetaRow}>
          <Text style={styles.metaText}>
            {'🕐 '}
            {new Date(trip.departure_time).toLocaleDateString('en-ZA', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          <Text style={styles.metaText}>
            {trip.pickup_method === 'driver_collects'
              ? '🚗 Driver collects'
              : '📦 Drop off to driver'}
          </Text>
        </View>
        {trip.delivery_radius_km != null && Number(trip.delivery_radius_km) > 0 ? (
          <View style={styles.radiusBadge}>
            <Text style={styles.radiusBadgeText}>
              📍 Delivers within {trip.delivery_radius_km}km of destination
            </Text>
          </View>
        ) : null}
      </View>

      {/* Book button */}
      <TouchableOpacity style={styles.bookButton} onPress={onBook}>
        <Text style={styles.bookButtonText}>Book this trip</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const POPULAR_ROUTES = [
  { from: 'Johannesburg', to: 'Cape Town' },
  { from: 'Cape Town', to: 'Johannesburg' },
  { from: 'Johannesburg', to: 'Polokwane' },
  { from: 'Polokwane', to: 'Johannesburg' },
  { from: 'Johannesburg', to: 'Durban' },
  { from: 'Durban', to: 'Johannesburg' },
  { from: 'Cape Town', to: 'George' },
  { from: 'Cape Town', to: 'Port Elizabeth' },
  { from: 'Johannesburg', to: 'Bloemfontein' },
  { from: 'Johannesburg', to: 'Nelspruit' },
  { from: 'Pretoria', to: 'Polokwane' },
  { from: 'Johannesburg', to: 'East London' },
];

export default function TripBrowser({ navigation }) {
  const toInputRef = useRef(null);
  const fromSuggestSeq = useRef(0);
  const toSuggestSeq = useRef(0);

  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [fromLat, setFromLat] = useState(null);
  const [fromLng, setFromLng] = useState(null);
  const [toLat, setToLat] = useState(null);
  const [toLng, setToLng] = useState(null);

  const [selectedDate, setSelectedDate] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState(null);

  const auth = getAuth();

  async function fetchFromSuggestions(text) {
    if (text.length < 2) {
      setFromSuggestions([]);
      return;
    }
    const seq = ++fromSuggestSeq.current;
    try {
      const results = await fetchPlacePredictions(text);
      if (seq !== fromSuggestSeq.current) return;
      setFromSuggestions(results);
    } catch {
      if (seq !== fromSuggestSeq.current) return;
      setFromSuggestions([]);
    }
  }

  async function fetchToSuggestions(text) {
    if (text.length < 2) {
      setToSuggestions([]);
      return;
    }
    const seq = ++toSuggestSeq.current;
    try {
      const results = await fetchPlacePredictions(text);
      if (seq !== toSuggestSeq.current) return;
      setToSuggestions(results);
    } catch {
      if (seq !== toSuggestSeq.current) return;
      setToSuggestions([]);
    }
  }

  async function selectFromPlace(place) {
    Keyboard.dismiss();
    try {
      const details = await fetchPlaceDetails(place.place_id);
      setFromCity(
        place.structured_formatting?.main_text || place.description
      );
      setFromLat(details.latitude);
      setFromLng(details.longitude);
      setFromSuggestions([]);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load place details.');
    }
  }

  async function selectToPlace(place) {
    Keyboard.dismiss();
    try {
      const details = await fetchPlaceDetails(place.place_id);
      setToCity(
        place.structured_formatting?.main_text || place.description
      );
      setToLat(details.latitude);
      setToLng(details.longitude);
      setToSuggestions([]);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load place details.');
    }
  }

  function coordsReady(lat, lng) {
    return (
      lat != null &&
      lng != null &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng))
    );
  }

  async function searchTripsWithCities(from, to, fLat, fLng, tLat, tLng) {
    const fromTrim = String(from || '').trim();
    const toTrim = String(to || '').trim();
    if (!fromTrim || !toTrim) {
      setError('Please enter both cities');
      return;
    }
    setFromCity(fromTrim);
    setToCity(toTrim);
    setLoading(true);
    setError(null);
    setSearched(false);
    try {
      const params = new URLSearchParams({
        from_city: fromTrim,
        to_city: toTrim,
        ...(coordsReady(fLat, fLng) && {
          from_lat: String(fLat),
          from_lng: String(fLng),
        }),
        ...(coordsReady(tLat, tLng) && {
          to_lat: String(tLat),
          to_lng: String(tLng),
        }),
        ...(selectedDate && {
          date: selectedDate.toISOString().split('T')[0],
        }),
      });
      const data = await getJson(`/api/trips/search?${params}`, {
        token: auth?.token,
      });
      setTrips(data.trips || []);
      setSearched(true);
    } catch {
      setError('Could not load trips.');
    } finally {
      setLoading(false);
    }
  }

  async function searchTrips() {
    await searchTripsWithCities(
      fromCity,
      toCity,
      fromLat,
      fromLng,
      toLat,
      toLng
    );
  }

  function handleBookTrip(trip) {
    navigation.navigate('TripBookingConfirm', { trip });
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find a trip</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search card */}
      <View style={styles.searchCard}>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>YOUR AREA</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="e.g. Turfloop, Soweto, Sandton"
            placeholderTextColor="#BDBDBD"
            value={fromCity}
            onChangeText={(text) => {
              setFromCity(text);
              setFromLat(null);
              setFromLng(null);
              setError(null);
              setSearched(false);
              fetchFromSuggestions(text);
            }}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => toInputRef.current?.focus()}
          />
          {fromSuggestions.length > 0 ? (
            <View style={styles.suggestionsList}>
              {fromSuggestions.map((place) => (
                <TouchableOpacity
                  key={place.place_id}
                  style={styles.suggestionItem}
                  onPress={() => selectFromPlace(place)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionMain}>
                    {place.structured_formatting?.main_text || place.description}
                  </Text>
                  <Text style={styles.suggestionSub}>
                    {place.structured_formatting?.secondary_text || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.swapRow}>
          <View style={styles.swapLine} />
          <TouchableOpacity
            style={styles.swapBtn}
            onPress={() => {
              const temp = fromCity;
              setFromCity(toCity);
              setToCity(temp);
              const tLatSwap = fromLat;
              const tLngSwap = fromLng;
              setFromLat(toLat);
              setFromLng(toLng);
              setToLat(tLatSwap);
              setToLng(tLngSwap);
              const fs = fromSuggestions;
              setFromSuggestions(toSuggestions);
              setToSuggestions(fs);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.swapBtnIcon}>⇅</Text>
          </TouchableOpacity>
          <View style={styles.swapLine} />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>DESTINATION AREA</Text>
          <TextInput
            ref={toInputRef}
            style={styles.fieldInput}
            placeholder="e.g. Polokwane, Durban, Cape Town"
            placeholderTextColor="#BDBDBD"
            value={toCity}
            onChangeText={(text) => {
              setToCity(text);
              setToLat(null);
              setToLng(null);
              setError(null);
              setSearched(false);
              fetchToSuggestions(text);
            }}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={searchTrips}
          />
          {toSuggestions.length > 0 ? (
            <View style={styles.suggestionsList}>
              {toSuggestions.map((place) => (
                <TouchableOpacity
                  key={place.place_id}
                  style={styles.suggestionItem}
                  onPress={() => selectToPlace(place)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionMain}>
                    {place.structured_formatting?.main_text || place.description}
                  </Text>
                  <Text style={styles.suggestionSub}>
                    {place.structured_formatting?.secondary_text || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.fieldDivider} />

        <View style={styles.datePickerRow}>
          <TouchableOpacity
            style={styles.datePickerTouchable}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.datePickerIcon}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>TRAVEL DATE</Text>
              <Text style={styles.datePickerValue}>
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-ZA', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Any date'}
              </Text>
            </View>
          </TouchableOpacity>
          {selectedDate ? (
            <TouchableOpacity
              onPress={() => setSelectedDate(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.clearDateBtn}>✕</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.dateArrowIcon}>›</Text>
          )}
        </View>

        {showDatePicker ? (
          <DateTimePicker
            value={selectedDate || new Date()}
            mode="date"
            minimumDate={new Date()}
            onChange={(event, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setSelectedDate(date);
            }}
          />
        ) : null}

        {error ? <Text style={styles.searchError}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.searchBtn, loading && { opacity: 0.6 }]}
          onPress={searchTrips}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>🔍 Search trips</Text>
          )}
        </TouchableOpacity>
      </View>

      {!searched ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 40,
          }}
        >
          <Text style={styles.sectionLabel}>POPULAR ROUTES</Text>
          {POPULAR_ROUTES.map((route, i) => (
            <TouchableOpacity
              key={`${route.from}-${route.to}-${i}`}
              style={styles.popularRoute}
              onPress={() => {
                setFromLat(null);
                setFromLng(null);
                setToLat(null);
                setToLng(null);
                setFromSuggestions([]);
                setToSuggestions([]);
                searchTripsWithCities(route.from, route.to);
              }}
            >
              <Text style={styles.popularRouteIcon}>🚗</Text>
              <Text style={styles.popularRouteText}>
                {route.from} → {route.to}
              </Text>
              <Text style={styles.popularRouteArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {/* Empty state */}
      {searched && trips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No trips found</Text>
          <Text style={styles.emptySubtext}>
            No drivers heading that way yet.{'\n'}
            Try different dates or check back soon.
          </Text>
          <TouchableOpacity
            style={styles.notifyButton}
            onPress={() =>
              Alert.alert(
                'Coming soon',
                'We will notify you when a driver posts this route.',
                [{ text: 'OK' }]
              )
            }
          >
            <Text style={styles.notifyButtonText}>Notify me when available</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Results */}
      {trips.length > 0 ? (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id.toString()}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <TripCard trip={item} onBook={() => handleBookTrip(item)} />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton:   { padding: 8 },
  backArrow:    { fontSize: 22, color: '#000' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: '#000' },
  searchCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  fieldContainer: {
    paddingVertical: 8,
    paddingRight: 0,
    zIndex: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9E9E9E',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  fieldInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    paddingVertical: 4,
  },
  suggestionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 4,
    marginBottom: 8,
    overflow: 'hidden',
    zIndex: 100,
    elevation: Platform.OS === 'android' ? 4 : 0,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  suggestionSub: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    zIndex: 1,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  swapBtnIcon: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '700',
  },
  fieldDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  datePickerTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  datePickerIcon: { fontSize: 20 },
  datePickerValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  clearDateBtn: {
    fontSize: 16,
    color: '#9E9E9E',
    padding: 4,
  },
  dateArrowIcon: {
    fontSize: 22,
    color: '#9E9E9E',
  },
  searchError: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: 4,
    marginBottom: 4,
  },
  searchBtn: {
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  emptyState: { alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
  emptySubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
  },
  notifyButton: {
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  notifyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 8,
  },
  popularRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  popularRouteIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  popularRouteText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  popularRouteArrow: {
    fontSize: 18,
    color: '#9E9E9E',
  },
  tripCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  driverRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  driverInitial: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  star: { fontSize: 12, color: '#FFB800' },
  rating: { fontSize: 12, color: '#757575', marginLeft: 3 },
  verifiedBadge: {
    fontSize: 11,
    color: '#00C853',
    fontWeight: '600',
    marginLeft: 4,
  },
  slotsBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  slotsBadgeWarning: { backgroundColor: '#FFF3E0' },
  slotsText:         { fontSize: 12, fontWeight: '600', color: '#2E7D32' },
  slotsTextWarning:  { color: '#E65100' },
  routeRow:   { flexDirection: 'row', marginBottom: 12 },
  routeDots:  { alignItems: 'center', width: 16 },
  cityName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  routeDotGreen: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#00C853',
  },
  routeLine: {
    width: 2, height: 20, backgroundColor: '#E0E0E0', marginVertical: 2,
  },
  routeDotBlack: {
    width: 10, height: 10, borderRadius: 2, backgroundColor: '#000',
  },
  routeAddress: { fontSize: 13, color: '#333' },
  tripMeta: {
    marginBottom: 14,
    gap: 8,
  },
  tripMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  radiusBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  radiusBadgeText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '600',
  },
  metaText:        { fontSize: 12, color: '#757575' },
  bookButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  bookButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
