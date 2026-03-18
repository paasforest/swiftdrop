import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, TextInput } from 'react-native';

const { width, height } = Dimensions.get('window');

const DisputeResolution = () => {
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');

  const disputes = [
    {
      id: '#DSP001',
      customer: 'Sarah L.',
      driver: 'David R.',
      deliveryId: '#SD2024031804',
      reason: 'Damaged parcel',
      date: '2024-03-18',
      urgency: 'Open',
      timeRemaining: '23h 45m',
      customerClaim: 'Package arrived with broken items inside. The box was crushed on one side.',
      driverResponse: 'I delivered the package as received. The damage must have occurred during transit or at pickup.',
      evidence: {
        pickupPhoto: 'pickup_damaged.jpg',
        deliveryPhoto: 'delivery_damaged.jpg',
        otpConfirmed: true,
        pickupTime: '3:30 PM',
        deliveryTime: '4:15 PM'
      }
    },
    {
      id: '#DSP002',
      customer: 'Mike T.',
      driver: 'Lisa S.',
      deliveryId: '#SD2024031805',
      reason: 'Late delivery',
      date: '2024-03-17',
      urgency: 'In Review',
      timeRemaining: '18h 20m',
      customerClaim: 'Driver was 2 hours late for pickup, causing me to miss my appointment.',
      driverResponse: 'Traffic was heavy due to accident on N1. I kept the customer updated via chat.',
      evidence: {
        pickupPhoto: null,
        deliveryPhoto: null,
        otpConfirmed: false,
        pickupTime: null,
        deliveryTime: null
      }
    },
    {
      id: '#DSP003',
      customer: 'Anna B.',
      driver: 'Tom W.',
      deliveryId: '#SD2024031806',
      reason: 'Wrong item delivered',
      date: '2024-03-16',
      urgency: 'Resolved',
      timeRemaining: 'Resolved',
      customerClaim: 'Driver delivered wrong package to wrong address.',
      driverResponse: 'Customer gave incorrect address initially. Corrected the mistake within 30 minutes.',
      evidence: {
        pickupPhoto: 'pickup_wrong.jpg',
        deliveryPhoto: 'delivery_corrected.jpg',
        otpConfirmed: true,
        pickupTime: '2:45 PM',
        deliveryTime: '3:15 PM'
      }
    }
  ];

  const handleSelectDispute = (dispute) => {
    setSelectedDispute(dispute);
    setDecision('');
    setNotes('');
  };

  const handleCloseDetail = () => {
    setSelectedDispute(null);
    setDecision('');
    setNotes('');
  };

  const handleSendDecision = () => {
    console.log('Send decision:', { dispute: selectedDispute.id, decision, notes });
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'Open': return '#F44336';
      case 'In Review': return '#FF9800';
      case 'Resolved': return '#4CAF50';
      default: return '#757575';
    }
  };

  const getUrgencyBg = (urgency) => {
    switch (urgency) {
      case 'Open': return '#FFEBEE';
      case 'In Review': return '#FFF3E0';
      case 'Resolved': return '#E8F5E8';
      default: return '#F5F5F5';
    }
  };

  const renderDisputeList = () => (
    <View style={styles.disputeList}>
      {disputes.map((dispute) => (
        <TouchableOpacity
          key={dispute.id}
          style={[
            styles.disputeCard,
            selectedDispute?.id === dispute.id && styles.disputeCardSelected
          ]}
          onPress={() => handleSelectDispute(dispute)}
        >
          <View style={styles.disputeHeader}>
            <View style={styles.disputeInfo}>
              <Text style={styles.disputeId}>{dispute.id}</Text>
              <Text style={styles.disputeReason}>{dispute.reason}</Text>
              <Text style={styles.disputeDetails}>
                {dispute.customer} vs {dispute.driver}
              </Text>
              <Text style={styles.disputeDate}>{dispute.date}</Text>
            </View>
            <View style={[
              styles.urgencyBadge,
              { backgroundColor: getUrgencyBg(dispute.urgency) }
            ]}>
              <Text style={[
                styles.urgencyText,
                { color: getUrgencyColor(dispute.urgency) }
              ]}>
                {dispute.urgency}
              </Text>
            </View>
          </View>
          {dispute.urgency !== 'Resolved' && (
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>Time remaining: {dispute.timeRemaining}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTimeline = () => {
    if (!selectedDispute) return null;

    const timelineEvents = [
      {
        time: selectedDispute.evidence.pickupTime || 'N/A',
        title: 'Pickup',
        description: 'Driver collected parcel',
        status: selectedDispute.evidence.pickupTime ? 'completed' : 'pending'
      },
      {
        time: selectedDispute.evidence.deliveryTime || 'N/A',
        title: 'Delivery',
        description: 'Parcel delivered to recipient',
        status: selectedDispute.evidence.deliveryTime ? 'completed' : 'pending'
      },
      {
        time: selectedDispute.date,
        title: 'Dispute Opened',
        description: 'Customer filed dispute',
        status: 'completed'
      }
    ];

    return (
      <View style={styles.timelineSection}>
        <Text style={styles.sectionTitle}>Delivery Timeline</Text>
        {timelineEvents.map((event, index) => (
          <View key={index} style={styles.timelineItem}>
            <View style={[
              styles.timelineDot,
              event.status === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending
            ]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTime}>{event.time}</Text>
              <Text style={styles.timelineTitle}>{event.title}</Text>
              <Text style={styles.timelineDescription}>{event.description}</Text>
            </View>
            {index < timelineEvents.length - 1 && (
              <View style={styles.timelineLine} />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderEvidence = () => {
    if (!selectedDispute) return null;

    return (
      <View style={styles.evidenceSection}>
        <Text style={styles.sectionTitle}>Evidence</Text>
        
        <View style={styles.photosContainer}>
          <View style={styles.photoBlock}>
            <Text style={styles.photoLabel}>Pickup Photo</Text>
            {selectedDispute.evidence.pickupPhoto ? (
              <TouchableOpacity style={styles.photoThumbnail}>
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={styles.photoText}>Tap to view</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.noPhotoText}>No photo available</Text>
            )}
          </View>
          
          <View style={styles.photoBlock}>
            <Text style={styles.photoLabel}>Delivery Photo</Text>
            {selectedDispute.evidence.deliveryPhoto ? (
              <TouchableOpacity style={styles.photoThumbnail}>
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={styles.photoText}>Tap to view</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.noPhotoText}>No photo available</Text>
            )}
          </View>
        </View>

        <View style={styles.otpSection}>
          <Text style={styles.otpLabel}>OTP Confirmation Log</Text>
          <View style={styles.otpRow}>
            <Text style={styles.otpField}>Pickup OTP:</Text>
            <Text style={styles.otpValue}>
              {selectedDispute.evidence.otpConfirmed ? 
                `Confirmed at ${selectedDispute.evidence.pickupTime}` : 
                'Not confirmed'
              }
            </Text>
          </View>
          <View style={styles.otpRow}>
            <Text style={styles.otpField}>Delivery OTP:</Text>
            <Text style={styles.otpValue}>
              {selectedDispute.evidence.deliveryTime ? 
                `Confirmed at ${selectedDispute.evidence.deliveryTime}` : 
                'Not confirmed'
              }
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderClaims = () => {
    if (!selectedDispute) return null;

    return (
      <View style={styles.claimsSection}>
        <Text style={styles.sectionTitle}>Claims & Responses</Text>
        
        <View style={styles.claimBlock}>
          <Text style={styles.claimTitle}>Customer Claim</Text>
          <View style={styles.claimContent}>
            <Text style={styles.claimAuthor}>{selectedDispute.customer}</Text>
            <Text style={styles.claimText}>{selectedDispute.customerClaim}</Text>
          </View>
        </View>

        <View style={styles.claimBlock}>
          <Text style={styles.claimTitle}>Driver Response</Text>
          <View style={styles.claimContent}>
            <Text style={styles.claimAuthor}>{selectedDispute.driver}</Text>
            <Text style={styles.claimText}>{selectedDispute.driverResponse}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDecision = () => {
    if (!selectedDispute || selectedDispute.urgency === 'Resolved') return null;

    return (
      <View style={styles.decisionSection}>
        <Text style={styles.sectionTitle}>Admin Decision</Text>
        
        <View style={styles.decisionOptions}>
          {[
            { value: 'refund', label: 'Refund Customer' },
            { value: 'no_refund', label: 'No Refund' },
            { value: 'partial_refund', label: 'Partial Refund' },
            { value: 'escalate', label: 'Escalate' }
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.decisionOption,
                decision === option.value && styles.decisionOptionSelected
              ]}
              onPress={() => setDecision(option.value)}
            >
              <View style={styles.radioCircle}>
                {decision === option.value && (
                  <View style={styles.radioSelected} />
                )}
              </View>
              <Text style={styles.decisionLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add detailed notes about your decision..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendDecisionButton,
            !decision && styles.sendDecisionButtonDisabled
          ]}
          onPress={handleSendDecision}
          disabled={!decision}
        >
          <Text style={styles.sendDecisionButtonText}>Send Decision</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDisputeDetail = () => {
    if (!selectedDispute) return null;

    return (
      <View style={styles.detailPanel}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>Dispute Resolution</Text>
          <TouchableOpacity onPress={handleCloseDetail}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Dispute Info */}
          <View style={styles.disputeInfoHeader}>
            <Text style={styles.disputeTitle}>{selectedDispute.id}</Text>
            <View style={styles.disputeMeta}>
              <Text style={styles.disputeReasonLarge}>{selectedDispute.reason}</Text>
              <Text style={styles.disputeParticipants}>
                {selectedDispute.customer} vs {selectedDispute.driver}
              </Text>
              <View style={[
                styles.urgencyBadgeLarge,
                { backgroundColor: getUrgencyBg(selectedDispute.urgency) }
              ]}>
                <Text style={[
                  styles.urgencyTextLarge,
                  { color: getUrgencyColor(selectedDispute.urgency) }
                ]}>
                  {selectedDispute.urgency}
                </Text>
              </View>
            </View>
          </View>

          {/* Timer */}
          {selectedDispute.urgency !== 'Resolved' && (
            <View style={styles.resolutionTimer}>
              <Text style={styles.timerLabel}>24hr Resolution Timer</Text>
              <Text style={styles.timerValue}>{selectedDispute.timeRemaining} remaining</Text>
            </View>
          )}

          {/* Timeline */}
          {renderTimeline()}

          {/* Evidence */}
          {renderEvidence()}

          {/* Claims */}
          {renderClaims()}

          {/* Decision */}
          {renderDecision()}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dispute Resolution</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Dispute List */}
        {renderDisputeList()}

        {/* Dispute Detail */}
        {renderDisputeDetail()}
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
  disputeList: {
    width: 300,
    marginRight: 24,
  },
  disputeCard: {
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
  disputeCardSelected: {
    borderWidth: 2,
    borderColor: '#1A73E8',
  },
  disputeHeader: {
    marginBottom: 8,
  },
  disputeInfo: {
    marginBottom: 8,
  },
  disputeId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  disputeReason: {
    fontSize: 12,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  disputeDetails: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 2,
  },
  disputeDate: {
    fontSize: 10,
    color: '#999999',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  timerContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  timerText: {
    fontSize: 10,
    color: '#F44336',
    fontWeight: '500',
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
  disputeInfoHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  disputeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  disputeMeta: {
    marginBottom: 12,
  },
  disputeReasonLarge: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  disputeParticipants: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  urgencyBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  urgencyTextLarge: {
    fontSize: 12,
    fontWeight: '600',
  },
  resolutionTimer: {
    backgroundColor: '#FFF3F0',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  timerLabel: {
    fontSize: 12,
    color: '#FF6B35',
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  timelineSection: {
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
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
    marginTop: 2,
  },
  timelineDotCompleted: {
    backgroundColor: '#4CAF50',
  },
  timelineDotPending: {
    backgroundColor: '#E0E0E0',
  },
  timelineLine: {
    position: 'absolute',
    left: 6,
    top: 14,
    width: 2,
    height: 32,
    backgroundColor: '#E0E0E0',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTime: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  timelineDescription: {
    fontSize: 12,
    color: '#666666',
  },
  evidenceSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  photosContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  photoBlock: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  photoThumbnail: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  photoText: {
    fontSize: 12,
    color: '#1A73E8',
  },
  noPhotoText: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
  },
  otpSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  otpField: {
    fontSize: 14,
    color: '#666666',
  },
  otpValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  claimsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  claimBlock: {
    marginBottom: 20,
  },
  claimTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  claimContent: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  claimAuthor: {
    fontSize: 12,
    color: '#1A73E8',
    fontWeight: '500',
    marginBottom: 4,
  },
  claimText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  decisionSection: {
    padding: 20,
  },
  decisionOptions: {
    marginBottom: 20,
  },
  decisionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  decisionOptionSelected: {
    backgroundColor: '#E8F4FF',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1A73E8',
    margin: 5,
  },
  decisionLabel: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  notesSection: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
  },
  sendDecisionButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendDecisionButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  sendDecisionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DisputeResolution;
