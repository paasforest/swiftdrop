import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, Animated } from 'react-native';

const { width, height } = Dimensions.get('window');

const Tracking = () => {
  const [eta, setEta] = useState('8 min away');
  const [driverPosition] = useState(new Animated.ValueXY({ x: 100, y: 200 }));

  const driverInfo = {
    name: 'Sipho M.',
    rating: '4.8',
    vehicle: 'Toyota Corolla',
    plate: 'CA 123-456',
    photo: '👨‍💼'
  };

  const orderDetails = {
    from: '123 Main Street, Worcester',
    to: '456 Oak Avenue, Cape Town',
    parcelType: 'Clothing — Medium',
    deliveryType: 'Express'
  };

  useEffect(() => {
    // Simulate driver movement
    const moveDriver = () => {
      Animated.timing(driverPosition, {
        toValue: { x: 150, y: 180 },
        duration: 3000,
        useNativeDriver: false,
      }).start(() => {
        setTimeout(moveDriver, 1000);
      });
    };
    
    // moveDriver();
  }, []);

  const handleCall = () => {
    console.log('Call driver');
  };

  const handleChat = () => {
    console.log('Chat with driver');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map View */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          {/* Route Line */}
          <View style={styles.routeLine} />
          
          {/* Driver Position */}
          <Animated.View
            style={[
              styles.driverMarker,
              {
                transform: [
                  { translateX: driverPosition.x },
                  { translateY: driverPosition.y },
                ],
              },
            ]}
          >
            <Text style={styles.driverIcon}>🚗</Text>
          </Animated.View>
          
          {/* Pickup Location */}
          <View style={[styles.pickupMarker, { left: 200, top: 150 }]}>
            <View style={styles.pickupDot} />
          </View>
          
          {/* Destination */}
          <View style={[styles.destinationMarker, { left: 280, top: 100 }]}>
            <View style={styles.destinationDot} />
          </View>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Driver Info */}
        <View style={styles.driverInfo}>
          <View style={styles.driverPhoto}>
            <Text style={styles.driverAvatar}>{driverInfo.photo}</Text>
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driverInfo.name}</Text>
            <Text style={styles.driverRating}>⭐ {driverInfo.rating}</Text>
            <Text style={styles.driverVehicle}>
              {driverInfo.vehicle} • {driverInfo.plate}
            </Text>
          </View>
        </View>

        {/* Status Banner */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>Driver is on the way to pickup</Text>
          <Text style={styles.etaText}>• {eta}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Text style={styles.actionIcon}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleChat}>
            <Text style={styles.actionIcon}>💬</Text>
          </TouchableOpacity>
        </View>

        {/* Delivery Details */}
        <View style={styles.deliveryDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>From:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {orderDetails.from}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>To:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {orderDetails.to}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Parcel:</Text>
            <Text style={styles.detailValue}>{orderDetails.parcelType}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type:</Text>
            <View style={styles.deliveryTypeBadge}>
              <Text style={styles.deliveryTypeText}>{orderDetails.deliveryType}</Text>
            </View>
          </View>
        </View>
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
  mapContainer: {
    flex: 1,
    backgroundColor: '#E8F4F8',
  },
  mapPlaceholder: {
    flex: 1,
    position: 'relative',
  },
  routeLine: {
    position: 'absolute',
    width: 2,
    height: 150,
    backgroundColor: '#1A73E8',
    left: 150,
    top: 100,
    transform: [{ rotate: '-30deg' }],
  },
  driverMarker: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  driverIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  pickupMarker: {
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
  destinationMarker: {
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
  destinationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  driverAvatar: {
    fontSize: 24,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  driverRating: {
    fontSize: 14,
    color: '#FFA500',
    marginBottom: 2,
  },
  driverVehicle: {
    fontSize: 14,
    color: '#666666',
  },
  statusBanner: {
    backgroundColor: '#E8F4FF',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A73E8',
    flex: 1,
  },
  etaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A73E8',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
  },
  deliveryDetails: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    width: 60,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    textAlign: 'right',
    fontWeight: '500',
  },
  deliveryTypeBadge: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliveryTypeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default Tracking;
