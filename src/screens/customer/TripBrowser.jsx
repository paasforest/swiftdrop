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
  ScrollView,
  Alert,
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
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>FROM</Text>
            <TextInput
              style={styles.cityInput}
              placeholder="City or town"
              placeholderTextColor="#BDBDBD"
              value={fromCity}
              onChangeText={(text) => {
                setFromCity(text);
                setError(null);
              }}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
        </View>

        <View style={styles.swapRow}>
          <View style={styles.swapLine} />
          <TouchableOpacity
            style={styles.swapButton}
            onPress={() => {
              const temp = fromCity;
              setFromCity(toCity);
              setToCity(temp);
            }}
          >
            <Text style={styles.swapIcon}>⇅</Text>
          </TouchableOpacity>
          <View style={styles.swapLine} />
        </View>

        <View style={styles.cityRow}>
          <View style={styles.dotBlack} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>TO</Text>
            <TextInput
              style={styles.cityInput}
              placeholder="City or town"
              placeholderTextColor="#BDBDBD"
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
        </View>

        <TouchableOpacity
          style={styles.dateRow}
          onPress={() => setShowDatePicker(true)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>DEPARTURE DATE</Text>
            <Text style={styles.dateValue}>
              {selectedDate
                ? selectedDate.toLocaleDateString('en-ZA', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
                : 'Any date — tap to filter'}
            </Text>
          </View>
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

      {!searched && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 40,
          }}
        >
          <Text style={styles.sectionLabel}>POPULAR ROUTES</Text>
          {[
            { from: 'Johannesburg', to: 'Polokwane' },
            { from: 'Johannesburg', to: 'Durban' },
            { from: 'Cape Town', to: 'George' },
            { from: 'Johannesburg', to: 'Bloemfontein' },
            { from: 'Pretoria', to: 'Nelspruit' },
            { from: 'Cape Town', to: 'Worcester' },
            { from: 'Johannesburg', to: 'East London' },
            { from: 'Johannesburg', to: 'Kimberley' },
          ].map((route, i) => (
            <TouchableOpacity
              key={i}
              style={styles.popularRoute}
              onPress={() => {
                setFromCity(route.from);
                setToCity(route.to);
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
      )}

      {/* Empty state */}
      {searched && trips.length === 0 && (
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginBottom: 2,
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
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  swapButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  swapIcon: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
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
