import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { resetToLogin } from '../../navigationHelpers';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { BottomTabBar } from '../../components/ui';
import AvatarPlaceholder from '../../components/AvatarPlaceholder';

const Profile = ({ navigation, route }) => {
  const auth = getAuth();
  const user = auth?.user;
  const isAdmin = user?.user_type === 'admin';
  const isDriver = user?.user_type === 'driver';

  const handleLogout = () => {
    resetToLogin(navigation);
  };

  const tabActive = 'profile';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AvatarPlaceholder size={72} />
          <Text style={styles.name}>{user?.full_name || 'Account'}</Text>
          <Text style={styles.email}>{user?.email || user?.phone || ''}</Text>
          <Text style={styles.role}>
            {isDriver ? 'Driver' : isAdmin ? 'Admin' : 'Customer'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Account</Text>
          <Text style={styles.cardBody}>
            Manage your profile and security in a future update.
          </Text>
        </View>

        <View style={styles.sessionCard}>
          <Text style={styles.sessionLabel}>Session</Text>
          <TouchableOpacity
            style={styles.logoutRow}
            onPress={handleLogout}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityHint="Signs out of your account on this device"
          >
            <View style={styles.logoutIconCircle}>
              <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            </View>
            <View style={styles.logoutTextBlock}>
              <Text style={styles.logoutTitle}>Log out</Text>
              <Text style={styles.logoutSub}>Sign out of this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
      {!isAdmin &&
        (isDriver ? (
          <BottomTabBar navigation={navigation} variant="driver" active={tabActive} />
        ) : (
          <BottomTabBar navigation={navigation} variant="customer" active={tabActive} />
        ))}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: 72,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  name: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  email: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  role: {
    marginTop: spacing.sm,
    textTransform: 'capitalize',
    fontSize: 12,
    color: colors.textMuted,
  },
  cardHeading: {
    marginBottom: spacing.sm,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  sessionCard: {
    marginBottom: spacing.lg,
  },
  sessionLabel: {
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  logoutIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  logoutTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  logoutTitle: {
    fontWeight: '600',
    marginBottom: 2,
    fontSize: 15,
    color: colors.textPrimary,
  },
  logoutSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default Profile;
