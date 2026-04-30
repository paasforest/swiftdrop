import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '📦',
    title: 'Deliver anything,\nanywhere',
    subtitle: 'Connect with drivers already going your way and get your parcels delivered fast.',
  },
  {
    icon: '📍',
    title: 'Track every step',
    subtitle: 'Live tracking from pickup to delivery — always know where your parcel is.',
  },
  {
    icon: '🔒',
    title: 'Safe & secure',
    subtitle: 'OTP confirmation and photo proof on every delivery for total peace of mind.',
  },
];

const Onboarding = ({ navigation }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goToSlide = (index) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setCurrentSlide(index);
  };

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      navigation.navigate('Login');
    }
  };

  const handleSkip = () => navigation.navigate('Login');

  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Skip */}
      <View style={styles.header}>
        {!isLast && (
          <TouchableOpacity onPress={handleSkip} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slide content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.brandName}>SwiftDrop</Text>
          <Text style={styles.brandTagline}>Deliver with people going your way</Text>
        </View>

        {/* Illustration placeholder */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>{slide.icon}</Text>
        </View>

        {/* Text */}
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
      </Animated.View>

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goToSlide(i)} hitSlop={8}>
            <View
              style={[
                styles.dot,
                i === currentSlide ? styles.dotActive : styles.dotInactive,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.continueButtonText}>
            {isLast ? 'Get started' : 'Next'}
          </Text>
        </TouchableOpacity>

        {isLast && (
          <TouchableOpacity onPress={handleSkip} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              Already have an account?{' '}
              <Text style={styles.loginLinkBold}>Log in</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 52,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 13,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  iconEmoji: {
    fontSize: 52,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#000000',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#E0E0E0',
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  continueButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  loginLinkBold: {
    color: '#000000',
    fontWeight: '600',
  },
});

export default Onboarding;
