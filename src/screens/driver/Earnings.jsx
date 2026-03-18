import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView } from 'react-native';

const { width, height } = Dimensions.get('window');

const Earnings = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');

  const todayStats = {
    total: 'R510',
    deliveries: 4,
    pendingPayout: 'R340',
    payoutDate: 'Tomorrow 9:00 AM',
    instantPayoutFee: 'R8'
  };

  const weeklyData = [
    { day: 'Mon', amount: 120 },
    { day: 'Tue', amount: 85 },
    { day: 'Wed', amount: 200 },
    { day: 'Thu', amount: 150 },
    { day: 'Fri', amount: 180 },
    { day: 'Sat', amount: 90 },
    { day: 'Sun', amount: 510, isToday: true }
  ];

  const deliveryHistory = [
    {
      id: '#SD2024031801',
      route: 'Worcester-CT',
      amount: 'R85',
      status: 'Paid',
      date: 'Today, 2:30 PM'
    },
    {
      id: '#SD2024031802',
      route: 'Stellenbosch-SW',
      amount: 'R120',
      status: 'Paid',
      date: 'Today, 11:15 AM'
    },
    {
      id: '#SD2024031803',
      route: 'CT CBD-SP',
      amount: 'R135',
      status: 'Paid',
      date: 'Today, 9:45 AM'
    },
    {
      id: '#SD2024031804',
      route: 'Paarl-Worcester',
      amount: 'R170',
      status: 'Pending',
      date: 'Today, 8:20 AM'
    },
    {
      id: '#SD2024031701',
      route: 'Cape Town-Durbanville',
      amount: 'R95',
      status: 'Paid',
      date: 'Yesterday, 6:00 PM'
    },
    {
      id: '#SD2024031702',
      route: 'Bellville-Parow',
      amount: 'R75',
      status: 'Paid',
      date: 'Yesterday, 3:30 PM'
    }
  ];

  const handlePeriodSelect = (period) => {
    setSelectedPeriod(period);
  };

  const handleInstantPayout = () => {
    console.log('Request instant payout with fee:', todayStats.instantPayoutFee);
  };

  const handleApprovePayout = (jobId) => {
    console.log('Approve payout for job:', jobId);
  };

  const renderPeriodTabs = () => (
    <View style={styles.tabsContainer}>
      {['Today', 'This Week', 'This Month'].map((period) => (
        <TouchableOpacity
          key={period.toLowerCase().replace(' ', '')}
          style={[
            styles.tab,
            selectedPeriod === period.toLowerCase().replace(' ', '') && styles.tabActive
          ]}
          onPress={() => handlePeriodSelect(period.toLowerCase().replace(' ', ''))}
        >
          <Text style={[
            styles.tabText,
            selectedPeriod === period.toLowerCase().replace(' ', '') && styles.tabTextActive
          ]}>
            {period}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTodayView = () => (
    <View>
      {/* Total Earnings */}
      <View style={styles.totalEarnings}>
        <Text style={styles.totalLabel}>Total Earnings</Text>
        <Text style={styles.totalAmount}>{todayStats.total}</Text>
        <Text style={styles.deliveriesCount}>
          {todayStats.deliveries} deliveries completed
        </Text>
      </View>

      {/* Pending Payout */}
      <View style={styles.payoutCard}>
        <Text style={styles.payoutTitle}>Pending Payout</Text>
        <Text style={styles.payoutAmount}>{todayStats.pendingPayout}</Text>
        <Text style={styles.payoutDate}>
          Payout date: {todayStats.payoutDate}
        </Text>
        
        <TouchableOpacity
          style={styles.instantPayoutButton}
          onPress={handleInstantPayout}
        >
          <Text style={styles.instantPayoutText}>
            Get Paid Now — {todayStats.instantPayoutFee} fee
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weekly Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Weekly Earnings</Text>
        <View style={styles.chartContainer}>
          {weeklyData.map((data, index) => (
            <View key={data.day} style={styles.chartBar}>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    { height: (data.amount / 510) * 120 },
                    data.isToday && styles.barToday
                  ]}
                />
              </View>
              <Text style={[
                styles.barLabel,
                data.isToday && styles.barLabelToday
              ]}>
                {data.day}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderDeliveryHistory = () => (
    <View style={styles.historySection}>
      <Text style={styles.sectionTitle}>Delivery History</Text>
      
      {deliveryHistory.map((delivery) => (
        <View key={delivery.id} style={styles.historyItem}>
          <View style={styles.historyLeft}>
            <Text style={styles.jobId}>{delivery.id}</Text>
            <Text style={styles.route}>{delivery.route}</Text>
            <Text style={styles.date}>{delivery.date}</Text>
          </View>
          <View style={styles.historyRight}>
            <Text style={styles.amount}>{delivery.amount}</Text>
            <View style={[
              styles.statusBadge,
              delivery.status === 'Paid' ? styles.statusPaid : styles.statusPending
            ]}>
              <Text style={[
                styles.statusText,
                delivery.status === 'Paid' ? styles.statusTextPaid : styles.statusTextPending
              ]}>
                {delivery.status}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Earnings</Text>
        </View>

        {/* Period Tabs */}
        {renderPeriodTabs()}

        {/* Content based on selected period */}
        <View style={styles.content}>
          {selectedPeriod === 'today' && renderTodayView()}
          {selectedPeriod === 'thisweek' && (
            <View style={styles.placeholderView}>
              <Text style={styles.placeholderText}>This week earnings view</Text>
            </View>
          )}
          {selectedPeriod === 'thismonth' && (
            <View style={styles.placeholderView}>
              <Text style={styles.placeholderText}>This month earnings view</Text>
            </View>
          )}
        </View>

        {/* Delivery History */}
        {renderDeliveryHistory()}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navText}>Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>💰</Text>
          <Text style={styles.navTextActive}>Earnings</Text>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#1A73E8',
  },
  tabText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
  },
  totalEarnings: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  deliveriesCount: {
    fontSize: 14,
    color: '#666666',
  },
  payoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  payoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  payoutAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A73E8',
    marginBottom: 4,
  },
  payoutDate: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  instantPayoutButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  instantPayoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  chartSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  bar: {
    width: 20,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  barToday: {
    backgroundColor: '#1A73E8',
  },
  barLabel: {
    fontSize: 12,
    color: '#666666',
  },
  barLabelToday: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  placeholderView: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
  },
  historySection: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyLeft: {
    flex: 1,
  },
  jobId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  route: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#999999',
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPaid: {
    backgroundColor: '#E8F5E8',
  },
  statusPending: {
    backgroundColor: '#E8F4FF',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextPaid: {
    color: '#4CAF50',
  },
  statusTextPending: {
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

export default Earnings;
