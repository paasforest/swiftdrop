import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '../../components/GradientHeader';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { registerForPushNotificationsAsync } from '../../services/pushNotificationService';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppText, BottomTabBar, StatusBadge } from '../../components/ui';

function firstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'there';
  return fullName.trim().split(/\s+/)[0] || 'there';
}

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

function greetingPrefix() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const TIER_ICONS = {
  standard: { name: 'time-outline', color: colors.success },
  express: { name: 'flash-outline', color: colors.primary },
  urgent: { name: 'flame-outline', color: colors.accent },
};

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
      time: 'Estimated',
      price: 'Pricing shown next',
      key: 'standard',
    },
    {
      id: 'express',
      name: 'Express',
      time: 'Estimated',
      price: 'Pricing shown next',
      popular: true,
      key: 'express',
    },
    {
      id: 'urgent',
      name: 'Urgent',
      time: 'Estimated',
      price: 'Pricing shown next',
      key: 'urgent',
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
      const auth = getAuth();
      if (auth?.token) {
        registerForPushNotificationsAsync().catch(() => {});
      }
    }, [loadOrders])
  );

  const handleNewDelivery = () => {
    navigation.navigate('AddressEntry');
  };

  const handleTierSelect = () => {
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

  return (
    <SafeAreaView style={styles.container}>
      <GradientHeader>
        <View style={styles.heroInner}>
          <View style={{ flex: 1 }}>
            <AppText variant="h2" color="textWhite">
              {greetingPrefix()}, {displayName}
            </AppText>
            <AppText variant="small" color="textWhite" style={styles.heroSubtitle}>
              Ready to send something?
            </AppText>
          </View>
        </View>
      </GradientHeader>

      <ScrollView showsVerticalScrollIndicator={false}>
        {refundMessage ? (
          <View style={styles.refundBanner}>
            <AppText variant="small" style={styles.refundBannerText}>
              {refundMessage}
            </AppText>
          </View>
        ) : null}

        <TouchableOpacity style={styles.searchBar} onPress={handleNewDelivery} activeOpacity={0.92}>
          <Ionicons name="location-outline" size={24} color={colors.textWhite} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Where to deliver?"
            placeholderTextColor="rgba(255,255,255,0.85)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={false}
          />
        </TouchableOpacity>

        <View style={styles.tiersSection}>
          <AppText variant="h3" color="textPrimary" style={styles.sectionTitle}>
            Choose delivery speed
          </AppText>
          <View style={styles.tiersContainer}>
            {deliveryTiers.map((tier) => {
              const ic = TIER_ICONS[tier.id];
              return (
                <TouchableOpacity key={tier.id} style={styles.tierCard} onPress={handleTierSelect} activeOpacity={0.85}>
                  {tier.popular && (
                    <View style={styles.popularBadge}>
                      <AppText variant="label" style={styles.popularText}>
                        Popular
                      </AppText>
                    </View>
                  )}
                  <Ionicons name={ic.name} size={32} color={ic.color} style={styles.tierIcon} />
                  <AppText variant="small" color="textPrimary" style={styles.tierName}>
                    {tier.name}
                  </AppText>
                  <AppText variant="small" color="textSecondary">
                    {tier.time}
                  </AppText>
                  <AppText variant="small" color="primary" style={styles.tierPrice}>
                    {tier.price}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.recentSection}>
          <AppText variant="h3" color="textPrimary" style={styles.sectionTitle}>
            Your deliveries
          </AppText>
          {loadError ? (
            <AppText variant="small" color="danger" style={styles.hintText}>
              {loadError}
            </AppText>
          ) : null}
          {loading ? (
            <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.primary} />
          ) : orders.length === 0 ? (
            <AppText variant="body" color="textSecondary" style={styles.hintText}>
              No deliveries yet. Start one with the address bar above.
            </AppText>
          ) : (
            orders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.deliveryCard}
                onPress={() => handleDeliveryPress(order)}
                activeOpacity={0.85}
              >
                <View style={styles.deliveryHeader}>
                  <Text style={styles.deliveryDestination} numberOfLines={2}>
                    {order.dropoff_address || 'Delivery'}
                  </Text>
                  <StatusBadge status={order.status} />
                </View>
                <View style={styles.deliveryFooter}>
                  <Text style={styles.deliveryDate}>
                    {order.order_number}{' '}
                    {order.updated_at ? new Date(order.updated_at).toLocaleString() : ''}
                  </Text>
                  <Text style={styles.deliveryPrice}>{formatMoney(order.total_price)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <BottomTabBar navigation={navigation} variant="customer" active="home" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: 72,
  },
  heroInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSubtitle: {
    marginTop: spacing.xs,
    opacity: 0.92,
  },
  refundBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.sm + 6,
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    opacity: 0.95,
  },
  refundBannerText: {
    color: colors.success,
    fontWeight: '700',
    lineHeight: 18,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    ...shadows.card,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textWhite,
  },
  tiersSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  hintText: {
    marginBottom: spacing.sm,
  },
  tiersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    ...shadows.card,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  popularText: {
    color: colors.textWhite,
    fontSize: 10,
  },
  tierIcon: {
    marginBottom: spacing.sm,
  },
  tierName: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  tierPrice: {
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  recentSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  deliveryCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  deliveryDestination: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  deliveryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryDate: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  deliveryPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default Home;
