import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson, patchJson } from '../../apiClient';
import { colors, spacing, radius, typography, shadows } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'open') return 'Open';
  if (s === 'in_review') return 'In Review';
  if (s === 'resolved') return 'Resolved';
  return s || '—';
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

const DisputeResolution = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const fetchDisputes = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setListError('Not signed in');
      setDisputes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const data = await getJson('/api/disputes?status=open&limit=50', { token: auth.token });
      setDisputes(Array.isArray(data.disputes) ? data.disputes : []);
    } catch (err) {
      console.error('Disputes fetch:', err);
      setListError(err.message || 'Failed to load disputes');
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDisputes();
    }, [fetchDisputes])
  );

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

  const handleSendDecision = async () => {
    if (!selectedDispute?.id || !decision) return;
    const auth = getAuth();
    if (!auth?.token) {
      Alert.alert('Error', 'Not signed in');
      return;
    }
    setSending(true);
    try {
      const body = {
        decision,
        resolution_note: notes.trim() || undefined,
      };
      if (decision === 'partial_refund') {
        const total = parseFloat(selectedDispute.total_price) || 0;
        body.refund_amount = Math.max(1, Math.round(total / 2));
      }
      await patchJson(`/api/disputes/${selectedDispute.id}/resolve`, body, { token: auth.token });
      Alert.alert('Success', 'Dispute updated.');
      handleCloseDetail();
      await fetchDisputes();
    } catch (e) {
      Alert.alert('Error', e.message || 'Request failed');
    } finally {
      setSending(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'Open':
        return colors.danger;
      case 'In Review':
        return colors.warning;
      case 'Resolved':
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  const getUrgencyBg = (urgency) => {
    switch (urgency) {
      case 'Open':
        return colors.dangerLight;
      case 'In Review':
        return colors.warningLight;
      case 'Resolved':
        return colors.successLight;
      default:
        return colors.background;
    }
  };

  const renderDisputeList = () => (
    <View style={styles.disputeList}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : listError ? (
        <Text style={styles.disputeDate}>{listError}</Text>
      ) : (
        disputes.map((dispute) => {
          const urgency = statusLabel(dispute.status);
          return (
            <TouchableOpacity
              key={String(dispute.id)}
              style={[
                styles.disputeCard,
                selectedDispute?.id === dispute.id && styles.disputeCardSelected,
              ]}
              onPress={() => handleSelectDispute(dispute)}
            >
              <View style={styles.disputeHeader}>
                <View style={styles.disputeInfo}>
                  <Text style={styles.disputeId}>#{dispute.id}</Text>
                  <Text style={styles.disputeReason}>{dispute.dispute_type || 'Dispute'}</Text>
                  <Text style={styles.disputeDetails}>
                    {(dispute.customer_name || 'Customer') + ' vs ' + (dispute.driver_name || 'Driver')}
                  </Text>
                  <Text style={styles.disputeDate}>{formatDate(dispute.created_at)}</Text>
                </View>
                <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyBg(urgency) }]}>
                  <Text style={[styles.urgencyText, { color: getUrgencyColor(urgency) }]}>{urgency}</Text>
                </View>
              </View>
              {urgency !== 'Resolved' && (
                <View style={styles.timerContainer}>
                  <Text style={styles.timerText}>Order: {dispute.order_number || dispute.order_id}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })
      )}
      {!loading && !listError && disputes.length === 0 ? (
        <Text style={styles.disputeDate}>No open disputes.</Text>
      ) : null}
    </View>
  );

  const renderTimeline = () => {
    if (!selectedDispute) return null;

    const pickupTime = formatDateTime(selectedDispute.pickup_confirmed_at);
    const deliveryTime = formatDateTime(selectedDispute.delivery_confirmed_at);

    const timelineEvents = [
      {
        time: pickupTime,
        title: 'Pickup',
        description: 'Driver collected parcel',
        status: selectedDispute.pickup_confirmed_at ? 'completed' : 'pending',
      },
      {
        time: deliveryTime,
        title: 'Delivery',
        description: 'Parcel delivered to recipient',
        status: selectedDispute.delivery_confirmed_at ? 'completed' : 'pending',
      },
      {
        time: formatDate(selectedDispute.created_at),
        title: 'Dispute opened',
        description: 'Customer filed dispute',
        status: 'completed',
      },
    ];

    return (
      <View style={styles.timelineSection}>
        <Text style={styles.sectionTitle}>Delivery Timeline</Text>
        {timelineEvents.map((event, index) => (
          <View key={index} style={styles.timelineItem}>
            <View
              style={[
                styles.timelineDot,
                event.status === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending,
              ]}
            />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTime}>{event.time}</Text>
              <Text style={styles.timelineTitle}>{event.title}</Text>
              <Text style={styles.timelineDescription}>{event.description}</Text>
            </View>
            {index < timelineEvents.length - 1 && <View style={styles.timelineLine} />}
          </View>
        ))}
      </View>
    );
  };

  const renderEvidence = () => {
    if (!selectedDispute) return null;

    const pickupUrl = selectedDispute.pickup_photo_url;
    const deliveryUrl = selectedDispute.delivery_photo_url;

    return (
      <View style={styles.evidenceSection}>
        <Text style={styles.sectionTitle}>Evidence</Text>

        <View style={styles.photosContainer}>
          <View style={styles.photoBlock}>
            <Text style={styles.photoLabel}>Pickup Photo</Text>
            {pickupUrl ? (
              <Image source={{ uri: pickupUrl }} style={styles.evidenceImage} resizeMode="cover" />
            ) : (
              <Text style={styles.noPhotoText}>No photo available</Text>
            )}
          </View>

          <View style={styles.photoBlock}>
            <Text style={styles.photoLabel}>Delivery Photo</Text>
            {deliveryUrl ? (
              <Image source={{ uri: deliveryUrl }} style={styles.evidenceImage} resizeMode="cover" />
            ) : (
              <Text style={styles.noPhotoText}>No photo available</Text>
            )}
          </View>
        </View>

        <View style={styles.otpSection}>
          <Text style={styles.otpLabel}>OTP confirmation</Text>
          <View style={styles.otpRow}>
            <Text style={styles.otpField}>Pickup OTP:</Text>
            <Text style={styles.otpValue}>
              {selectedDispute.pickup_confirmed_at
                ? `Confirmed at ${formatDateTime(selectedDispute.pickup_confirmed_at)}`
                : 'Not confirmed'}
            </Text>
          </View>
          <View style={styles.otpRow}>
            <Text style={styles.otpField}>Delivery OTP:</Text>
            <Text style={styles.otpValue}>
              {selectedDispute.delivery_confirmed_at
                ? `Confirmed at ${formatDateTime(selectedDispute.delivery_confirmed_at)}`
                : 'Not confirmed'}
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
        <Text style={styles.sectionTitle}>Claim</Text>

        <View style={styles.claimBlock}>
          <Text style={styles.claimTitle}>Customer description</Text>
          <View style={styles.claimContent}>
            <Text style={styles.claimAuthor}>{selectedDispute.customer_name || 'Customer'}</Text>
            <Text style={styles.claimText}>{selectedDispute.description || '—'}</Text>
          </View>
        </View>

        <View style={styles.claimBlock}>
          <Text style={styles.claimTitle}>Driver</Text>
          <View style={styles.claimContent}>
            <Text style={styles.claimAuthor}>{selectedDispute.driver_name || '—'}</Text>
            <Text style={styles.claimText}>
              Driver details are available on the order. No separate response is stored for this dispute.
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDecision = () => {
    if (!selectedDispute || String(selectedDispute.status).toLowerCase() === 'resolved') return null;

    return (
      <View style={styles.decisionSection}>
        <Text style={styles.sectionTitle}>Admin Decision</Text>

        <View style={styles.decisionOptions}>
          {[
            { value: 'refund', label: 'Refund Customer' },
            { value: 'no_refund', label: 'No Refund' },
            { value: 'partial_refund', label: 'Partial Refund' },
            { value: 'escalate', label: 'Escalate' },
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.decisionOption, decision === option.value && styles.decisionOptionSelected]}
              onPress={() => setDecision(option.value)}
            >
              <View style={styles.radioCircle}>{decision === option.value && <View style={styles.radioSelected} />}</View>
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
          style={[styles.sendDecisionButton, (!decision || sending) && styles.sendDecisionButtonDisabled]}
          onPress={handleSendDecision}
          disabled={!decision || sending}
        >
          <Text style={styles.sendDecisionButtonText}>{sending ? 'Sending…' : 'Send Decision'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDisputeDetail = () => {
    if (!selectedDispute) return null;

    const urgency = statusLabel(selectedDispute.status);

    return (
      <View style={styles.detailPanel}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>Dispute Resolution</Text>
          <TouchableOpacity onPress={handleCloseDetail}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.disputeInfoHeader}>
            <Text style={styles.disputeTitle}>#{selectedDispute.id}</Text>
            <View style={styles.disputeMeta}>
              <Text style={styles.disputeReasonLarge}>{selectedDispute.dispute_type || 'Dispute'}</Text>
              <Text style={styles.disputeParticipants}>
                {(selectedDispute.customer_name || 'Customer') + ' vs ' + (selectedDispute.driver_name || 'Driver')}
              </Text>
              <View style={[styles.urgencyBadgeLarge, { backgroundColor: getUrgencyBg(urgency) }]}>
                <Text style={[styles.urgencyTextLarge, { color: getUrgencyColor(urgency) }]}>{urgency}</Text>
              </View>
            </View>
          </View>

          {urgency !== 'Resolved' && (
            <View style={styles.resolutionTimer}>
              <Text style={styles.timerLabel}>Order</Text>
              <Text style={styles.timerValue}>{selectedDispute.order_number || selectedDispute.order_id}</Text>
            </View>
          )}

          {renderTimeline()}
          {renderEvidence()}
          {renderClaims()}
          {renderDecision()}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dispute Resolution</Text>
      </View>

      <View style={styles.content}>
        {renderDisputeList()}
        {renderDisputeDetail()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.textPrimary,
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
    backgroundColor: colors.textWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  disputeCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
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
    color: colors.textPrimary,
    marginBottom: 4,
  },
  disputeReason: {
    fontSize: 12,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  disputeDetails: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  disputeDate: {
    fontSize: 10,
    color: colors.textMuted,
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
    borderTopColor: colors.border,
  },
  timerText: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: '500',
  },
  detailPanel: {
    flex: 1,
    backgroundColor: colors.textWhite,
    borderRadius: 12,
    shadowColor: colors.black,
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
    borderBottomColor: colors.border,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeButton: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  disputeInfoHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  disputeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  disputeMeta: {
    marginBottom: 12,
  },
  disputeReasonLarge: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  disputeParticipants: {
    fontSize: 14,
    color: colors.textSecondary,
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
    backgroundColor: colors.accentLight,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  timerLabel: {
    fontSize: 12,
    color: colors.accent,
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  timelineSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
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
    backgroundColor: colors.success,
  },
  timelineDotPending: {
    backgroundColor: colors.border,
  },
  timelineLine: {
    position: 'absolute',
    left: 6,
    top: 14,
    width: 2,
    height: 32,
    backgroundColor: colors.border,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  timelineDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  evidenceSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.textPrimary,
    marginBottom: 8,
  },
  photoThumbnail: {
    backgroundColor: colors.background,
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
    color: colors.primary,
  },
  noPhotoText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  evidenceImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  otpSection: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  otpField: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  otpValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  claimsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  claimBlock: {
    marginBottom: 20,
  },
  claimTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  claimContent: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
  },
  claimAuthor: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  claimText: {
    fontSize: 14,
    color: colors.textPrimary,
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
    borderBottomColor: colors.border,
  },
  decisionOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    margin: 5,
  },
  decisionLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  notesSection: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
  },
  sendDecisionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendDecisionButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendDecisionButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DisputeResolution;
