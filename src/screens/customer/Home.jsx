import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { resetToLogin } from '../../navigationHelpers';

const { width, height } = Dimensions.get('window');

function firstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'there';
  return fullName.trim().split(/\s+/)[0] || 'there';
}

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

function humanStatus(status) {
  if (!status) return '';
  return String(status).replace(/_/g, ' ');
}

function greetingPrefix() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const Home = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [displayName, setDisplayName] = useState('there');
  const route = useRoute();
  const refundMessage = route?.params?.refundMessage;

  const deliveryTiers = [
    {
      id: 'standard',
      name: 'Standard',
      icon: '🕐',
      time: 'Estimated',
      price: 'Pricing shown next',
      color: '#4CAF50',
    },
    {
      id: 'express',
      name: 'Express',
      icon: '⚡',
      time: 'Estimated',
      price: 'Pricing shown next',
      color: '#1A73E8',
      popular: true,
    },
    {
      id: 'urgent',
      name: 'Urgent',
      icon: '🔥',
      time: 'Estimated',
      price: 'Pricing shown next',
      color: '#FF6B35',
    },
  ];

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
    }, [loadOrders])
  );

  const handleNewDelivery = () => {
    navigation.navigate('AddressEntry');
  };

  const handleTierSelect = () => {
    // Start the real address -> order flow
    navigation.navigate('AddressEntry');
  };

  const handleDeliveryPress = (order) => {
    const isCompleted = order?.status === 'delivered' || order?.status === 'completed';
    if (isCompleted) {
      navigation.navigate('OrderDetail', { orderId: order.id });
      return;
    }
    navigation.navigate('Tracking', { orderId: order.id });
  };

  const handleLogout = () => {
    resetToLogin(navigation);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {greetingPrefix()}, {displayName}
            </Text>
            <Text style={styles.subtitle}>Ready to send something?</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>

        {refundMessage ? (
          <View style={styles.refundBanner}>
            <Text style={styles.refundBannerText}>{refundMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.searchBar} onPress={handleNewDelivery}>
          <Text style={styles.searchIcon}>📍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Where to deliver?"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={false}
          />
        </TouchableOpacity>

        <View style={styles.tiersSection}>
          <Text style={styles.sectionTitle}>Choose Delivery Speed</Text>
          <View style={styles.tiersContainer}>
            {deliveryTiers.map((tier) => (
              <TouchableOpacity key={tier.id} style={styles.tierCard} onPress={handleTierSelect}>
                {tier.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Popular</Text>
                  </View>
                )}
                <Text style={styles.tierIcon}>{tier.icon}</Text>
                <Text style={styles.tierName}>{tier.name}</Text>
                <Text style={styles.tierTime}>{tier.time}</Text>
                <Text style={styles.tierPrice}>{tier.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Your deliveries</Text>
          {loadError ? (
            <Text style={styles.hintText}>{loadError}</Text>
          ) : null}
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#1A73E8" />
          ) : orders.length === 0 ? (
            <Text style={styles.hintText}>No deliveries yet. Start one with the address bar above.</Text>
          ) : (
            orders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.deliveryCard}
                onPress={() => handleDeliveryPress(order)}
              >
                <View style={styles.deliveryHeader}>
                  <Text style={styles.deliveryDestination} numberOfLines={2}>
                    {order.dropoff_address || 'Delivery'}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{humanStatus(order.status)}</Text>
                  </View>
                </View>
                <View style={styles.deliveryFooter}>
                  <Text style={styles.deliveryDate}>
                    {order.order_number}{' '}
                    {order.updated_at
                      ? new Date(order.updated_at).toLocaleString()
                      : ''}
                  </Text>
                  <Text style={styles.deliveryPrice}>{formatMoney(order.total_price)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navTextActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Tracking')}>
          <Text style={styles.navIcon}>📍</Text>
          <Text style={styles.navText}>Track</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
          <Text style={styles.navIcon}>🚪</Text>
          <Text style={styles.navText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width,
    height,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  logoutText: {
    fontSize: 14,
    color: '#d93025',
    fontWeight: '600',
  },
  refundBanner: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  refundBannerText: {
    fontSize: 14,
    color: '#1B5E20',
    fontWeight: '800',
    lineHeight: 18,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  tiersSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  hintText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  tiersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  tierIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  tierName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  tierTime: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A73E8',
  },
  recentSection: {
    paddingHorizontal: 20,
    paddingBottom: 88,
  },
  deliveryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  deliveryDestination: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginRight: 12,
  },
  statusBadge: {
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: '45%',
  },
  statusText: {
    color: '#1A73E8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  deliveryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryDate: {
    fontSize: 12,
    color: '#666666',
    flex: 1,
    marginRight: 8,
  },
  deliveryPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A73E8',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: 20,
    paddingTop: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 24,
    color: '#666666',
    marginBottom: 4,
  },
  navIconActive: {
    fontSize: 24,
    color: '#1A73E8',
    marginBottom: 4,
  },
  navText: {
    fontSize: 12,
    color: '#666666',
  },
  navTextActive: {
    fontSize: 12,
    color: '#1A73E8',
    fontWeight: '600',
  },
});

export default Home;
