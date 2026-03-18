import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const AdminOverview = () => {
  const kpiData = {
    activeDeliveries: 12,
    onlineDrivers: 8,
    todayRevenue: 'R4,820',
    openDisputes: 2
  };

  const unmatchedJobs = [
    {
      id: '#JOB001',
      route: 'Worcester to Cape Town',
      urgency: 'High',
      time: '5 min ago'
    },
    {
      id: '#JOB002',
      route: 'Stellenbosch to Somerset West',
      urgency: 'Medium',
      time: '12 min ago'
    }
  ];

  const recentActivity = [
    {
      action: 'New driver registration',
      details: 'John D. - Cape Town',
      time: '2 min ago',
      type: 'driver'
    },
    {
      action: 'Delivery completed',
      details: 'Order #SD123 - R150',
      time: '5 min ago',
      type: 'delivery'
    },
    {
      action: 'Payment processed',
      details: 'Driver payout - R850',
      time: '8 min ago',
      type: 'payment'
    },
    {
      action: 'New dispute opened',
      details: 'Order #SD124 - Late delivery',
      time: '15 min ago',
      type: 'dispute'
    }
  ];

  const renderKPIs = () => (
    <View style={styles.kpiContainer}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiNumber}>{kpiData.activeDeliveries}</Text>
        <Text style={styles.kpiLabel}>Active Deliveries</Text>
        <View style={styles.kpiTrend}>
          <Text style={styles.trendIcon}>↑</Text>
          <Text style={styles.trendText}>+12%</Text>
        </View>
      </View>

      <View style={[styles.kpiCard, styles.kpiGreen]}>
        <Text style={styles.kpiNumber}>{kpiData.onlineDrivers}</Text>
        <Text style={styles.kpiLabel}>Online Drivers</Text>
        <View style={styles.kpiTrend}>
          <Text style={styles.trendIcon}>↑</Text>
          <Text style={styles.trendText}>+8%</Text>
        </View>
      </View>

      <View style={[styles.kpiCard, styles.kpiOrange]}>
        <Text style={styles.kpiNumber}>{kpiData.todayRevenue}</Text>
        <Text style={styles.kpiLabel}>Today Revenue</Text>
        <View style={styles.kpiTrend}>
          <Text style={styles.trendIcon}>↑</Text>
          <Text style={styles.trendText}>+23%</Text>
        </View>
      </View>

      <View style={[styles.kpiCard, styles.kpiRed]}>
        <Text style={styles.kpiNumber}>{kpiData.openDisputes}</Text>
        <Text style={styles.kpiLabel}>Open Disputes</Text>
        <View style={styles.kpiTrend}>
          <Text style={styles.trendIcon}>↓</Text>
          <Text style={styles.trendText}>-15%</Text>
        </View>
      </View>
    </View>
  );

  const renderLiveMap = () => (
    <View style={styles.mapContainer}>
      <Text style={styles.mapTitle}>Live Delivery Map</Text>
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapBackground}>
          {/* Simulated map elements */}
          <View style={[styles.mapDriver, { left: '20%', top: '30%' }]} />
          <View style={[styles.mapDriver, { left: '60%', top: '50%' }]} />
          <View style={[styles.mapDriver, { left: '40%', top: '70%' }]} />
          <View style={[styles.mapDriver, { left: '80%', top: '20%' }]} />
          
          <View style={[styles.mapDelivery, { left: '25%', top: '35%' }]} />
          <View style={[styles.mapDelivery, { left: '65%', top: '45%' }]} />
          <View style={[styles.mapDelivery, { left: '35%', top: '75%' }]} />
        </View>
      </View>
    </View>
  );

  const renderUnmatchedJobs = () => (
    <View style={styles.alertSection}>
      <Text style={styles.alertTitle}>Unmatched Jobs</Text>
      {unmatchedJobs.map((job) => (
        <View key={job.id} style={styles.alertItem}>
          <View style={styles.alertLeft}>
            <Text style={styles.alertId}>{job.id}</Text>
            <Text style={styles.alertRoute}>{job.route}</Text>
            <Text style={styles.alertTime}>{job.time}</Text>
          </View>
          <View style={[
            styles.urgencyBadge,
            job.urgency === 'High' ? styles.urgencyHigh : styles.urgencyMedium
          ]}>
            <Text style={styles.urgencyText}>{job.urgency}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderRecentActivity = () => (
    <View style={styles.activitySection}>
      <Text style={styles.activityTitle}>Recent Activity</Text>
      {recentActivity.map((activity, index) => (
        <View key={index} style={styles.activityItem}>
          <View style={[
            styles.activityIcon,
            activity.type === 'driver' && styles.iconDriver,
            activity.type === 'delivery' && styles.iconDelivery,
            activity.type === 'payment' && styles.iconPayment,
            activity.type === 'dispute' && styles.iconDispute
          ]}>
            <Text style={styles.activityIconText}>
              {activity.type === 'driver' ? '👤' :
               activity.type === 'delivery' ? '📦' :
               activity.type === 'payment' ? '💰' : '⚠️'}
            </Text>
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityAction}>{activity.action}</Text>
            <Text style={styles.activityDetails}>{activity.details}</Text>
            <Text style={styles.activityTime}>{activity.time}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard Overview</Text>
        <Text style={styles.headerDate}>{new Date().toLocaleDateString()}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* KPI Cards */}
        {renderKPIs()}

        {/* Live Map */}
        {renderLiveMap()}

        {/* Bottom Sections */}
        <View style={styles.bottomSections}>
          {/* Unmatched Jobs */}
          {renderUnmatchedJobs()}

          {/* Recent Activity */}
          {renderRecentActivity()}
        </View>
      </ScrollView>
    </View>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  headerDate: {
    fontSize: 14,
    color: '#666666',
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiGreen: {
    borderTopWidth: 4,
    borderTopColor: '#4CAF50',
  },
  kpiOrange: {
    borderTopWidth: 4,
    borderTopColor: '#FF6B35',
  },
  kpiRed: {
    borderTopWidth: 4,
    borderTopColor: '#F44336',
  },
  kpiNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  kpiTrend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    fontSize: 12,
    color: '#4CAF50',
    marginRight: 4,
  },
  trendText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  mapContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  mapPlaceholder: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  mapBackground: {
    flex: 1,
    backgroundColor: '#E8F4F8',
    position: 'relative',
  },
  mapDriver: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1A73E8',
  },
  mapDelivery: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35',
  },
  bottomSections: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 16,
  },
  alertSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  alertLeft: {
    flex: 1,
  },
  alertId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  alertRoute: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  alertTime: {
    fontSize: 11,
    color: '#999999',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgencyHigh: {
    backgroundColor: '#FFEBEE',
  },
  urgencyMedium: {
    backgroundColor: '#FFF3E0',
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  urgencyHigh: {
    color: '#F44336',
  },
  urgencyMedium: {
    color: '#FF9800',
  },
  activitySection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconDriver: {
    backgroundColor: '#E3F2FD',
  },
  iconDelivery: {
    backgroundColor: '#E8F5E8',
  },
  iconPayment: {
    backgroundColor: '#FFF3E0',
  },
  iconDispute: {
    backgroundColor: '#FFEBEE',
  },
  activityIconText: {
    fontSize: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  activityDetails: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    color: '#999999',
  },
});

export default AdminOverview;
