import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { getAuth } from '../../authStore';
import { postJson } from '../../apiClient';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

const RatingScreen = ({ navigation, route }) => {
  const { orderId, driverName, driverInitial, deliveryAddress } = route?.params || {};
  const auth = getAuth();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await postJson(
        `/api/ratings/order/${orderId}`,
        { rating, comment },
        { token: auth?.token }
      );
      navigation.replace('Home');
    } catch (err) {
      Alert.alert('Error', 'Could not submit rating. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rate your delivery</Text>
      </View>

      {/* Driver info */}
      <View style={styles.driverCard}>
        <View style={styles.driverAvatar}>
          <Text style={styles.driverInitial}>{driverInitial || 'D'}</Text>
        </View>
        <Text style={styles.driverName}>{driverName || 'Your Driver'}</Text>
        <Text style={styles.deliveryInfo}>Delivered to {deliveryAddress}</Text>
      </View>

      {/* Star rating */}
      <View style={styles.starsSection}>
        <Text style={styles.starsLabel}>How was your experience?</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              style={styles.starButton}
            >
              <Text style={[styles.starIcon, star <= rating && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingLabel}>{RATING_LABELS[rating] || 'Tap to rate'}</Text>
      </View>

      {/* Optional comment */}
      <View style={styles.commentSection}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment (optional)"
          placeholderTextColor="#9E9E9E"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, rating === 0 && { opacity: 0.4 }]}
        onPress={handleSubmit}
        disabled={rating === 0 || submitting}
      >
        {submitting
          ? <ActivityIndicator color="#FFFFFF" size="small" />
          : <Text style={styles.submitText}>Submit rating</Text>
        }
      </TouchableOpacity>

      {/* Skip */}
      <TouchableOpacity style={styles.skipButton} onPress={() => navigation.replace('Home')}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    alignItems: 'center', paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000000' },
  driverCard: { alignItems: 'center', paddingVertical: 32 },
  driverAvatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#000000',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  driverInitial: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  driverName: { fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 4 },
  deliveryInfo: { fontSize: 13, color: '#9E9E9E' },
  starsSection: { alignItems: 'center', paddingVertical: 16 },
  starsLabel: { fontSize: 15, color: '#757575', marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  starButton: { padding: 4 },
  starIcon: { fontSize: 48, color: '#E0E0E0' },
  starActive: { color: '#FFB800' },
  ratingLabel: { fontSize: 14, fontWeight: '600', color: '#000000', height: 20 },
  commentSection: { paddingHorizontal: 20, marginTop: 8 },
  commentInput: {
    backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16,
    fontSize: 15, color: '#000000', minHeight: 80, textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#000000', borderRadius: 14, height: 56,
    marginHorizontal: 20, marginTop: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  skipButton: { alignItems: 'center', marginTop: 16, padding: 8 },
  skipText: { fontSize: 14, color: '#9E9E9E' },
});

export default RatingScreen;
