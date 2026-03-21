import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { resetToLogin } from '../../navigationHelpers';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppText, BottomTabBar } from '../../components/ui';
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
          <AppText variant="h2" color="textPrimary" style={styles.name}>
            {user?.full_name || 'Account'}
          </AppText>
          <AppText variant="body" color="textSecondary">
            {user?.email || user?.phone || ''}
          </AppText>
          <AppText variant="small" color="textLight" style={styles.role}>
            {isDriver ? 'Driver' : isAdmin ? 'Admin' : 'Customer'}
          </AppText>
        </View>

        <View style={styles.card}>
          <AppText variant="h4" color="textPrimary" style={{ marginBottom: spacing.sm }}>
            Account
          </AppText>
          <AppText variant="small" color="textSecondary">
            Manage your profile and security in a future update.
          </AppText>
        </View>

        <View style={styles.sessionCard}>
          <AppText variant="label" color="textLight" style={styles.sessionLabel}>
            Session
          </AppText>
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
              <AppText variant="body" color="textPrimary" style={styles.logoutTitle}>
                Log out
              </AppText>
              <AppText variant="small" color="textSecondary">
                Sign out of this device
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
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
  },
  role: {
    marginTop: spacing.sm,
    textTransform: 'capitalize',
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
    backgroundColor: `${colors.danger}18`,
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
  },
});

export default Profile;
