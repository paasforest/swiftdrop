import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, Animated } from 'react-native';

const { width, height } = Dimensions.get('window');

const JobOffer = () => {
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [progressWidth] = useState(new Animated.Value(width - 40));

  const jobDetails = {
    pickup: '123 Main Street, Worcester',
    dropoff: '456 Oak Avenue, Cape Town',
    distance: '14.2 km',
    estimatedTime: '35 min',
    parcelType: 'Clothing — Medium size',
    earnings: 'R170'
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Animate progress bar
    Animated.timing(progressWidth, {
      toValue: 0,
      duration: 15000,
      useNativeDriver: false,
    }).start();

    return () => clearInterval(timer);
  }, []);

  const handleAcceptJob = () => {
    console.log('Job accepted:', jobDetails);
  };

  const handleDeclineJob = () => {
    console.log('Job declined');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Semi-transparent overlay */}
      <View style={styles.overlay} />
      
      {/* Bottom Sheet Modal */}
      <View style={styles.bottomSheet}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressWidth,
              },
            ]}
          />
        </View>

        {/* Title */}
        <Text style={styles.sheetTitle}>New Delivery Request</Text>

        {/* Map Snippet */}
        <View style={styles.mapSnippet}>
          <View style={styles.mapPlaceholder}>
            <View style={styles.routeLine} />
            <View style={[styles.pickupPin, { left: 80, top: 60 }]}>
              <View style={styles.pickupDot} />
            </View>
            <View style={[styles.dropoffPin, { left: 240, top: 40 }]}>
              <View style={styles.dropoffDot} />
            </View>
          </View>
        </View>

        {/* Job Details */}
        <View style={styles.jobDetails}>
          {/* Pickup Address */}
          <View style={styles.addressRow}>
            <View style={styles.addressIcon}>
              <View style={styles.greenDot} />
            </View>
            <Text style={styles.addressText}>{jobDetails.pickup}</Text>
          </View>

          {/* Dropoff Address */}
          <View style={styles.addressRow}>
            <View style={styles.addressIcon}>
              <View style={styles.redDot} />
            </View>
            <Text style={styles.addressText}>{jobDetails.dropoff}</Text>
          </View>

          {/* Distance */}
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🛣️</Text>
            <Text style={styles.detailText}>{jobDetails.distance}</Text>
          </View>

          {/* Time */}
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🕐</Text>
            <Text style={styles.detailText}>{jobDetails.estimatedTime}</Text>
          </View>

          {/* Parcel Type */}
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📦</Text>
            <Text style={styles.detailText}>{jobDetails.parcelType}</Text>
          </View>
        </View>

        {/* Earnings */}
        <View style={styles.earningsSection}>
          <Text style={styles.earningsLabel}>You earn</Text>
          <Text style={styles.earningsAmount}>{jobDetails.earnings}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleDeclineJob}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAcceptJob}
          >
            <Text style={styles.acceptText}>Accept Job</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    width: width,
    height: height,
    justifyContent: 'flex-end',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
  },
  mapSnippet: {
    height: 120,
    backgroundColor: '#E8F4F8',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    position: 'relative',
  },
  routeLine: {
    position: 'absolute',
    width: 2,
    height: 80,
    backgroundColor: '#1A73E8',
    left: 160,
    top: 20,
    transform: [{ rotate: '-20deg' }],
  },
  pickupPin: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pickupDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  dropoffPin: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dropoffDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
  },
  jobDetails: {
    marginBottom: 24,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B35',
  },
  addressText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  earningsSection: {
    backgroundColor: '#FFF3F0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  earningsLabel: {
    fontSize: 16,
    color: '#FF6B35',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  declineText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default JobOffer;
