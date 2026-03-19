import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, TextInput, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

const DEFAULT_REGION = { latitude: -33.9249, longitude: 18.4241, latitudeDelta: 0.4, longitudeDelta: 0.4 };

const AddressEntry = ({ navigation }) => {
  const [pickupAddress, setPickupAddress] = useState('Current Location');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const initialRegion = useMemo(() => {
    if (pickupCoords) {
      return {
        latitude: pickupCoords.latitude,
        longitude: pickupCoords.longitude,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };
    }
    return DEFAULT_REGION;
  }, [pickupCoords]);

  const fetchLocation = async () => {
    setLocationError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }
      const pos = await Location.getCurrentPositionAsync({});
      setPickupCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setPickupAddress('Current Location');
    } catch (e) {
      setLocationError(e.message || 'Could not get location');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocateMe = () => fetchLocation();

  const handleConfirmAddresses = () => {
    if (!pickupCoords || !dropoffCoords) return;
    const drop = deliveryAddress.trim();
    if (!drop) return;

    navigation.navigate('ParcelDescription', {
      pickup_address: pickupAddress,
      pickup_lat: pickupCoords.latitude,
      pickup_lng: pickupCoords.longitude,
      dropoff_address: drop,
      dropoff_lat: dropoffCoords.latitude,
      dropoff_lng: dropoffCoords.longitude,
    });
  };

  const handleBack = () => navigation.goBack();

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Background */}
      <View style={styles.mapContainer}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          onPress={(e) => {
            const c = e.nativeEvent.coordinate;
            setDropoffCoords({ latitude: c.latitude, longitude: c.longitude });
          }}
        >
          {pickupCoords && (
            <Marker coordinate={pickupCoords} title=\"Pickup\" pinColor=\"#4CAF50\" />
          )}
          {dropoffCoords && (
            <Marker coordinate={dropoffCoords} title=\"Dropoff\" pinColor=\"#FF6B35\" />
          )}
        </MapView>

        {/* Overlay hint */}
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>📍 Choose dropoff</Text>
          <Text style={styles.mapSubtext}>Tap the map to place the dropoff pin</Text>
          {locationError ? <Text style={styles.errorText}>⚠️ {locationError}</Text> : null}
          {locating ? <Text style={styles.errorText}>Loading location…</Text> : null}
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Enter Addresses</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Address Inputs */}
        <View style={styles.addressInputs}>
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <View style={styles.greenDot} />
              <TextInput
                style={styles.input}
                value={pickupAddress}
                editable={false}
                placeholder="Pickup address"
              />
              <TouchableOpacity onPress={handleLocateMe} disabled={locating}>
                <Text style={styles.locateIcon}>📍</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.connectingLine} />

          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <View style={styles.redDot} />
              <TextInput
                style={styles.input}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Enter delivery address (used for display)"
              />
            </View>
          </View>
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Dropoff pin status</Text>
          <Text style={styles.hintText}>
            {dropoffCoords ? 'Pin selected on map.' : 'Tap the map above to select a dropoff pin.'}
          </Text>
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!deliveryAddress ||
              deliveryAddress.trim() === '' ||
              !dropoffCoords ||
              !pickupCoords) &&
              styles.confirmButtonDisabled
          ]}
          onPress={handleConfirmAddresses}
          disabled={!deliveryAddress || deliveryAddress.trim() === '' || !dropoffCoords || !pickupCoords}
        >
          <Text style={styles.confirmButtonText}>Confirm Addresses</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    alignItems: 'center',
  },
  mapText: {
    fontSize: 24,
    color: '#1A73E8',
    marginBottom: 8,
  },
  mapSubtext: {
    fontSize: 14,
    color: '#666666',
  },
  errorText: {
    marginTop: 8,
    color: '#d93025',
    fontSize: 13,
    textAlign: 'center',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backArrow: {
    fontSize: 24,
    color: '#1A73E8',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 24,
  },
  addressInputs: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 4,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    marginHorizontal: 12,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B35',
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  locateIcon: {
    fontSize: 20,
    paddingHorizontal: 12,
  },
  connectingLine: {
    height: 20,
    width: 2,
    backgroundColor: '#E0E0E0',
    marginLeft: 30,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  suggestionsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 20,
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  recentSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  recentAddressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 8,
  },
  addressIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  addressType: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddressEntry;
