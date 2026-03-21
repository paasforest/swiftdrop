import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  TextInput,
  Image,
  Animated,
} from 'react-native';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

const DeliveryConfirmed = ({ navigation, route }) => {
  const params = route?.params || {};

  const orderId = params.orderId;
  const driverName = params.driverName || 'your driver';
  const driverRating = params.driverRating;
  const deliveryPhoto = params.deliveryPhoto;
  const fromAddress = params.fromAddress;
  const toAddress = params.toAddress;
  const totalPrice = params.totalPrice;
  const timeTaken = params.timeTaken;
  const basePrice = params.basePrice;
  const insuranceFee = params.insuranceFee;
  const commissionAmount = params.commissionAmount;

  const [orderDetails, setOrderDetails] = useState(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const checkScale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.timing(checkScale, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [checkScale]);

  useEffect(() => {
    if (!orderId) return;
    const auth = getAuth();
    if (!auth?.token) return;

    let cancelled = false;
    let attempts = 0;

    async function fetchOnce() {
      attempts += 1;
      try {
        const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        if (cancelled) return;
        setOrderDetails(data);

        if (data?.delivery_photo_url) return;
        if (attempts < 10) setTimeout(fetchOnce, 3000);
      } catch {
        // If fetching fails, keep showing the best data we already have.
      }
    }

    fetchOnce();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const displayDriverName = orderDetails?.driver_name || driverName;
  const displayDriverRating = orderDetails?.driver_rating ?? driverRating;
  const displayDeliveryPhoto = orderDetails?.delivery_photo_url || deliveryPhoto;
  const displayFromAddress = orderDetails?.pickup_address || fromAddress;
  const displayToAddress = orderDetails?.dropoff_address || toAddress;
  const displayTotalPrice = orderDetails?.total_price ?? totalPrice;
  const displayTimeTaken = timeTaken || null;
  const displayBasePrice = orderDetails?.base_price ?? basePrice;
  const displayInsuranceFee = orderDetails?.insurance_fee ?? insuranceFee;
  const currentDriverStars = useMemo(() => {
    const v = Number(displayDriverRating);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.max(1, Math.min(5, Math.round(v)));
  }, [displayDriverRating]);

  const handleSubmitRating = async () => {
    if (!orderId) {
      alert('Missing order id');
      return;
    }
    if (rating < 1) {
      alert('Please choose a star rating (1 to 5).');
      return;
    }

    const auth = getAuth();
    if (!auth?.token) {
      navigation.navigate('Login');
      return;
    }

    setSubmitting(true);
    try {
      await postJson(
        '/api/ratings',
        { orderId, rating, comment: comment || null },
        { token: auth.token }
      );
      setSubmitted(true);
    } catch (e) {
      alert(e.message || 'Rating submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRatingStars = (interactive) => {
    const filled = interactive ? rating : currentDriverStars;
    return [1, 2, 3, 4, 5].map((star) => (
      <TouchableOpacity
        key={star}
        disabled={!interactive}
        onPress={() => interactive && setRating(star)}
        style={styles.starButton}
      >
        <Text
          style={[
            styles.star,
            star <= filled ? styles.starFilled : styles.starEmpty,
          ]}
        >
          {star <= filled ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.successContainer}>
            <Animated.View style={[styles.successCircle, { transform: [{ scale: checkScale }] }]}>
              <Text style={styles.checkmark}>✓</Text>
            </Animated.View>
          </View>

          <Text style={styles.successTitle}>Delivered!</Text>
          <Text style={styles.successSubtitle}>
            Your parcel has been successfully delivered
          </Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Delivery Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>From:</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{displayFromAddress || '-'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>To:</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{displayToAddress || '-'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time taken:</Text>
              <Text style={styles.summaryValue}>{displayTimeTaken || '-'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Driver:</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{displayDriverName}</Text>
            </View>
          </View>

          <View style={styles.photoContainer}>
            <View style={styles.photoThumbnail}>
              <Ionicons name="camera-outline" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.photoText}>Proof of Delivery</Text>
              {displayDeliveryPhoto ? (
                <Image source={{ uri: displayDeliveryPhoto }} style={styles.deliveryImage} />
              ) : (
                <Text style={styles.photoMissing}>Loading delivery photo…</Text>
              )}
            </View>
          </View>

          {!submitted ? (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>How was your experience with {displayDriverName}?</Text>

              <View style={styles.starsContainer}>
                {renderRatingStars(true)}
              </View>

              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment (optional)"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.7 }]}
                onPress={handleSubmitRating}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting…' : 'Submit Rating'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.submittedContainer}>
              <Text style={styles.submittedText}>Thank you for your feedback!</Text>
            </View>
          )}

          <View style={styles.priceBreakdown}>
            <Text style={styles.priceTitle}>Price breakdown</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery fee</Text>
              <Text style={styles.priceValue}>{formatMoney(displayBasePrice)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Insurance</Text>
              <Text style={styles.priceValue}>{formatMoney(displayInsuranceFee)}</Text>
            </View>
            <View style={[styles.priceRow, styles.priceTotalRow]}>
              <Text style={[styles.priceLabel, { color: colors.textPrimary, fontWeight: '900' }]}>Total</Text>
              <Text style={[styles.priceValue, { color: colors.textPrimary, fontWeight: '900' }]}>{formatMoney(displayTotalPrice)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          })}>
            <Text style={styles.doneButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.textWhite,
    width: width,
    height: height,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  successContainer: {
    marginBottom: 24,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmark: {
    fontSize: 40,
    color: colors.textWhite,
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    width: 100,
  },
  summaryValue: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'right',
    fontWeight: '500',
  },
  photoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  photoIcon: {
    fontSize: 24,
  },
  photoText: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  ratingSection: {
    width: '100%',
    marginBottom: 32,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  starButton: {
    marginHorizontal: 8,
  },
  star: {
    fontSize: 38,
  },
  starFilled: {
    color: colors.warning,
  },
  starEmpty: {
    color: colors.border,
  },
  commentInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    width: '100%',
    minHeight: 80,
  },
  submittedContainer: {
    padding: 20,
    backgroundColor: colors.successLight,
    borderRadius: 12,
    width: '100%',
    marginBottom: 32,
  },
  submittedText: {
    fontSize: 16,
    color: colors.success,
    textAlign: 'center',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
    width: '100%',
  },
  doneButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  deliveryImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: colors.border,
  },
  photoMissing: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 10,
  },
  priceBreakdown: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 18,
  },
  priceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  priceValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '900',
  },
  priceTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginBottom: 0,
  },
});

export default DeliveryConfirmed;
