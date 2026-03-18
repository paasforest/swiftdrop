import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView, TextInput } from 'react-native';

const { width, height } = Dimensions.get('window');

const Home = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const deliveryTiers = [
    {
      id: 'standard',
      name: 'Standard',
      icon: '🕐',
      time: '2-5 hrs',
      price: 'From R80',
      color: '#4CAF50'
    },
    {
      id: 'express',
      name: 'Express',
      icon: '⚡',
      time: '1-2 hrs',
      price: 'From R150',
      color: '#1A73E8',
      popular: true
    },
    {
      id: 'urgent',
      name: 'Urgent',
      icon: '🔥',
      time: 'Under 1hr',
      price: 'From R280',
      color: '#FF6B35'
    }
  ];

  const recentDeliveries = [
    {
      id: 1,
      destination: '123 Main Street, Cape Town',
      date: 'Today, 2:30 PM',
      price: 'R200',
      status: 'Delivered'
    },
    {
      id: 2,
      destination: '456 Oak Avenue, Worcester',
      date: 'Yesterday, 10:15 AM',
      price: 'R120',
      status: 'Delivered'
    },
    {
      id: 3,
      destination: '789 Pine Road, Stellenbosch',
      date: 'Mar 15, 4:45 PM',
      price: 'R150',
      status: 'Delivered'
    }
  ];

  const handleNewDelivery = () => {
    // Start customer delivery flow
    navigation.navigate('AddressEntry');
  };

  const handleTierSelect = (tier) => {
    // Go to delivery tiers screen
    navigation.navigate('DeliveryTiers');
  };

  const handleDeliveryPress = (delivery) => {
    // Show tracking for this delivery
    navigation.navigate('Tracking');
  };

  const handleNotification = () => {
    console.log('Notifications pressed');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning, Thabo</Text>
            <Text style={styles.subtitle}>Ready to send something?</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={handleNotification}>
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity style={styles.searchBar} onPress={handleNewDelivery}>
          <Text style={styles.searchIcon}>📍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Where to deliver?"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={false}
          />
        </TouchableOpacity>

        {/* Delivery Tiers */}
        <View style={styles.tiersSection}>
          <Text style={styles.sectionTitle}>Choose Delivery Speed</Text>
          <View style={styles.tiersContainer}>
            {deliveryTiers.map((tier) => (
              <TouchableOpacity
                key={tier.id}
                style={styles.tierCard}
                onPress={() => handleTierSelect(tier)}
              >
                {tier.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Popular</Text>
                  </View>
                )}
                <Text style={styles.tierIcon}>{tier.icon}</Text>
                <Text style={styles.tierName}>{tier.name}</Text>
                <Text style={styles.tierTime}>{tier.time}</Text>
                <Text style={styles.tierPrice}>{tier.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Deliveries */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Deliveries</Text>
          {recentDeliveries.map((delivery) => (
            <TouchableOpacity
              key={delivery.id}
              style={styles.deliveryCard}
              onPress={() => handleDeliveryPress(delivery)}
            >
              <View style={styles.deliveryHeader}>
                <Text style={styles.deliveryDestination}>{delivery.destination}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>✓ {delivery.status}</Text>
                </View>
              </View>
              <View style={styles.deliveryFooter}>
                <Text style={styles.deliveryDate}>{delivery.date}</Text>
                <Text style={styles.deliveryPrice}>{delivery.price}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navTextActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Tracking')}>
          <Text style={styles.navIcon}>📍</Text>
          <Text style={styles.navText}>Track</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DriverHome')}>
          <Text style={styles.navIcon}>�</Text>
          <Text style={styles.navText}>Driver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AdminOverview')}>
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={styles.navText}>Admin</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: width,
    height: height,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationIcon: {
    fontSize: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  tiersSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  tiersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  tierIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  tierName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  tierTime: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A73E8',
  },
  recentSection: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  deliveryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  deliveryDestination: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginRight: 12,
  },
  statusBadge: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryDate: {
    fontSize: 14,
    color: '#666666',
  },
  deliveryPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A73E8',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: 20,
    paddingTop: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 24,
    color: '#666666',
    marginBottom: 4,
  },
  navIconActive: {
    fontSize: 24,
    color: '#1A73E8',
    marginBottom: 4,
  },
  navText: {
    fontSize: 12,
    color: '#666666',
  },
  navTextActive: {
    fontSize: 12,
    color: '#1A73E8',
    fontWeight: '600',
  },
});

export default Home;
