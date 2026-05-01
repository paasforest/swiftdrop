import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { getAuth } from '../../authStore';
import { postJson } from '../../apiClient';

const ISSUES = [
  'Parcel not delivered',
  'Parcel arrived damaged',
  'Driver did not collect',
  'Wrong item delivered',
  'Driver was unprofessional',
  'Other',
];

const ACTIVE_OR_DONE = new Set([
  'pending',
  'matching',
  'accepted',
  'pickup_en_route',
  'pickup_arrived',
  'collected',
  'delivery_en_route',
  'delivery_arrived',
  'delivered',
  'completed',
  'unmatched',
  'disputed',
]);

/** Show for in-progress or completed; never for cancelled. */
export function shouldShowReportProblem(order) {
  if (!order?.status) return false;
  const s = String(order.status).toLowerCase();
  if (s === 'cancelled') return false;
  return ACTIVE_OR_DONE.has(s);
}

export function mapIssueToDisputeType(issue) {
  switch (issue) {
    case 'Parcel not delivered':
      return 'not_delivered';
    case 'Parcel arrived damaged':
      return 'damaged';
    case 'Driver did not collect':
      return 'other';
    case 'Wrong item delivered':
      return 'wrong_item';
    case 'Driver was unprofessional':
      return 'driver_behaviour';
    case 'Other':
    default:
      return 'other';
  }
}

export function buildDisputeDescription(issue, note) {
  const n = String(note || '').trim();
  let body = `Customer report: ${issue}.`;
  if (n) body += ` ${n}`;
  if (body.length < 20) {
    body = `${body} Please review this order and follow up with the customer.`;
  }
  return body;
}

export default function ReportProblemModal({ visible, onClose, orderId, orderStatus }) {
  const [selectedIssue, setSelectedIssue] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const reset = useCallback(() => {
    setSelectedIssue('');
    setReportNote('');
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  async function handleSubmitReport() {
    if (!selectedIssue || !orderId) return;
    const s = String(orderStatus || '').toLowerCase();
    if (!['delivered', 'completed'].includes(s)) {
      Alert.alert(
        'Delivery not complete yet',
        'You can submit a full report once your parcel is marked as delivered.',
        [{ text: 'OK' }]
      );
      return;
    }

    const auth = getAuth();
    if (!auth?.token) {
      Alert.alert('Error', 'Please sign in again.');
      return;
    }

    setSubmittingReport(true);
    try {
      const dispute_type = mapIssueToDisputeType(selectedIssue);
      const description = buildDisputeDescription(selectedIssue, reportNote);
      await postJson(
        '/api/disputes',
        {
          order_id: Number(orderId),
          dispute_type,
          description,
        },
        { token: auth.token }
      );
      handleClose();
      Alert.alert(
        'Report submitted',
        'We will review your report and contact you within 24 hours.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not submit report. Try again.');
    } finally {
      setSubmittingReport(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={{ fontSize: 16, color: '#9E9E9E' }}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Report a problem</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalLabel}>What went wrong?</Text>

          {ISSUES.map((issue) => (
            <TouchableOpacity
              key={issue}
              onPress={() => setSelectedIssue(issue)}
              style={[styles.issueOption, selectedIssue === issue && styles.issueSelected]}
            >
              <Text style={[styles.issueText, selectedIssue === issue && styles.issueTextSelected]}>{issue}</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.modalLabel, { marginTop: 16 }]}>Tell us more (optional)</Text>
          <TextInput
            style={styles.reportInput}
            placeholder="Describe what happened..."
            placeholderTextColor="#9E9E9E"
            multiline
            numberOfLines={4}
            value={reportNote}
            onChangeText={setReportNote}
          />

          <TouchableOpacity
            style={[styles.submitReport, !selectedIssue && { opacity: 0.4 }]}
            disabled={!selectedIssue || submittingReport}
            onPress={handleSubmitReport}
          >
            {submittingReport ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.submitReportText}>Submit report</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function ReportProblemButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.reportButton} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.reportButtonText}>Report a problem</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 10,
  },
  issueOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  issueSelected: {
    borderColor: '#000000',
    backgroundColor: '#F5F5F5',
  },
  issueText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  issueTextSelected: {
    color: '#000000',
    fontWeight: '700',
  },
  reportInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#000',
    minHeight: 100,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  submitReport: {
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitReportText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  reportButton: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    paddingVertical: 14,
    alignItems: 'center',
  },
  reportButtonText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
});
