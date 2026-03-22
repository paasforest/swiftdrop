import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { colors, spacing, radius } from '../../theme/theme';
import { AppText, AppButton } from '../../components/ui';
import { OnboardingSlideArt } from '../../components/onboarding/OnboardingArt';

const { width, height } = Dimensions.get('window');

const Onboarding = ({ navigation }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      title: 'Deliver anything, anywhere',
      subtitle: 'Connect with drivers already going your way',
    },
    {
      id: 2,
      title: 'Track every step',
      subtitle: 'Live tracking from pickup to delivery',
    },
    {
      id: 3,
      title: 'Safe & secure',
      subtitle: 'OTP confirmation and photo proof on every delivery',
    },
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const skipOnboarding = () => {
    navigation.navigate('Welcome');
  };

  const getStarted = () => {
    navigation.navigate('Welcome');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={skipOnboarding} hitSlop={12}>
          <AppText variant="body" color="primary" style={{ fontWeight: '600' }}>
            Skip
          </AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.artWrap}>
          <OnboardingSlideArt index={currentSlide} />
        </View>
        <AppText variant="h1" color="textPrimary" style={styles.title}>
          {slides[currentSlide].title}
        </AppText>
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          {slides[currentSlide].subtitle}
        </AppText>
      </View>

      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index === currentSlide ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>

      <View style={styles.bottomContainer}>
        {currentSlide === slides.length - 1 ? (
          <AppButton label="Get started" variant="primary" onPress={getStarted} />
        ) : (
          <AppButton label="Next" variant="primary" onPress={nextSlide} />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    width,
    minHeight: height,
  },
  header: {
    alignItems: 'flex-end',
    paddingRight: spacing.lg,
    paddingTop: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  artWrap: {
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: spacing.xs,
  },
  bottomContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});

export default Onboarding;
