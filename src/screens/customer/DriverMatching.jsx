import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, Animated } from 'react-native';

const { width, height } = Dimensions.get('window');

const DriverMatching = () => {
  const [animationValue] = useState(new Animated.Value(0));
  const [dotsAnimation] = useState(new Animated.Value(0));

  const orderDetails = {
    pickup: '123 Main Street, Worcester',
    dropoff: '456 Oak Avenue, Cape Town',
    deliveryType: 'Express',
    price: 'R200'
  };

  useEffect(() => {
    // Radar animation
    const radarAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animationValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(animationValue, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    radarAnimation.start();

    // Loading dots animation
    const dotsAnimationLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotsAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(dotsAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    dotsAnimationLoop.start();

    return () => {
      radarAnimation.stop();
      dotsAnimationLoop.stop();
    };
  }, []);

  const handleCancel = () => {
    console.log('Cancel order');
  };

  const renderDots = () => {
    const dots = ['•', '•', '•'];
    return dots.map((dot, index) => {
      const opacity = dotsAnimation.interpolate({
        inputRange: [0, 0.33, 0.66, 1],
        outputRange: [0.3, 1, 0.3, 0.3],
        extrapolate: 'clamp',
      });
      
      return (
        <Animated.Text
          key={index}
          style={[
            styles.loadingDot,
            {
              opacity: index === 0 ? opacity : index === 1 ? dotsAnimation : opacity,
              transform: [
                {
                  translateX: dotsAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, index * 2],
                  }),
                },
              ],
            },
          ]}
        >
          {dot}
        </Animated.Text>
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Animated Radar Background */}
      <View style={styles.radarContainer}>
        {[0, 1, 2].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.radarRing,
              {
                transform: [
                  {
                    scale: animationValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 2 + index * 0.5],
                    }),
                  },
                ],
                opacity: animationValue.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.8, 0.3, 0],
                }),
              },
            ]}
          />
        ))}
        
        {/* Center Parcel Icon */}
        <View style={styles.centerIcon}>
          <Text style={styles.parcelIcon}>📦</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.mainText}>Finding your driver...</Text>
        
        {/* Animated Loading Dots */}
        <View style={styles.dotsContainer}>
          {renderDots()}
        </View>
        
        <Text style={styles.subText}>Matching you with drivers nearby</Text>
      </View>

      {/* Order Summary Card */}
      <View style={styles.orderSummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>From:</Text>
          <Text style={styles.summaryText} numberOfLines={1}>
            {orderDetails.pickup}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>To:</Text>
          <Text style={styles.summaryText} numberOfLines={1}>
            {orderDetails.dropoff}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type:</Text>
          <Text style={styles.summaryText}>{orderDetails.deliveryType}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Price:</Text>
          <Text style={styles.summaryPrice}>{orderDetails.price}</Text>
        </View>
      </View>

      {/* Cancel Button */}
      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelText}>Cancel order</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#1A73E8',
    backgroundColor: 'transparent',
  },
  centerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  parcelIcon: {
    fontSize: 40,
    color: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mainText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingDot: {
    fontSize: 32,
    color: '#1A73E8',
    marginHorizontal: 2,
  },
  subText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  orderSummary: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666666',
    width: 60,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    textAlign: 'right',
    fontWeight: '500',
  },
  summaryPrice: {
    fontSize: 16,
    color: '#1A73E8',
    fontWeight: '600',
  },
  cancelButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: '#666666',
    textDecorationLine: 'underline',
  },
});

export default DriverMatching;
