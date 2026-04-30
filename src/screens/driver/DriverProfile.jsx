import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth, clearAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { BottomTabBar } from '../../components/ui';

function formatVehicle(p) {
  if (!p) return 'No vehicle on file.';
  const parts = [
    [p.vehicle_make, p.vehicle_model].filter(Boolean).join(' '),
    p.vehicle_year ? String(p.vehicle_year) : null,
    p.vehicle_color || null,
    p.vehicle_plate || null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No vehicle on file.';
}

const DriverProfile = ({ navigation }) => {
  const auth = getAuth();
  const user = auth?.user;

  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getAuth()?.token;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getJson('/api/driver/profile', { token }),
        getJson('/api/driver/earnings/summary', { token }),
        getJson('/api/orders/driver/dashboard', { token }),
      ]);
      setProfile(results[0].status === 'fulfilled' ? results[0].value : null);
      setSummary(results[1].status === 'fulfilled' ? results[1].value : null);
      setDashboard(results[2].status === 'fulfilled' ? results[2].value : null);
    } catch (e) {
      console.error('DriverProfile load:', e.message);
      setProfile(null);
      setSummary(null);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const ratingNum =
    profile?.current_rating != null
      ? Number(profile.current_rating)
      : dashboard?.current_rating != null
        ? Number(dashboard.current_rating)
        : null;
  const ratingLabel =
    ratingNum != null && Number.isFinite(ratingNum) ? `★ ${ratingNum.toFixed(1)}` : '★ —';

  const totalDeliveries =
    profile?.deliveries_completed != null
      ? Number(profile.deliveries_completed)
      : dashboard?.total_deliveries_completed != null
        ? Number(dashboard.total_deliveries_completed)
        : 0;

  const displayName = profile?.full_name || user?.full_name || 'Driver';
  const displayPhone = profile?.phone || user?.phone || '';

  const menuItems = [
    {
      icon: '💰',
      label: 'My earnings',
      onPress: () => navigation.navigate('EarningsScreen'),
    },
    {
      icon: '🛣️',
      label: 'My routes',
      onPress: () => navigation.navigate('PostRoute'),
    },
    {
      icon: '🚗',
      label: 'Vehicle details',
      onPress: () => {
        Alert.alert('Vehicle', formatVehicle(profile));
      },
    },
    {
      icon: '📞',
      label: 'Contact support',
      onPress: () => Linking.openURL('mailto:support@swiftdrop.co.za').catch(() => {}),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#000000" style={{ marginTop: 32 }} />
        ) : (
          <>
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{displayName?.[0]?.toUpperCase() || 'D'}</Text>
              </View>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.ratingLine}>{ratingLabel}</Text>
              <Text style={styles.userPhone}>{displayPhone}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>R{Number(summary?.all_time_total || 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>Total earned</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statNum}>R{Number(summary?.month_total || 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>This month</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statNum}>{totalDeliveries}</Text>
                <Text style={styles.statLabel}>Deliveries</Text>
              </View>
            </View>

            {menuItems.map((item) => (
              <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
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
          </>
        )}
      </ScrollView>

      <BottomTabBar navigation={navigation} variant="driver" active="profile" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingBottom: 88,
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
  scroll: {
    paddingBottom: 24,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
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
    marginBottom: 6,
  },
  ratingLine: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00C853',
    marginBottom: 6,
  },
  userPhone: {
    fontSize: 14,
    color: '#757575',
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
  },
  statNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#9E9E9E',
    fontWeight: '600',
    textAlign: 'center',
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

export default DriverProfile;
