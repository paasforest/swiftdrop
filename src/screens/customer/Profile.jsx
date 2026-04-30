import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth, clearAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { BottomTabBar } from '../../components/ui';

const defaultStats = {
  total_orders: 0,
  total_spent: '0.00',
  wallet_balance: '0.00',
};

const Profile = ({ navigation }) => {
  const auth = getAuth();
  const user = auth?.user;
  const isAdmin = user?.user_type === 'admin';
  const isDriver = user?.user_type === 'driver';

  const [stats, setStats] = useState(defaultStats);
  const [statsLoading, setStatsLoading] = useState(false);

  useLayoutEffect(() => {
    if (isDriver) {
      navigation.replace('DriverProfile');
    }
  }, [isDriver, navigation]);

  const loadStats = useCallback(async () => {
    if (isDriver || isAdmin || user?.user_type !== 'customer') return;
    const token = getAuth()?.token;
    if (!token) return;
    setStatsLoading(true);
    try {
      const data = await getJson('/api/orders/customer/stats', { token });
      setStats({
        total_orders: Number(data.total_orders) || 0,
        total_spent: data.total_spent != null ? String(data.total_spent) : '0.00',
        wallet_balance: data.wallet_balance != null ? String(data.wallet_balance) : '0.00',
      });
    } catch {
      setStats(defaultStats);
    } finally {
      setStatsLoading(false);
    }
  }, [isDriver, isAdmin, user?.user_type]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  if (isDriver) {
    return <View style={styles.container} />;
  }

  const menuItems = [
    { icon: '📦', label: 'Order history', screen: 'OrderHistory' },
    { icon: '💳', label: 'Payment methods', screen: null, sub: 'Coming soon' },
    { icon: '🔔', label: 'Notifications', screen: null, sub: 'Coming soon' },
    { icon: '🛡️', label: 'Privacy policy', screen: null, sub: 'Opens in browser' },
    { icon: '📞', label: 'Contact support', screen: null, sub: 'support@swiftdrop.co.za' },
  ];

  const tabActive = 'profile';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{user?.full_name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.full_name || 'Account'}</Text>
          <Text style={styles.userPhone}>{user?.phone || ''}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
        </View>

        {!isAdmin ? (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              {statsLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Text style={styles.statNum}>{stats.total_orders}</Text>
                  <Text style={styles.statLabel}>Deliveries</Text>
                </>
              )}
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              {statsLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Text style={styles.statNum}>R{stats.total_spent}</Text>
                  <Text style={styles.statLabel}>Total spent</Text>
                </>
              )}
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              {statsLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Text style={styles.statNum}>R{stats.wallet_balance}</Text>
                  <Text style={styles.statLabel}>Wallet</Text>
                </>
              )}
            </View>
          </View>
        ) : null}

        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.menuItem}
            onPress={() => {
              if (item.screen) {
                navigation.navigate(item.screen);
              } else if (item.sub === 'Opens in browser') {
                Linking.openURL('https://swiftdrop.co.za/privacy').catch(() => {});
              } else if (item.label === 'Contact support') {
                Linking.openURL('mailto:support@swiftdrop.co.za').catch(() => {});
              }
            }}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.sub ? <Text style={styles.menuSub}>{item.sub}</Text> : null}
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            await clearAuth();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
      {!isAdmin ? <BottomTabBar navigation={navigation} variant="customer" active={tabActive} /> : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingBottom: 88,
  },
  scroll: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  menuSub: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 20,
    color: '#9E9E9E',
  },
  logoutButton: {
    margin: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF3B30',
  },
});

export default Profile;
