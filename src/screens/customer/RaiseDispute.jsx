import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '../../authStore';
import { postJson } from '../../apiClient';

const REASONS = [
  { key: 'not_delivered', label: 'Parcel not delivered', icon: '📦' },
  { key: 'damaged', label: 'Parcel damaged', icon: '💔' },
  { key: 'wrong_item', label: 'Wrong item received', icon: '❌' },
  { key: 'late_delivery', label: 'Very late delivery', icon: '⏰' },
  { key: 'driver_behaviour', label: 'Driver behaviour', icon: '⚠️' },
  { key: 'other', label: 'Other issue', icon: '💬' },
];

const RaiseDispute = ({ navigation, route }) => {
  const orderId = route?.params?.orderId ?? null;
  const jobId = route?.params?.jobId ?? null;

  const [selectedReason, setSelectedReason] = useState(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const auth = getAuth();
      await postJson(
        '/api/disputes',
        {
          order_id: orderId || null,
          job_id: jobId || null,
          reason: selectedReason,
          description: description.trim(),
        },
        { token: auth.token }
      );
      Alert.alert(
        '✓ Dispute raised',
        'An admin will review your case within 24 hours. You will be notified via SMS.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not submit dispute');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a problem</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.sectionTitle}>What went wrong?</Text>

        {REASONS.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[styles.reasonCard, selectedReason === r.key && styles.reasonCardSelected]}
            onPress={() => setSelectedReason(r.key)}
          >
            <Text style={styles.reasonIcon}>{r.icon}</Text>
            <Text
              style={[
                styles.reasonLabel,
                selectedReason === r.key && styles.reasonLabelSelected,
              ]}
            >
              {r.label}
            </Text>
            {selectedReason === r.key ? <Text style={styles.checkmark}>✓</Text> : null}
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Describe the issue</Text>
        <TextInput
          style={styles.descInput}
          placeholder="Please provide as much detail as possible..."
          placeholderTextColor="#9E9E9E"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          maxLength={500}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            ℹ️ Disputes must be raised within 24 hours of delivery. An admin will review and respond
            within 24 hours.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!selectedReason || description.length < 10 || submitting) && { opacity: 0.4 },
          ]}
          disabled={!selectedReason || description.length < 10 || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit dispute</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backArrow: {
    fontSize: 22,
    color: '#000',
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reasonCardSelected: {
    borderColor: '#000000',
    backgroundColor: '#FAFAFA',
  },
  reasonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  reasonLabel: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
    flex: 1,
  },
  reasonLabelSelected: {
    color: '#000000',
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 16,
    color: '#00C853',
    fontWeight: '700',
  },
  descInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#000',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#9E9E9E',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  infoText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default RaiseDispute;
