import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView, Switch } from 'react-native';

const { width, height } = Dimensions.get('window');

const DriverHome = () => {
  const [isOnline, setIsOnline] = useState(false);

  const driverInfo = {
    name: 'Sipho',
    rating: '4.8',
    photo: '👨‍💼'
  };

  const todayStats = {
    earnings: 'R340',
    deliveries: 3
  };

  const handleToggleOnline = () => {
    setIsOnline(!isOnline);
    console.log('Toggle online status:', !isOnline);
  };

  const handlePostRoute = () => {
    console.log('Post a route');
  };

  const handleViewJobs = () => {
    console.log('View available jobs');
  };

  const renderOnlineToggle = () => (
    <View style={styles.toggleContainer}>
      <View style={[
        styles.toggleCircle,
        isOnline ? styles.toggleCircleOnline : styles.toggleCircleOffline
      ]}>
        <View style={[
          styles.toggleIndicator,
          isOnline ? styles.toggleIndicatorOnline : styles.toggleIndicatorOffline
        ]} />
      </View>
      <Text style={[
        styles.toggleText,
        isOnline ? styles.toggleTextOnline : styles.toggleTextOffline
      ]}>
        {isOnline ? 'You are online' : 'You are offline — tap to go online'}
      </Text>
      {isOnline && (
        <View style={styles.pulsingDot} />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driverInfo.name}</Text>
            <Text style={styles.driverRating}>⭐ {driverInfo.rating}</Text>
          </View>
          <View style={styles.driverPhoto}>
            <Text style={styles.driverAvatar}>{driverInfo.photo}</Text>
          </View>
        </View>

        {/* Online/Offline Toggle */}
        <View style={styles.toggleSection}>
          {renderOnlineToggle()}
        </View>

        {/* Today's Earnings */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Today</Text>
          <Text style={styles.earningsAmount}>{todayStats.earnings}</Text>
          <Text style={styles.deliveriesCount}>
            {todayStats.deliveries} deliveries completed
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.postRouteButton}
            onPress={handlePostRoute}
          >
            <Text style={styles.postRouteText}>Post a Route</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.viewJobsButton}
            onPress={handleViewJobs}
          >
            <Text style={styles.viewJobsText}>View Available Jobs</Text>
          </TouchableOpacity>
        </View>

        {/* Rating Card */}
        <View style={styles.ratingCard}>
          <View style={styles.ratingHeader}>
            <Text style={styles.ratingTitle}>Your Rating</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>Trusted Driver</Text>
            </View>
          </View>
          
          <View style={styles.ratingStats}>
            <View style={styles.ratingItem}>
              <Text style={styles.ratingValue}>{driverInfo.rating}</Text>
              <Text style={styles.ratingLabel}>Average Rating</Text>
            </View>
            <View style={styles.ratingItem}>
              <Text style={styles.ratingValue}>127</Text>
              <Text style={styles.ratingLabel}>Total Deliveries</Text>
            </View>
            <View style={styles.ratingItem}>
              <Text style={styles.ratingValue}>98%</Text>
              <Text style={styles.ratingLabel}>On-Time Rate</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Text style={styles.activityIconText}>✓</Text>
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>Delivery completed</Text>
                <Text style={styles.activitySubtitle}>Worcester to Cape Town</Text>
                <Text style={styles.activityTime}>2 hours ago</Text>
              </View>
              <Text style={styles.activityAmount}>+R85</Text>
            </View>
            
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Text style={styles.activityIconText}>✓</Text>
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>Delivery completed</Text>
                <Text style={styles.activitySubtitle}>Stellenbosch to Somerset West</Text>
                <Text style={styles.activityTime}>5 hours ago</Text>
              </View>
              <Text style={styles.activityAmount}>+R120</Text>
            </View>
            
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Text style={styles.activityIconText}>✓</Text>
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>Delivery completed</Text>
                <Text style={styles.activitySubtitle}>Cape Town CBD to Sea Point</Text>
                <Text style={styles.activityTime}>Yesterday</Text>
              </View>
              <Text style={styles.activityAmount}>+R135</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navTextActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navText}>Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>💰</Text>
          <Text style={styles.navText}>Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navText}>Profile</Text>
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
    paddingBottom: 24,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  driverRating: {
    fontSize: 16,
    color: '#FFA500',
  },
  driverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatar: {
    fontSize: 24,
  },
  toggleSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  toggleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  toggleCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleCircleOffline: {
    backgroundColor: '#E0E0E0',
  },
  toggleCircleOnline: {
    backgroundColor: '#1A73E8',
  },
  toggleIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  toggleIndicatorOffline: {
    backgroundColor: '#666666',
  },
  toggleIndicatorOnline: {
    backgroundColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  toggleTextOffline: {
    color: '#666666',
  },
  toggleTextOnline: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    position: 'absolute',
    top: 10,
    right: 10,
  },
  earningsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  earningsLabel: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  deliveriesCount: {
    fontSize: 14,
    color: '#666666',
  },
  actionButtons: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  postRouteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  postRouteText: {
    color: '#1A73E8',
    fontSize: 16,
    fontWeight: '600',
  },
  viewJobsButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewJobsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ratingCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  tierBadge: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tierText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  ratingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ratingItem: {
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  recentSection: {
    paddingHorizontal: 20,
    marginBottom: 80,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityIconText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    color: '#999999',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
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

export default DriverHome;
