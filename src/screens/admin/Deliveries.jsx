import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';

const { width, height } = Dimensions.get('window');

const Deliveries = () => {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const statusOptions = ['All', 'Active', 'Completed', 'Disputed', 'Cancelled'];

  const deliveries = [
    {
      id: '#SD2024031801',
      customer: 'Thabo S.',
      driver: 'Sipho M.',
      route: 'Worcester to Cape Town',
      status: 'Active',
      amount: 'R200',
      time: '2:30 PM',
      pickupPhoto: 'pickup_1.jpg',
      deliveryPhoto: null,
      otpTimestamps: {
        pickup: '2:15 PM',
        delivery: null
      }
    },
    {
      id: '#SD2024031802',
      customer: 'Zanele M.',
      driver: 'John D.',
      route: 'Stellenbosch to Somerset West',
      status: 'Completed',
      amount: 'R120',
      time: '11:15 AM',
      pickupPhoto: 'pickup_2.jpg',
      deliveryPhoto: 'delivery_2.jpg',
      otpTimestamps: {
        pickup: '10:45 AM',
        delivery: '11:10 AM'
      }
    },
    {
      id: '#SD2024031803',
      customer: 'Peter K.',
      driver: 'Mary J.',
      route: 'Cape Town CBD to Sea Point',
      status: 'Completed',
      amount: 'R85',
      time: '9:45 AM',
      pickupPhoto: 'pickup_3.jpg',
      deliveryPhoto: 'delivery_3.jpg',
      otpTimestamps: {
        pickup: '9:20 AM',
        delivery: '9:40 AM'
      }
    },
    {
      id: '#SD2024031804',
      customer: 'Sarah L.',
      driver: 'David R.',
      route: 'Paarl to Wellington',
      status: 'Disputed',
      amount: 'R150',
      time: 'Yesterday',
      pickupPhoto: 'pickup_4.jpg',
      deliveryPhoto: 'delivery_4.jpg',
      otpTimestamps: {
        pickup: '3:30 PM',
        delivery: '4:15 PM'
      }
    },
    {
      id: '#SD2024031805',
      customer: 'Mike T.',
      driver: 'Lisa S.',
      route: 'Durbanville to Bellville',
      status: 'Cancelled',
      amount: 'R95',
      time: 'Yesterday',
      pickupPhoto: null,
      deliveryPhoto: null,
      otpTimestamps: {
        pickup: null,
        delivery: null
      }
    },
    {
      id: '#SD2024031806',
      customer: 'Anna B.',
      driver: 'Tom W.',
      route: 'Somerset West to Strand',
      status: 'Active',
      amount: 'R110',
      time: '1:20 PM',
      pickupPhoto: 'pickup_6.jpg',
      deliveryPhoto: null,
      otpTimestamps: {
        pickup: '1:05 PM',
        delivery: null
      }
    },
    {
      id: '#SD2024031807',
      customer: 'Chris D.',
      driver: 'Emma K.',
      route: 'Cape Town to Milnerton',
      status: 'Completed',
      amount: 'R130',
      time: '12:00 PM',
      pickupPhoto: 'pickup_7.jpg',
      deliveryPhoto: 'delivery_7.jpg',
      otpTimestamps: {
        pickup: '11:35 AM',
        delivery: '11:55 AM'
      }
    },
    {
      id: '#SD2024031808',
      customer: 'Laura M.',
      driver: 'Kevin P.',
      route: 'Goodwood to Parow',
      status: 'Active',
      amount: 'R75',
      time: '3:45 PM',
      pickupPhoto: 'pickup_8.jpg',
      deliveryPhoto: null,
      otpTimestamps: {
        pickup: '3:30 PM',
        delivery: null
      }
    }
  ];

  const handleStatusFilter = (status) => {
    setSelectedStatus(status.toLowerCase());
  };

  const handleViewDelivery = (delivery) => {
    setSelectedDelivery(delivery);
  };

  const handleCloseDetail = () => {
    setSelectedDelivery(null);
  };

  const handleDispute = (deliveryId) => {
    console.log('Open dispute for delivery:', deliveryId);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return '#1A73E8';
      case 'Completed': return '#4CAF50';
      case 'Disputed': return '#F44336';
      case 'Cancelled': return '#757575';
      default: return '#757575';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'Active': return '#E8F4FF';
      case 'Completed': return '#E8F5E8';
      case 'Disputed': return '#FFEBEE';
      case 'Cancelled': return '#F5F5F5';
      default: return '#F5F5F5';
    }
  };

  const filteredDeliveries = selectedStatus === 'all' 
    ? deliveries 
    : deliveries.filter(d => d.status.toLowerCase() === selectedStatus);

  const renderFilterBar = () => (
    <View style={styles.filterBar}>
      <View style={styles.filterLeft}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search deliveries...</Text>
        </View>
      </View>
      
      <View style={styles.filterRight}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {statusOptions.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                selectedStatus === status.toLowerCase() && styles.filterChipActive
              ]}
              onPress={() => handleStatusFilter(status)}
            >
              <Text style={[
                styles.filterChipText,
                selectedStatus === status.toLowerCase() && styles.filterChipTextActive
              ]}>
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderDeliveryTable = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <Text style={styles.headerCell}>ID</Text>
        <Text style={styles.headerCell}>Customer</Text>
        <Text style={styles.headerCell}>Driver</Text>
        <Text style={styles.headerCell}>Route</Text>
        <Text style={styles.headerCell}>Status</Text>
        <Text style={styles.headerCell}>Amount</Text>
        <Text style={styles.headerCell}>Time</Text>
        <Text style={styles.headerCell}>Actions</Text>
      </View>
      
      {filteredDeliveries.map((delivery, index) => (
        <View key={delivery.id} style={[
          styles.tableRow,
          index % 2 === 0 && styles.tableRowStriped
        ]}>
          <Text style={styles.tableCell}>{delivery.id}</Text>
          <Text style={styles.tableCell}>{delivery.customer}</Text>
          <Text style={styles.tableCell}>{delivery.driver}</Text>
          <Text style={styles.tableCell} numberOfLines={1}>{delivery.route}</Text>
          <View style={styles.statusCell}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusBg(delivery.status) }
            ]}>
              <Text style={[
                styles.statusText,
                { color: getStatusColor(delivery.status) }
              ]}>
                {delivery.status}
              </Text>
            </View>
          </View>
          <Text style={styles.tableCell}>{delivery.amount}</Text>
          <Text style={styles.tableCell}>{delivery.time}</Text>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => handleViewDelivery(delivery)}
          >
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const renderDetailPanel = () => {
    if (!selectedDelivery) return null;

    return (
      <View style={styles.detailPanel}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>Delivery Details</Text>
          <TouchableOpacity onPress={handleCloseDetail}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Basic Info */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Basic Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivery ID:</Text>
              <Text style={styles.detailValue}>{selectedDelivery.id}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Customer:</Text>
              <Text style={styles.detailValue}>{selectedDelivery.customer}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Driver:</Text>
              <Text style={styles.detailValue}>{selectedDelivery.driver}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Route:</Text>
              <Text style={styles.detailValue}>{selectedDelivery.route}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount:</Text>
              <Text style={styles.detailValue}>{selectedDelivery.amount}</Text>
            </View>
          </View>

          {/* Addresses */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Addresses</Text>
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>Pickup:</Text>
              <Text style={styles.addressText}>123 Main Street, Worcester</Text>
            </View>
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>Delivery:</Text>
              <Text style={styles.addressText}>456 Oak Avenue, Cape Town</Text>
            </View>
          </View>

          {/* Photos */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Photos</Text>
            <View style={styles.photosContainer}>
              <View style={styles.photoBlock}>
                <Text style={styles.photoLabel}>Pickup Photo</Text>
                {selectedDelivery.pickupPhoto ? (
                  <View style={styles.photoThumbnail}>
                    <Text style={styles.photoIcon}>📷</Text>
                  </View>
                ) : (
                  <Text style={styles.noPhotoText}>No pickup photo</Text>
                )}
              </View>
              <View style={styles.photoBlock}>
                <Text style={styles.photoLabel}>Delivery Photo</Text>
                {selectedDelivery.deliveryPhoto ? (
                  <View style={styles.photoThumbnail}>
                    <Text style={styles.photoIcon}>📷</Text>
                  </View>
                ) : (
                  <Text style={styles.noPhotoText}>No delivery photo</Text>
                )}
              </View>
            </View>
          </View>

          {/* OTP Timestamps */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>OTP Confirmation</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pickup OTP:</Text>
              <Text style={styles.detailValue}>
                {selectedDelivery.otpTimestamps.pickup || 'Not confirmed'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivery OTP:</Text>
              <Text style={styles.detailValue}>
                {selectedDelivery.otpTimestamps.delivery || 'Not confirmed'}
              </Text>
            </View>
          </View>

          {/* Payment Breakdown */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Payment Breakdown</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivery Fee:</Text>
              <Text style={styles.detailValue}>{selectedDelivery.amount}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Commission:</Text>
              <Text style={styles.detailValue}>R{parseInt(selectedDelivery.amount.replace('R', '')) * 0.15}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Driver Earnings:</Text>
              <Text style={styles.detailValue}>R{parseInt(selectedDelivery.amount.replace('R', '')) * 0.85}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.detailActions}>
            {selectedDelivery.status === 'Active' && (
              <TouchableOpacity
                style={styles.disputeButton}
                onPress={() => handleDispute(selectedDelivery.id)}
              >
                <Text style={styles.disputeButtonText}>Open Dispute</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Deliveries</Text>
        <TouchableOpacity style={styles.exportButton}>
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Bar */}
      {renderFilterBar()}

      {/* Main Content */}
      <View style={styles.content}>
        {/* Table */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderDeliveryTable()}
        </ScrollView>

        {/* Detail Panel */}
        {renderDetailPanel()}
      </View>
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
  filterBar: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterLeft: {
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: '#999999',
  },
  filterRight: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#1A73E8',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 800,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableRowStriped: {
    backgroundColor: '#FAFAFA',
  },
  tableCell: {
    fontSize: 12,
    color: '#1A1A1A',
    flex: 1,
  },
  statusCell: {
    flex: 1,
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  viewButton: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  detailPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 400,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    fontSize: 20,
    color: '#666666',
  },
  detailSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  addressBlock: {
    marginBottom: 12,
  },
  addressLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  photosContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  photoBlock: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 24,
  },
  noPhotoText: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
  },
  detailActions: {
    padding: 20,
  },
  disputeButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disputeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Deliveries;
