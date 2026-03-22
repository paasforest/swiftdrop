import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppButton } from '../../components/ui';
import ParcelLogoIcon from '../../components/auth/ParcelLogoIcon';
import { TERMS_PRIVACY_URL } from '../../config/legal';

const { width, height } = Dimensions.get('window');
const HEADER_H = height * 0.45;

export default function WelcomeScreen({ navigation }) {
  const [role, setRole] = useState('customer'); // 'customer' | 'driver'

  const openTerms = () => {
    Linking.openURL(TERMS_PRIVACY_URL).catch(() => {});
  };

  const onContinue = () => {
    if (role === 'customer') {
      navigation.navigate('Login');
    } else {
      navigation.navigate('DriverLogin');
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#1A73E8', '#1557B0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { height: HEADER_H }]}
      >
        <View style={styles.logoMark}>
          <ParcelLogoIcon size={28} color={colors.textWhite} />
        </View>
        <Text style={styles.brandTitle}>SwiftDrop</Text>
        <Text style={styles.tagline}>Deliver Anything. Same Day.</Text>
      </LinearGradient>

      <View style={styles.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.cardScroll}
        >
          <Text style={styles.welcomeTitle}>Welcome</Text>
          <Text style={styles.welcomeSub}>
            How would you like to use SwiftDrop?
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setRole('customer')}
            style={[
              styles.choiceCard,
              role === 'customer' && styles.choiceCustomerSelected,
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="person" size={22} color={colors.primary} />
            </View>
            <View style={styles.choiceMid}>
              <Text style={styles.choiceTitle}>I need a delivery</Text>
              <Text style={styles.choiceSub}>Send parcels same day</Text>
            </View>
            <View
              style={[
                styles.radioOuter,
                role === 'customer' && styles.radioOuterCustomerOn,
              ]}
            >
              {role === 'customer' ? (
                <Ionicons name="checkmark" size={14} color={colors.textWhite} />
              ) : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setRole('driver')}
            style={[
              styles.choiceCard,
              role === 'driver' && styles.choiceDriverSelected,
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="car-sport" size={22} color={colors.accent} />
            </View>
            <View style={styles.choiceMid}>
              <Text style={styles.choiceTitle}>I want to deliver</Text>
              <Text style={styles.choiceSub}>Earn money as a driver</Text>
            </View>
            <View
              style={[
                styles.radioOuter,
                role === 'driver' && styles.radioOuterDriverOn,
              ]}
            >
              {role === 'driver' ? (
                <Ionicons name="checkmark" size={14} color={colors.textWhite} />
              ) : null}
            </View>
          </TouchableOpacity>

          <AppButton label="Continue" variant="primary" onPress={onContinue} />

          <Text style={styles.legal}>
            By continuing you agree to our{' '}
            <Text style={styles.legalLink} onPress={openTerms}>
              Terms & Privacy Policy
            </Text>
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  gradient: {
    width,
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brandTitle: {
    color: colors.textWhite,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  tagline: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: spacing.md,
  },
  cardScroll: {
    paddingBottom: spacing.xl,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  choiceCustomerSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EBF5FB',
  },
  choiceDriverSelected: {
    borderColor: colors.accent,
    backgroundColor: '#FFF7ED',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceMid: {
    flex: 1,
    marginLeft: spacing.md,
  },
  choiceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  choiceSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterCustomerOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioOuterDriverOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  legal: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 16,
  },
  legalLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
