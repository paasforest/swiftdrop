import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { useAuthStore } from '../../authStore';
import { getJson, clearAuth } from '../../apiClient';
import { theme } from '../../theme/theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstInitial(name) {
  return (name || 'U').trim()[0].toUpperCase();
}

function firstName(name) {
  return (name || '').split(' ')[0] || 'there';
}

function StatusPill({ status }) {
  const live = status === 'searching' || status === 'active' || status === 'in_transit';
  return (
    <View style={[styles.pill, live ? styles.pillLive : styles.pillDone]}>
      <Text style={[styles.pillText, live ? styles.pillTextLive : styles.pillTextDone]}>
        {live ? 'LIVE' : status === 'delivered' ? 'DELIVERED' : status?.toUpperCase() ?? 'UNKNOWN'}
      </Text>
    </View>
  );
}

export default function SenderHomeScreen({ navigation }) {
  const { user } = useAuthStore();
  const displayName = user?.full_name || user?.displayName || '';

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;
      const data = await getJson('/api/bookings/my-bookings', { token, quiet: true });
      setBookings(Array.isArray(data?.bookings) ? data.bookings : []);
    } catch {
      // silently fail — empty state handles it
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings(true);
  }, [fetchBookings]);

  const handleSignOut = async () => {
    await signOut(auth);
    clearAuth();
  };

  const renderBooking = ({ item }) => (
    <TouchableOpacity
      style={styles.bookingCard}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('TrackDriver', { booking: item })}
    >
      <View style={styles.bookingLeft}>
        <Text style={styles.bookingId}>#{String(item.id).padStart(4, '0')}</Text>
        <Text style={styles.bookingAddress} numberOfLines={1}>
          {item.dropoff_address || item.dropoffAddress || '—'}
        </Text>
      </View>
      <StatusPill status={item.status} />
    </TouchableOpacity>
  );

  const ListHeader = (
    <>
      {/* Hero CTA */}
      <TouchableOpacity
        style={styles.heroCard}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('NewBooking')}
      >
        <View style={styles.heroIconWrap}>
          <Text style={styles.heroIcon}>→</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Send a parcel</Text>
          <Text style={styles.heroSub}>Pickup in minutes</Text>
        </View>
        <Text style={styles.heroChevron}>›</Text>
      </TouchableOpacity>

      {/* Section label */}
      <Text style={styles.sectionLabel}>RECENT DELIVERIES</Text>
    </>
  );

  const ListEmpty = loading ? (
    <ActivityIndicator color={theme.colors.obsidian} style={{ marginTop: 40 }} />
  ) : (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>Your deliveries will appear here</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Dark header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>{greeting()},</Text>
          <Text style={styles.headerName}>{firstName(displayName)}</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onLongPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.avatarText}>{firstInitial(displayName)}</Text>
        </TouchableOpacity>
      </View>

      {/* Off-white body panel overlapping header */}
      <View style={styles.body}>
        <FlatList
          data={bookings}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderBooking}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.obsidian}
            />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.obsidian,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    backgroundColor: theme.colors.obsidian,
  },
  headerGreeting: {
    fontSize: 13,
    color: theme.colors.textOnDarkMuted,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  headerName: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.obsidian,
  },

  // Off-white body overlaps header by 20px
  body: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    overflow: 'hidden',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // Hero CTA card
  heroCard: {
    backgroundColor: theme.colors.obsidian,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.obsidian,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.2,
  },
  heroSub: {
    fontSize: 12,
    color: theme.colors.textOnDarkMuted,
    marginTop: 2,
  },
  heroChevron: {
    fontSize: 24,
    color: theme.colors.textOnDarkMuted,
    fontWeight: '300',
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.textMuted,
    marginBottom: 12,
  },

  // Booking card
  bookingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  bookingLeft: {
    flex: 1,
    marginRight: 12,
  },
  bookingId: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: theme.colors.textMuted,
    marginBottom: 3,
  },
  bookingAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },

  // Status pills
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillLive: {
    backgroundColor: theme.colors.obsidian,
  },
  pillDone: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  pillTextLive: {
    color: theme.colors.volt,
  },
  pillTextDone: {
    color: theme.colors.textMuted,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
