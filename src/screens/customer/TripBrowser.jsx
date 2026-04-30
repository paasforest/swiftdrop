import React, { useState } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';

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
          <Text style={styles.routeAddress} numberOfLines={1}>
            {trip.from_address}
          </Text>
          <View style={{ height: 12 }} />
          <Text style={styles.routeAddress} numberOfLines={1}>
            {trip.to_address}
          </Text>
        </View>
      </View>

      {/* Departure + pickup method */}
      <View style={styles.tripMeta}>
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

      {/* Book button */}
      <TouchableOpacity style={styles.bookButton} onPress={onBook}>
        <Text style={styles.bookButtonText}>Book this trip</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TripBrowser({ navigation }) {
  const [fromCity,       setFromCity]       = useState('');
  const [toCity,         setToCity]         = useState('');
  const [selectedDate,   setSelectedDate]   = useState(null);
  const [trips,          setTrips]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [searched,       setSearched]       = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error,          setError]          = useState(null);

  const auth = getAuth();

  async function searchTrips() {
    if (!fromCity.trim() || !toCity.trim()) {
      setError('Please enter both cities');
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(false);
    try {
      const params = new URLSearchParams({
        from_city: fromCity.trim(),
        to_city:   toCity.trim(),
        ...(selectedDate && {
          date: selectedDate.toISOString().split('T')[0],
        }),
      });
      const data = await getJson(
        `/api/trips/search?${params}`,
        { token: auth?.token }
      );
      setTrips(data.trips || []);
      setSearched(true);
    } catch {
      setError('Could not load trips. Try again.');
    } finally {
      setLoading(false);
    }
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
        <View style={styles.cityRow}>
          <View style={styles.dotGreen} />
          <TextInput
            style={styles.cityInput}
            placeholder="From city (e.g. Johannesburg)"
            value={fromCity}
            onChangeText={(text) => {
              setFromCity(text);
              setError(null);
            }}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View style={styles.dividerLine} />

        <View style={styles.cityRow}>
          <View style={styles.dotBlack} />
          <TextInput
            style={styles.cityInput}
            placeholder="To city (e.g. Polokwane)"
            value={toCity}
            onChangeText={(text) => {
              setToCity(text);
              setError(null);
            }}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={searchTrips}
          />
        </View>

        <TouchableOpacity
          style={styles.dateRow}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateLabel}>
            {'📅 '}
            {selectedDate
              ? selectedDate.toDateString()
              : 'Any date — tap to filter'}
          </Text>
          {selectedDate && (
            <TouchableOpacity
              onPress={() => setSelectedDate(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearDate}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate || new Date()}
            mode="date"
            minimumDate={new Date()}
            onChange={(event, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setSelectedDate(date);
            }}
          />
        )}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.searchButton, loading && { opacity: 0.6 }]}
          onPress={searchTrips}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.searchButtonText}>Search trips</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Empty state */}
      {searched && trips.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🚗</Text>
          <Text style={styles.emptyTitle}>No trips found</Text>
          <Text style={styles.emptySubtext}>
            No drivers heading that way yet.{'\n'}
            Check back soon or try different dates.
          </Text>
        </View>
      )}

      {/* Results */}
      {trips.length > 0 && (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TripCard trip={item} onBook={() => handleBookTrip(item)} />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    margin: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dotGreen: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#00C853', marginRight: 12,
  },
  dotBlack: {
    width: 12, height: 12, borderRadius: 3,
    backgroundColor: '#000', marginRight: 12,
  },
  cityInput:    { flex: 1, fontSize: 15, color: '#000' },
  dividerLine:  { height: 1, backgroundColor: '#F0F0F0', marginLeft: 24 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  dateLabel:  { fontSize: 13, color: '#757575' },
  clearDate:  { fontSize: 14, color: '#9E9E9E', padding: 4 },
  errorText:  { fontSize: 13, color: '#D32F2F', marginTop: 8, marginBottom: 4 },
  searchButton: {
    backgroundColor: '#000',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  searchButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  emptyState: { alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
  emptySubtext: {
    fontSize: 14, color: '#9E9E9E',
    textAlign: 'center', lineHeight: 20,
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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  driverInitial:  { fontSize: 18, fontWeight: '700', color: '#000' },
  driverName:     { fontSize: 15, fontWeight: '600', color: '#000' },
  ratingRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  star:           { fontSize: 12, color: '#FFB800' },
  rating:         { fontSize: 12, color: '#757575', marginLeft: 3 },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 6,
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
