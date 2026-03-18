import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const Onboarding = ({ navigation }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      title: 'Deliver Anything, Anywhere',
      subtitle: 'Connect with drivers already going your way',
      illustration: '📦'
    },
    {
      id: 2,
      title: 'Track Every Step',
      subtitle: 'Live tracking from pickup to delivery',
      illustration: '📍'
    },
    {
      id: 3,
      title: 'Safe & Secure',
      subtitle: 'OTP confirmation and photo proof on every delivery',
      illustration: '🛡️'
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const skipOnboarding = () => {
    navigation.navigate('Login');
  };

  const getStarted = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={skipOnboarding}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Illustration */}
        <Text style={styles.illustration}>{slides[currentSlide].illustration}</Text>
        
        {/* Title and subtitle */}
        <Text style={styles.title}>{slides[currentSlide].title}</Text>
        <Text style={styles.subtitle}>{slides[currentSlide].subtitle}</Text>
      </View>

      {/* Navigation dots */}
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index === currentSlide ? '#1A73E8' : '#E0E0E0' }
            ]}
          />
        ))}
      </View>

      {/* Bottom button */}
      <View style={styles.bottomContainer}>
        {currentSlide === slides.length - 1 ? (
          <TouchableOpacity style={styles.getStartedButton} onPress={getStarted}>
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextButton} onPress={nextSlide}>
            <Text style={styles.nextText}>Next</Text>
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
    width: width,
    height: height,
  },
  header: {
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingTop: 20,
  },
  skipText: {
    fontSize: 16,
    color: '#1A73E8',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  illustration: {
    fontSize: 120,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  nextButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  getStartedButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Onboarding;
