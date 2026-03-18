import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';

const { width, height } = Dimensions.get('window');

const DriverReview = () => {
  const [selectedDriver, setSelectedDriver] = useState(null);

  const driverApplications = [
    {
      id: 'DRV001',
      name: 'John Smith',
      date: '2024-03-18',
      status: 'Pending Review',
      email: 'john.smith@email.com',
      phone: '+27 83 123 4567',
      photo: '👨‍💼',
      documents: {
        idDocument: { uploaded: true, verified: false },
        driversLicense: { uploaded: true, verified: false },
        vehicleRegistration: { uploaded: true, verified: false },
        licenseDisc: { uploaded: true, verified: false },
        sapsCertificate: { uploaded: true, verified: false }
      },
      vehicle: {
        make: 'Toyota',
        model: 'Corolla',
        year: '2018',
        plate: 'CA 123-456'
      },
      backgroundCheck: 'In Progress'
    },
    {
      id: 'DRV002',
      name: 'Mary Johnson',
      date: '2024-03-17',
      status: 'Approved',
      email: 'mary.j@email.com',
      phone: '+27 82 987 6543',
      photo: '👩‍💼',
      documents: {
        idDocument: { uploaded: true, verified: true },
        driversLicense: { uploaded: true, verified: true },
        vehicleRegistration: { uploaded: true, verified: true },
        licenseDisc: { uploaded: true, verified: true },
        sapsCertificate: { uploaded: false, verified: false }
      },
      vehicle: {
        make: 'Volkswagen',
        model: 'Polo',
        year: '2020',
        plate: 'CA 789-012'
      },
      backgroundCheck: 'Clear'
    },
    {
      id: 'DRV003',
      name: 'David Wilson',
      date: '2024-03-16',
      status: 'Rejected',
      email: 'david.w@email.com',
      phone: '+27 81 555 1234',
      photo: '👨‍💼',
      documents: {
        idDocument: { uploaded: true, verified: true },
        driversLicense: { uploaded: false, verified: false },
        vehicleRegistration: { uploaded: false, verified: false },
        licenseDisc: { uploaded: false, verified: false },
        sapsCertificate: { uploaded: false, verified: false }
      },
      vehicle: null,
      backgroundCheck: 'Failed'
    },
    {
      id: 'DRV004',
      name: 'Sarah Brown',
      date: '2024-03-15',
      status: 'Suspended',
      email: 'sarah.b@email.com',
      phone: '+27 84 222 9876',
      photo: '👩‍💼',
      documents: {
        idDocument: { uploaded: true, verified: true },
        driversLicense: { uploaded: true, verified: true },
        vehicleRegistration: { uploaded: true, verified: true },
        licenseDisc: { uploaded: true, verified: true },
        sapsCertificate: { uploaded: true, verified: true }
      },
      vehicle: {
        make: 'Ford',
        model: 'Fiesta',
        year: '2019',
        plate: 'CA 345-678'
      },
      backgroundCheck: 'Clear'
    }
  ];

  const handleSelectDriver = (driver) => {
    setSelectedDriver(driver);
  };

  const handleCloseDetail = () => {
    setSelectedDriver(null);
  };

  const handleApproveDriver = () => {
    console.log('Approve driver:', selectedDriver.id);
  };

  const handleRejectDriver = () => {
    console.log('Reject driver:', selectedDriver.id);
  };

  const handleDocumentAction = (docType, action) => {
    console.log(`${action} document:`, docType);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending Review': return '#FF9800';
      case 'Approved': return '#4CAF50';
      case 'Rejected': return '#F44336';
      case 'Suspended': return '#757575';
      default: return '#757575';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'Pending Review': return '#FFF3E0';
      case 'Approved': return '#E8F5E8';
      case 'Rejected': return '#FFEBEE';
      case 'Suspended': return '#F5F5F5';
      default: return '#F5F5F5';
    }
  };

  const renderDriverList = () => (
    <View style={styles.driverList}>
      {driverApplications.map((driver) => (
        <TouchableOpacity
          key={driver.id}
          style={[
            styles.driverCard,
            selectedDriver?.id === driver.id && styles.driverCardSelected
          ]}
          onPress={() => handleSelectDriver(driver)}
        >
          <View style={styles.driverCardHeader}>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.driverDate}>Applied: {driver.date}</Text>
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusBg(driver.status) }
            ]}>
              <Text style={[
                styles.statusText,
                { color: getStatusColor(driver.status) }
              ]}>
                {driver.status}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDriverDetail = () => {
    if (!selectedDriver) return null;

    return (
      <View style={styles.detailPanel}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>Driver Application Review</Text>
          <TouchableOpacity onPress={handleCloseDetail}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Driver Photo and Basic Info */}
          <View style={styles.driverPhotoSection}>
            <View style={styles.driverPhotoLarge}>
              <Text style={styles.driverPhotoText}>{selectedDriver.photo}</Text>
            </View>
            <View style={styles.driverBasicInfo}>
              <Text style={styles.driverNameLarge}>{selectedDriver.name}</Text>
              <Text style={styles.driverEmail}>{selectedDriver.email}</Text>
              <Text style={styles.driverPhone}>{selectedDriver.phone}</Text>
              <Text style={styles.applicationDate}>Application Date: {selectedDriver.date}</Text>
            </View>
          </View>

          {/* Document Verification */}
          <View style={styles.documentSection}>
            <Text style={styles.sectionTitle}>Document Verification</Text>
            <View style={styles.documentsGrid}>
              {Object.entries(selectedDriver.documents).map(([docType, docInfo]) => (
                <View key={docType} style={styles.documentCard}>
                  <Text style={styles.documentTitle}>
                    {docType.replace(/([A-Z])/g, ' $1').trim()}
                  </Text>
                  <View style={styles.documentStatus}>
                    <View style={[
                      styles.uploadStatus,
                      { backgroundColor: docInfo.uploaded ? '#E8F5E8' : '#FFEBEE' }
                    ]}>
                      <Text style={[
                        styles.uploadStatusText,
                        { color: docInfo.uploaded ? '#4CAF50' : '#F44336' }
                      ]}>
                        {docInfo.uploaded ? 'Uploaded' : 'Missing'}
                      </Text>
                    </View>
                    {docInfo.uploaded && (
                      <View style={[
                        styles.verifyStatus,
                        { backgroundColor: docInfo.verified ? '#E8F5E8' : '#FFF3E0' }
                      ]}>
                        <Text style={[
                          styles.verifyStatusText,
                          { color: docInfo.verified ? '#4CAF50' : '#FF9800' }
                        ]}>
                          {docInfo.verified ? 'Verified' : 'Pending'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.documentActions}>
                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={() => handleDocumentAction(docType, 'approve')}
                    >
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => handleDocumentAction(docType, 'reject')}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Vehicle Information */}
          {selectedDriver.vehicle && (
            <View style={styles.vehicleSection}>
              <Text style={styles.sectionTitle}>Vehicle Information</Text>
              <View style={styles.vehicleInfo}>
                <View style={styles.vehicleDetail}>
                  <Text style={styles.vehicleLabel}>Make:</Text>
                  <Text style={styles.vehicleValue}>{selectedDriver.vehicle.make}</Text>
                </View>
                <View style={styles.vehicleDetail}>
                  <Text style={styles.vehicleLabel}>Model:</Text>
                  <Text style={styles.vehicleValue}>{selectedDriver.vehicle.model}</Text>
                </View>
                <View style={styles.vehicleDetail}>
                  <Text style={styles.vehicleLabel}>Year:</Text>
                  <Text style={styles.vehicleValue}>{selectedDriver.vehicle.year}</Text>
                </View>
                <View style={styles.vehicleDetail}>
                  <Text style={styles.vehicleLabel}>Plate:</Text>
                  <Text style={styles.vehicleValue}>{selectedDriver.vehicle.plate}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Background Check */}
          <View style={styles.backgroundSection}>
            <Text style={styles.sectionTitle}>Background Check</Text>
            <View style={[
              styles.backgroundStatus,
              { backgroundColor: selectedDriver.backgroundCheck === 'Clear' ? '#E8F5E8' : '#FFF3E0' }
            ]}>
              <Text style={[
                styles.backgroundStatusText,
                { color: selectedDriver.backgroundCheck === 'Clear' ? '#4CAF50' : '#FF9800' }
              ]}>
                {selectedDriver.backgroundCheck}
              </Text>
            </View>
          </View>

          {/* Rating History (for active drivers) */}
          {selectedDriver.status === 'Approved' && (
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>Rating History</Text>
              <View style={styles.ratingSummary}>
                <Text style={styles.ratingNumber}>4.8</Text>
                <Text style={styles.ratingStars}>⭐⭐⭐⭐⭐</Text>
                <Text style={styles.ratingCount}>Based on 47 deliveries</Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            {selectedDriver.status === 'Pending Review' && (
              <>
                <TouchableOpacity
                  style={styles.approveDriverButton}
                  onPress={handleApproveDriver}
                >
                  <Text style={styles.approveDriverButtonText}>Approve Driver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectDriverButton}
                  onPress={handleRejectDriver}
                >
                  <Text style={styles.rejectDriverButtonText}>Reject Application</Text>
                </TouchableOpacity>
              </>
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
        <Text style={styles.title}>Driver Management</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Driver List */}
        {renderDriverList()}

        {/* Driver Detail */}
        {renderDriverDetail()}
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  driverList: {
    width: 300,
    marginRight: 24,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  driverCardSelected: {
    borderWidth: 2,
    borderColor: '#1A73E8',
  },
  driverCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  driverDate: {
    fontSize: 12,
    color: '#666666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  detailPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
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
  driverPhotoSection: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  driverPhotoLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  driverPhotoText: {
    fontSize: 32,
  },
  driverBasicInfo: {
    flex: 1,
  },
  driverNameLarge: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  driverEmail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  driverPhone: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  applicationDate: {
    fontSize: 12,
    color: '#999999',
  },
  documentSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  documentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  documentCard: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  documentTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  documentStatus: {
    marginBottom: 8,
  },
  uploadStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  uploadStatusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  verifyStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  verifyStatusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  documentActions: {
    flexDirection: 'row',
    gap: 4,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#F44336',
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  vehicleSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  vehicleInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
  },
  vehicleDetail: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  vehicleLabel: {
    fontSize: 14,
    color: '#666666',
    width: 60,
  },
  vehicleValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  backgroundSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backgroundStatus: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  backgroundStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  ratingSummary: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 20,
  },
  ratingNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFA500',
    marginBottom: 4,
  },
  ratingStars: {
    fontSize: 16,
    marginBottom: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#666666',
  },
  actionSection: {
    padding: 20,
  },
  approveDriverButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  approveDriverButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectDriverButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectDriverButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DriverReview;
