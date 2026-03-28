import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../services/firebaseConfig';
import { postJson } from '../../apiClient';
import { theme } from '../../theme/theme';

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function DeliveryCompleteScreen({ route, navigation }) {
  const { booking } = route.params;
  const bookingId = booking?.bookingId || booking?.id;

  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleDone = async () => {
    setSubmitting(true);
    if (rating > 0) {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        await postJson(`/api/bookings/${bookingId}/rate`, { rating }, { token, quiet: true });
      } catch { /* non-blocking */ }
    }
    setSubmitting(false);
    navigation.reset({ index: 0, routes: [{ name: 'SenderHome' }] });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        {/* Checkmark */}
        <View style={styles.checkWrap}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
        </View>

        <Text style={styles.title}>Delivered</Text>
        <Text style={styles.subtitle}>Your parcel reached its destination safely.</Text>

        {/* Proof card */}
        <View style={styles.proofCard}>
          <Text style={styles.proofLabel}>DELIVERY PROOF</Text>

          <Text style={styles.proofAddress} numberOfLines={2}>
            {booking?.dropoffAddress || booking?.dropoff_address || '—'}
          </Text>

          <Text style={styles.proofTime}>
            {formatTimestamp(booking?.delivered_at || booking?.deliveredAt || Date.now())}
          </Text>

          {(booking?.dropoffPhotoUrl || booking?.dropoff_photo_url) ? (
            <Image
              source={{ uri: booking.dropoffPhotoUrl || booking.dropoff_photo_url }}
              style={styles.proofPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.proofPhotoPlaceholder}>
              <Text style={styles.proofPhotoPlaceholderText}>Photo uploading…</Text>
            </View>
          )}
        </View>

        {/* Star rating */}
        <View style={styles.ratingWrap}>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
                style={styles.starBtn}
              >
                <Text style={[styles.star, rating >= star && styles.starFilled]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>
            {rating > 0 ? `${rating} star${rating > 1 ? 's' : ''}` : 'Rate your driver'}
          </Text>
        </View>

        {/* Done CTA */}
        <TouchableOpacity
          style={styles.cta}
          onPress={handleDone}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.obsidian,
  },
  inner: {
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 48,
    alignItems: 'center',
  },

  checkWrap: { marginBottom: 24 },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { fontSize: 40, color: theme.colors.obsidian, fontWeight: '700' },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textOnDarkMuted,
    textAlign: 'center',
    marginBottom: 36,
  },

  proofCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
  },
  proofLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  proofAddress: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.2,
    marginBottom: 6,
    lineHeight: 22,
  },
  proofTime: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  proofPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  proofPhotoPlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofPhotoPlaceholderText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },

  ratingWrap: {
    alignItems: 'center',
    marginBottom: 36,
  },
  stars: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  starBtn: { padding: 4 },
  star: {
    fontSize: 36,
    color: 'rgba(255,255,255,0.15)',
  },
  starFilled: {
    color: theme.colors.volt,
  },
  ratingLabel: {
    fontSize: 13,
    color: theme.colors.textOnDarkMuted,
  },

  cta: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.obsidian,
    letterSpacing: 0.2,
  },
});
