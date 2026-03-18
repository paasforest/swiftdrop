import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, TextInput, ScrollView } from 'react-native';

const { width, height } = Dimensions.get('window');

const AddressEntry = () => {
  const [pickupAddress, setPickupAddress] = useState('Current Location');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const recentAddresses = [
    {
      id: 1,
      address: '123 Main Street, Cape Town',
      type: 'Home'
    },
    {
      id: 2,
      address: '456 Oak Avenue, Worcester',
      type: 'Work'
    },
    {
      id: 3,
      address: '789 Pine Road, Stellenbosch',
      type: 'Gym'
    }
  ];

  const searchSuggestions = [
    '123 Main Street, Cape Town',
    '456 Oak Avenue, Worcester',
    '789 Pine Road, Stellenbosch',
    '321 Beach Road, Bloubergstrand'
  ];

  const handleLocateMe = () => {
    console.log('Locate me pressed');
  };

  const handleAddressSelect = (address) => {
    setDeliveryAddress(address);
    setShowSearchSuggestions(false);
  };

  const handleRecentAddressSelect = (address) => {
    setDeliveryAddress(address);
  };

  const handleConfirmAddresses = () => {
    console.log('Confirm addresses:', { pickup: pickupAddress, delivery: deliveryAddress });
  };

  const handleBack = () => {
    console.log('Back pressed');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Background */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>📍 Map View</Text>
          <Text style={styles.mapSubtext}>South African streets</Text>
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
          {/* Pickup Address */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <View style={styles.greenDot} />
              <TextInput
                style={styles.input}
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="Pickup address"
              />
              <TouchableOpacity onPress={handleLocateMe}>
                <Text style={styles.locateIcon}>📍</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Connecting Line */}
          <View style={styles.connectingLine} />

          {/* Delivery Address */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <View style={styles.redDot} />
              <TextInput
                style={styles.input}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Enter delivery address"
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
              />
            </View>
          </View>
        </View>

        {/* Search Suggestions */}
        {showSearchSuggestions && (
          <View style={styles.suggestionsContainer}>
            {searchSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => handleAddressSelect(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Addresses */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Addresses</Text>
          {recentAddresses.map((address) => (
            <TouchableOpacity
              key={address.id}
              style={styles.recentAddressItem}
              onPress={() => handleRecentAddressSelect(address.address)}
            >
              <Text style={styles.addressIcon}>🕐</Text>
              <View style={styles.addressInfo}>
                <Text style={styles.addressText}>{address.address}</Text>
                <Text style={styles.addressType}>{address.type}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!deliveryAddress || deliveryAddress.trim() === '') && styles.confirmButtonDisabled
          ]}
          onPress={handleConfirmAddresses}
          disabled={!deliveryAddress || deliveryAddress.trim() === ''}
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
