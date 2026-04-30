import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { registerForPushNotificationsAsync } from '../../services/pushNotificationService';
import { BottomTabBar } from '../../components/ui';

const COLORS = {
  black: '#000000',
  white: '#FFFFFF',
  green: '#00C853',
  greenLight: '#E8F5E9',
  grey1: '#F5F5F5',
  grey2: '#E0E0E0',
  grey3: '#9E9E9E',
  grey4: '#757575',
  grey5: '#333333',
};

function firstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'there';
  return fullName.trim().split(/\s+/)[0] || 'there';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatStatus(status) {
  const map = {
    pending: 'Finding driver',
    matching: 'Finding driver',
    accepted: 'Driver found',
    pickup_en_route: 'On the way',
    pickup_arrived: 'At pickup',
    collected: 'Collected',
    delivery_en_route: 'En route',
    delivery_arrived: 'Arriving',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ACTIVE_STATUSES = [
  'accepted',
  'pickup_en_route',
  'pickup_arrived',
  'collected',
  'delivery_en_route',
  'delivery_arrived',
];

const Home = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [displayName, setDisplayName] = useState('there');
  const route = useRoute();

  const loadOrders = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setLoading(false);
      setOrders([]);
      return;
    }
    setDisplayName(firstName(auth.user?.full_name));
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getJson('/api/orders/customer?limit=20', { token: auth.token });
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      setLoadError(e.message || 'Could not load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
      const auth = getAuth();
      // Guard: only register push notifications for customer accounts
      // to prevent "Drivers only" PATCH error on driver-specific FCM endpoints
      if (auth?.token && auth.user?.user_type === 'customer') {
        registerForPushNotificationsAsync().catch(() => {});
      }
    }, [loadOrders])
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header — clean white, no gradient */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, {displayName}
          </Text>
          <Text style={styles.subtitle}>Where are you sending today?</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {displayName?.[0]?.toUpperCase() || 'U'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {route.params?.refundMessage && (
          <View style={styles.refundBanner}>
            <Text style={styles.refundText}>{route.params.refundMessage}</Text>
          </View>
        )}

        {/* Search bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => navigation.navigate('AddressEntry')}
          activeOpacity={0.8}
        >
          <View style={styles.searchDot} />
          <Text style={styles.searchText}>Where to deliver?</Text>
          <View style={styles.searchArrow}>
            <Text style={styles.searchArrowText}>→</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>SEND A PARCEL</Text>

        {/* Two delivery option cards side by side */}
        <View style={styles.cardsRow}>

          {/* Local delivery — BLACK card */}
          <TouchableOpacity
            style={styles.localCard}
            onPress={() => navigation.navigate('AddressEntry')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardEmoji}>📦</Text>
            <Text style={styles.localCardTitle}>Local</Text>
            <Text style={styles.localCardTitle}>delivery</Text>
            <Text style={styles.localCardSub}>Same day in your city</Text>
          </TouchableOpacity>

          {/* Intercity delivery — GREY card */}
          <TouchableOpacity
            style={styles.intercityCard}
            onPress={() => navigation.navigate('TripBrowser')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardEmoji}>🚗</Text>
            <Text style={styles.intercityCardTitle}>Intercity</Text>
            <Text style={styles.intercityCardTitle}>delivery</Text>
            <Text style={styles.intercityCardSub}>Across SA with drivers</Text>
          </TouchableOpacity>

        </View>

        <Text style={styles.sectionLabel}>RECENT</Text>

        {loadError ? (
          <Text style={styles.errorText}>{loadError}</Text>
        ) : loading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={COLORS.green} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>📬</Text>
            </View>
            <Text style={styles.emptyText}>No deliveries yet</Text>
            <Text style={styles.emptySubtext}>Send your first parcel today</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AddressEntry')}
            >
              <Text style={styles.emptyButtonText}>Send a parcel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => {
                if (ACTIVE_STATUSES.includes(order.status)) {
                  navigation.navigate('Tracking', { orderId: order.id });
                } else {
                  navigation.navigate('OrderDetail', { orderId: order.id });
                }
              }}
            >
              <View style={styles.orderTop}>
                <Text style={styles.orderDest} numberOfLines={1}>
                  {order.dropoff_address}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    order.status === 'completed' || order.status === 'delivered'
                      ? styles.statusGreen
                      : styles.statusGrey,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      order.status === 'completed' || order.status === 'delivered'
                        ? styles.statusTextGreen
                        : styles.statusTextGrey,
                    ]}
                  >
                    {formatStatus(order.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.orderBottom}>
                <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                <Text style={styles.orderPrice}>
                  R{Number(order.total_price || 0).toFixed(2)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <BottomTabBar navigation={navigation} variant="customer" active="home" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  subtitle: {
    fontSize: 13,
    color: '#9E9E9E',
    marginTop: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  refundBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#00C853',
  },
  refundText: {
    color: '#00C853',
    fontSize: 13,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00C853',
    marginRight: 12,
  },
  searchText: {
    flex: 1,
    fontSize: 15,
    color: '#9E9E9E',
  },
  searchArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchArrowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  cardsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  localCard: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 20,
    padding: 20,
    minHeight: 160,
    justifyContent: 'flex-end',
  },
  cardEmoji: {
    fontSize: 32,
    marginBottom: 16,
  },
  localCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  localCardSub: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 6,
  },
  intercityCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 20,
    minHeight: 160,
    justifyContent: 'flex-end',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
  },
  intercityCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 22,
  },
  intercityCardSub: {
    fontSize: 11,
    color: '#757575',
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9E9E9E',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderDest: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusGreen: {
    backgroundColor: '#E8F5E9',
  },
  statusGrey: {
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextGreen: {
    color: '#00C853',
  },
  statusTextGrey: {
    color: '#757575',
  },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDate: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  orderPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
});

export default Home;
