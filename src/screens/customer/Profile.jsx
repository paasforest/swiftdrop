import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { getAuth } from '../../authStore';
import { resetToLogin } from '../../navigationHelpers';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppText, AppButton, BottomTabBar } from '../../components/ui';
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
            {isDriver ? 'Driver' : role === 'admin' ? 'Admin' : 'Customer'}
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

        <AppButton label="Log out" variant="danger" onPress={handleLogout} />
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
});

export default Profile;
