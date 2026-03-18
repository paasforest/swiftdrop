import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';

const { width, height } = Dimensions.get('window');

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState('overview');
  const [dateRange, setDateRange] = useState('last7days');

  const reportTypes = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'revenue', label: 'Revenue', icon: '💰' },
    { id: 'deliveries', label: 'Deliveries', icon: '📦' },
    { id: 'drivers', label: 'Drivers', icon: '👥' },
    { id: 'customers', label: 'Customers', icon: '👤' },
    { id: 'disputes', label: 'Disputes', icon: '⚠️' }
  ];

  const dateRanges = [
    { id: 'today', label: 'Today' },
    { id: 'last7days', label: 'Last 7 Days' },
    { id: 'last30days', label: 'Last 30 Days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'custom', label: 'Custom' }
  ];

  const overviewData = {
    totalRevenue: 'R45,680',
    totalDeliveries: 324,
    activeDrivers: 48,
    newCustomers: 89,
    avgDeliveryTime: '32 min',
    completionRate: '94.5%',
    totalDisputes: 12,
    avgRating: '4.7'
  };

  const revenueData = [
    { date: '2024-03-12', revenue: 5680, deliveries: 42 },
    { date: '2024-03-13', revenue: 6230, deliveries: 48 },
    { date: '2024-03-14', revenue: 5890, deliveries: 44 },
    { date: '2024-03-15', revenue: 7120, deliveries: 52 },
    { date: '2024-03-16', revenue: 6450, deliveries: 47 },
    { date: '2024-03-17', revenue: 7890, deliveries: 58 },
    { date: '2024-03-18', revenue: 6420, deliveries: 33 }
  ];

  const deliveryData = {
    total: 324,
    completed: 306,
    cancelled: 12,
    disputed: 6,
    byTier: {
      standard: { count: 156, percentage: 48.1 },
      express: { count: 120, percentage: 37.0 },
      urgent: { count: 48, percentage: 14.8 }
    },
    byCity: [
      { city: 'Cape Town', count: 142, percentage: 43.8 },
      { city: 'Worcester', count: 68, percentage: 21.0 },
      { city: 'Stellenbosch', count: 52, percentage: 16.0 },
      { city: 'Somerset West', count: 38, percentage: 11.7 },
      { city: 'Other', count: 24, percentage: 7.5 }
    ]
  };

  const driverData = {
    total: 48,
    activeToday: 32,
    newThisMonth: 8,
    avgRating: 4.7,
    avgDeliveriesPerDriver: 6.8,
    topPerformers: [
      { name: 'Sipho M.', deliveries: 18, rating: 4.9, earnings: 'R1,530' },
      { name: 'John D.', deliveries: 15, rating: 4.8, earnings: 'R1,275' },
      { name: 'Mary J.', deliveries: 14, rating: 4.9, earnings: 'R1,190' },
      { name: 'David R.', deliveries: 12, rating: 4.7, earnings: 'R1,020' },
      { name: 'Lisa S.', deliveries: 11, rating: 4.8, earnings: 'R935' }
    ]
  };

  const customerData = {
    total: 892,
    newThisMonth: 89,
    activeThisMonth: 234,
    repeatRate: '68%',
    avgOrdersPerCustomer: 3.2,
    bySource: [
      { source: 'App Store', count: 456, percentage: 51.1 },
      { source: 'Play Store', count: 382, percentage: 42.8 },
      { source: 'Referral', count: 54, percentage: 6.1 }
    ]
  };

  const disputeData = {
    total: 12,
    open: 3,
    resolved: 7,
    escalated: 2,
    byReason: [
      { reason: 'Damaged parcel', count: 5, percentage: 41.7 },
      { reason: 'Late delivery', count: 3, percentage: 25.0 },
      { reason: 'Wrong item', count: 2, percentage: 16.7 },
      { reason: 'Poor service', count: 1, percentage: 8.3 },
      { reason: 'Other', count: 1, percentage: 8.3 }
    ],
    resolutionTime: {
      avg: '18.5 hours',
      under24h: 8,
      over24h: 4
    }
  };

  const handleReportSelect = (reportId) => {
    setSelectedReport(reportId);
  };

  const handleDateRangeSelect = (rangeId) => {
    setDateRange(rangeId);
  };

  const handleExport = () => {
    console.log('Export report:', selectedReport, dateRange);
  };

  const renderReportTabs = () => (
    <View style={styles.reportTabs}>
      {reportTypes.map((report) => (
        <TouchableOpacity
          key={report.id}
          style={[
            styles.reportTab,
            selectedReport === report.id && styles.reportTabActive
          ]}
          onPress={() => handleReportSelect(report.id)}
        >
          <Text style={styles.reportTabIcon}>{report.icon}</Text>
          <Text style={[
            styles.reportTabText,
            selectedReport === report.id && styles.reportTabTextActive
          ]}>
            {report.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDateRangeSelector = () => (
    <View style={styles.dateRangeContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {dateRanges.map((range) => (
          <TouchableOpacity
            key={range.id}
            style={[
              styles.dateRangeChip,
              dateRange === range.id && styles.dateRangeChipActive
            ]}
            onPress={() => handleDateRangeSelect(range.id)}
          >
            <Text style={[
              styles.dateRangeText,
              dateRange === range.id && styles.dateRangeTextActive
            ]}>
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderOverviewReport = () => (
    <View style={styles.reportContent}>
      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{overviewData.totalRevenue}</Text>
          <Text style={styles.kpiLabel}>Total Revenue</Text>
          <Text style={styles.kpiTrend}>↑ 12% from last period</Text>
        </View>
        
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{overviewData.totalDeliveries}</Text>
          <Text style={styles.kpiLabel}>Total Deliveries</Text>
          <Text style={styles.kpiTrend}>↑ 8% from last period</Text>
        </View>
        
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{overviewData.activeDrivers}</Text>
          <Text style={styles.kpiLabel}>Active Drivers</Text>
          <Text style={styles.kpiTrend}>↑ 15% from last period</Text>
        </View>
        
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{overviewData.newCustomers}</Text>
          <Text style={styles.kpiLabel}>New Customers</Text>
          <Text style={styles.kpiTrend}>↑ 22% from last period</Text>
        </View>
      </View>

      {/* Performance Metrics */}
      <View style={styles.metricsSection}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{overviewData.avgDeliveryTime}</Text>
            <Text style={styles.metricLabel}>Avg Delivery Time</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{overviewData.completionRate}</Text>
            <Text style={styles.metricLabel}>Completion Rate</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{overviewData.totalDisputes}</Text>
            <Text style={styles.metricLabel}>Total Disputes</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{overviewData.avgRating}</Text>
            <Text style={styles.metricLabel}>Average Rating</Text>
          </View>
        </View>
      </View>

      {/* Revenue Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Revenue Trend</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {revenueData.map((data, index) => (
              <View key={data.date} style={styles.chartBar}>
                <View style={[
                  styles.bar,
                  { height: (data.revenue / 7890) * 120 }
                ]} />
                <Text style={styles.barLabel}>
                  {new Date(data.date).toLocaleDateString('en', { weekday: 'short' })}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  const renderRevenueReport = () => (
    <View style={styles.reportContent}>
      <View style={styles.revenueSummary}>
        <Text style={styles.revenueTotal}>{overviewData.totalRevenue}</Text>
        <Text style={styles.revenueLabel}>Total Revenue</Text>
        <Text style={styles.revenuePeriod}>Last 7 days</Text>
      </View>

      <View style={styles.revenueTable}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderCell}>Date</Text>
          <Text style={styles.tableHeaderCell}>Revenue</Text>
          <Text style={styles.tableHeaderCell}>Deliveries</Text>
          <Text style={styles.tableHeaderCell}>Avg/Order</Text>
        </View>
        {revenueData.map((data) => (
          <View key={data.date} style={styles.tableRow}>
            <Text style={styles.tableCell}>{new Date(data.date).toLocaleDateString()}</Text>
            <Text style={styles.tableCell}>R{data.revenue}</Text>
            <Text style={styles.tableCell}>{data.deliveries}</Text>
            <Text style={styles.tableCell}>R{Math.round(data.revenue / data.deliveries)}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderDeliveriesReport = () => (
    <View style={styles.reportContent}>
      <View style={styles.deliverySummary}>
        <View style={styles.deliveryStat}>
          <Text style={styles.deliveryNumber}>{deliveryData.total}</Text>
          <Text style={styles.deliveryLabel}>Total Deliveries</Text>
        </View>
        <View style={styles.deliveryBreakdown}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownNumber}>{deliveryData.completed}</Text>
            <Text style={styles.breakdownLabel}>Completed</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownNumber}>{deliveryData.cancelled}</Text>
            <Text style={styles.breakdownLabel}>Cancelled</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownNumber}>{deliveryData.disputed}</Text>
            <Text style={styles.breakdownLabel}>Disputed</Text>
          </View>
        </View>
      </View>

      <View style={styles.pieChartSection}>
        <Text style={styles.sectionTitle}>Deliveries by Tier</Text>
        <View style={styles.pieChart}>
          {Object.entries(deliveryData.byTier).map(([tier, data]) => (
            <View key={tier} style={styles.pieSlice}>
              <Text style={styles.pieLabel}>{tier}</Text>
              <Text style={styles.pieValue}>{data.count} ({data.percentage}%)</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.cityBreakdown}>
        <Text style={styles.sectionTitle}>Deliveries by City</Text>
        {deliveryData.byCity.map((city) => (
          <View key={city.city} style={styles.cityItem}>
            <Text style={styles.cityName}>{city.city}</Text>
            <View style={styles.cityBar}>
              <View style={[styles.cityBarFill, { width: `${city.percentage * 3}%` }]} />
            </View>
            <Text style={styles.cityCount}>{city.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderDriversReport = () => (
    <View style={styles.reportContent}>
      <View style={styles.driverSummary}>
        <View style={styles.driverStat}>
          <Text style={styles.driverNumber}>{driverData.total}</Text>
          <Text style={styles.driverLabel}>Total Drivers</Text>
        </View>
        <View style={styles.driverMetrics}>
          <View style={styles.driverMetric}>
            <Text style={styles.driverMetricValue}>{driverData.activeToday}</Text>
            <Text style={styles.driverMetricLabel}>Active Today</Text>
          </View>
          <View style={styles.driverMetric}>
            <Text style={styles.driverMetricValue}>{driverData.newThisMonth}</Text>
            <Text style={styles.driverMetricLabel}>New This Month</Text>
          </View>
          <View style={styles.driverMetric}>
            <Text style={styles.driverMetricValue}>{driverData.avgRating}</Text>
            <Text style={styles.driverMetricLabel}>Avg Rating</Text>
          </View>
        </View>
      </View>

      <View style={styles.topPerformers}>
        <Text style={styles.sectionTitle}>Top Performers</Text>
        {driverData.topPerformers.map((driver, index) => (
          <View key={driver.name} style={styles.performerItem}>
            <Text style={styles.performerRank}>#{index + 1}</Text>
            <View style={styles.performerInfo}>
              <Text style={styles.performerName}>{driver.name}</Text>
              <Text style={styles.performerDetails}>
                {driver.deliveries} deliveries • {driver.rating} ⭐
              </Text>
            </View>
            <Text style={styles.performerEarnings}>{driver.earnings}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderCustomersReport = () => (
    <View style={styles.reportContent}>
      <View style={styles.customerSummary}>
        <View style={styles.customerStat}>
          <Text style={styles.customerNumber}>{customerData.total}</Text>
          <Text style={styles.customerLabel}>Total Customers</Text>
        </View>
        <View style={styles.customerMetrics}>
          <View style={styles.customerMetric}>
            <Text style={styles.customerMetricValue}>{customerData.newThisMonth}</Text>
            <Text style={styles.customerMetricLabel}>New This Month</Text>
          </View>
          <View style={styles.customerMetric}>
            <Text style={styles.customerMetricValue}>{customerData.repeatRate}</Text>
            <Text style={styles.customerMetricLabel}>Repeat Rate</Text>
          </View>
          <View style={styles.customerMetric}>
            <Text style={styles.customerMetricValue}>{customerData.avgOrdersPerCustomer}</Text>
            <Text style={styles.customerMetricLabel}>Avg Orders/Customer</Text>
          </View>
        </View>
      </View>

      <View style={styles.sourceBreakdown}>
        <Text style={styles.sectionTitle}>Customer Acquisition</Text>
        {customerData.bySource.map((source) => (
          <View key={source.source} style={styles.sourceItem}>
            <Text style={styles.sourceName}>{source.source}</Text>
            <View style={styles.sourceBar}>
              <View style={[styles.sourceBarFill, { width: `${source.percentage * 2}%` }]} />
            </View>
            <Text style={styles.sourceCount}>{source.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderDisputesReport = () => (
    <View style={styles.reportContent}>
      <View style={styles.disputeSummary}>
        <View style={styles.disputeStat}>
          <Text style={styles.disputeNumber}>{disputeData.total}</Text>
          <Text style={styles.disputeLabel}>Total Disputes</Text>
        </View>
        <View style={styles.disputeBreakdown}>
          <View style={styles.disputeBreakdownItem}>
            <Text style={styles.disputeBreakdownNumber}>{disputeData.open}</Text>
            <Text style={styles.disputeBreakdownLabel}>Open</Text>
          </View>
          <View style={styles.disputeBreakdownItem}>
            <Text style={styles.disputeBreakdownNumber}>{disputeData.resolved}</Text>
            <Text style={styles.disputeBreakdownLabel}>Resolved</Text>
          </View>
          <View style={styles.disputeBreakdownItem}>
            <Text style={styles.disputeBreakdownNumber}>{disputeData.escalated}</Text>
            <Text style={styles.disputeBreakdownLabel}>Escalated</Text>
          </View>
        </View>
      </View>

      <View style={styles.reasonBreakdown}>
        <Text style={styles.sectionTitle}>Disputes by Reason</Text>
        {disputeData.byReason.map((reason) => (
          <View key={reason.reason} style={styles.reasonItem}>
            <Text style={styles.reasonName}>{reason.reason}</Text>
            <View style={styles.reasonBar}>
              <View style={[styles.reasonBarFill, { width: `${reason.percentage * 4}%` }]} />
            </View>
            <Text style={styles.reasonCount}>{reason.count}</Text>
          </View>
        ))}
      </View>

      <View style={styles.resolutionMetrics}>
        <Text style={styles.sectionTitle}>Resolution Metrics</Text>
        <View style={styles.resolutionItem}>
          <Text style={styles.resolutionLabel}>Avg Resolution Time:</Text>
          <Text style={styles.resolutionValue}>{disputeData.resolutionTime.avg}</Text>
        </View>
        <View style={styles.resolutionItem}>
          <Text style={styles.resolutionLabel}>Resolved under 24h:</Text>
          <Text style={styles.resolutionValue}>{disputeData.resolutionTime.under24h}</Text>
        </View>
        <View style={styles.resolutionItem}>
          <Text style={styles.resolutionLabel}>Resolved over 24h:</Text>
          <Text style={styles.resolutionValue}>{disputeData.resolutionTime.over24h}</Text>
        </View>
      </View>
    </View>
  );

  const renderReportContent = () => {
    switch (selectedReport) {
      case 'overview': return renderOverviewReport();
      case 'revenue': return renderRevenueReport();
      case 'deliveries': return renderDeliveriesReport();
      case 'drivers': return renderDriversReport();
      case 'customers': return renderCustomersReport();
      case 'disputes': return renderDisputesReport();
      default: return renderOverviewReport();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Reports & Analytics</Text>
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Report Tabs */}
      {renderReportTabs()}

      {/* Date Range Selector */}
      {renderDateRangeSelector()}

      {/* Report Content */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {renderReportContent()}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  exportButton: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  reportTabs: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  reportTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reportTabActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#1A73E8',
  },
  reportTabIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  reportTabText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  reportTabTextActive: {
    color: '#FFFFFF',
  },
  dateRangeContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  dateRangeChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
  },
  dateRangeChipActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#1A73E8',
  },
  dateRangeText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  dateRangeTextActive: {
    color: '#FFFFFF',
  },
  reportContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiValue: {
    fontSize: 24,
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
    fontSize: 12,
    color: '#4CAF50',
  },
  metricsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
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
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A73E8',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  chartSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartContainer: {
    height: 150,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 20,
    backgroundColor: '#1A73E8',
    borderRadius: 4,
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 10,
    color: '#666666',
  },
  revenueSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  revenueTotal: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  revenueLabel: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  revenuePeriod: {
    fontSize: 14,
    color: '#999999',
  },
  revenueTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    color: '#1A1A1A',
  },
  deliverySummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deliveryStat: {
    alignItems: 'center',
    marginBottom: 20,
  },
  deliveryNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1A73E8',
    marginBottom: 4,
  },
  deliveryLabel: {
    fontSize: 16,
    color: '#666666',
  },
  deliveryBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#666666',
  },
  pieChartSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pieChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pieSlice: {
    alignItems: 'center',
  },
  pieLabel: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  pieValue: {
    fontSize: 12,
    color: '#666666',
  },
  cityBreakdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cityName: {
    width: 100,
    fontSize: 14,
    color: '#1A1A1A',
  },
  cityBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginHorizontal: 12,
  },
  cityBarFill: {
    height: '100%',
    backgroundColor: '#1A73E8',
    borderRadius: 4,
  },
  cityCount: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
    width: 30,
    textAlign: 'right',
  },
  driverSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  driverStat: {
    alignItems: 'center',
    marginBottom: 20,
  },
  driverNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  driverLabel: {
    fontSize: 16,
    color: '#666666',
  },
  driverMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  driverMetric: {
    alignItems: 'center',
  },
  driverMetricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  driverMetricLabel: {
    fontSize: 12,
    color: '#666666',
  },
  topPerformers: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  performerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  performerRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A73E8',
    width: 30,
  },
  performerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  performerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  performerDetails: {
    fontSize: 12,
    color: '#666666',
  },
  performerEarnings: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  customerSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  customerStat: {
    alignItems: 'center',
    marginBottom: 20,
  },
  customerNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  customerLabel: {
    fontSize: 16,
    color: '#666666',
  },
  customerMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  customerMetric: {
    alignItems: 'center',
  },
  customerMetricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  customerMetricLabel: {
    fontSize: 12,
    color: '#666666',
  },
  sourceBreakdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sourceName: {
    width: 100,
    fontSize: 14,
    color: '#1A1A1A',
  },
  sourceBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginHorizontal: 12,
  },
  sourceBarFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 4,
  },
  sourceCount: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
    width: 30,
    textAlign: 'right',
  },
  disputeSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  disputeStat: {
    alignItems: 'center',
    marginBottom: 20,
  },
  disputeNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 4,
  },
  disputeLabel: {
    fontSize: 16,
    color: '#666666',
  },
  disputeBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  disputeBreakdownItem: {
    alignItems: 'center',
  },
  disputeBreakdownNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  disputeBreakdownLabel: {
    fontSize: 12,
    color: '#666666',
  },
  reasonBreakdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reasonName: {
    width: 120,
    fontSize: 14,
    color: '#1A1A1A',
  },
  reasonBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginHorizontal: 12,
  },
  reasonBarFill: {
    height: '100%',
    backgroundColor: '#F44336',
    borderRadius: 4,
  },
  reasonCount: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
    width: 30,
    textAlign: 'right',
  },
  resolutionMetrics: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resolutionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resolutionLabel: {
    fontSize: 14,
    color: '#666666',
  },
  resolutionValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
});

export default Reports;
