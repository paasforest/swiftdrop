import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  TextInput,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import DriverAvatar from '../../components/customer/DriverAvatar';
import { formatDriverVehicleLine } from '../../utils/formatDriverVehicleLine';
import {
  formatDriverRatingDeliveriesLine,
  normalizeDriverDeliveriesCompleted,
} from '../../utils/driverTrustDisplay';

function normalizeDeliveryPhotoUrl(url) {
  if (url == null) return null;
  const s = String(url).trim();
  return s.length > 0 ? s : null;
}

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
  const driverPhotoParam = params.driverPhoto;
  const driverDeliveriesParam = params.driverDeliveriesCompleted;
  /** Immediate URL from TrackingWithMap; also accept delivery_photo_url for parity */
  const deliveryPhoto = normalizeDeliveryPhotoUrl(
    params.deliveryPhoto ?? params.delivery_photo_url
  );
  const fromAddress = params.fromAddress;
  const toAddress = params.toAddress;
  const totalPrice = params.totalPrice;
  const timeTaken = params.timeTaken;
  const basePrice = params.basePrice;
  const insuranceFee = params.insuranceFee;
  const commissionAmount = params.commissionAmount;

  const [orderDetails, setOrderDetails] = useState(null);
  const [orderLoading, setOrderLoading] = useState(Boolean(orderId));
  const [orderFetchError, setOrderFetchError] = useState(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageRetryKey, setImageRetryKey] = useState(0);
  const [photoPollExhausted, setPhotoPollExhausted] = useState(false);

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

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setOrderLoading(false);
      return;
    }
    const auth = getAuth();
    if (!auth?.token) {
      setOrderLoading(false);
      setOrderFetchError('Not signed in');
      return;
    }
    setOrderFetchError(null);
    setOrderLoading(true);
    try {
      const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
      setOrderDetails(data);
      setImageLoadError(false);
    } catch (e) {
      setOrderFetchError(e.message || 'Failed to load order');
    } finally {
      setOrderLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    setPhotoPollExhausted(false);
  }, [orderId]);

  /** Poll GET /api/orders/:id every 3s, max 10 tries (30s), until delivery_photo_url is set. */
  useEffect(() => {
    if (!orderId || !orderDetails) return;
    const photoFromOrder = normalizeDeliveryPhotoUrl(
      orderDetails.delivery_photo_url ?? orderDetails.deliveryPhotoUrl
    );
    if (photoFromOrder || deliveryPhoto) {
      setPhotoPollExhausted(false);
      return;
    }
    const st = orderDetails.status;
    if (st !== 'delivered' && st !== 'completed') return;

    let cancelled = false;
    let n = 0;
    const maxPolls = 10;
    const auth = getAuth();
    if (!auth?.token) return;

    const id = setInterval(async () => {
      if (cancelled) return;
      n += 1;
      if (n > maxPolls) {
        clearInterval(id);
        if (!cancelled) setPhotoPollExhausted(true);
        return;
      }
      try {
        const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        if (cancelled) return;
        setOrderDetails(data);
        if (normalizeDeliveryPhotoUrl(data?.delivery_photo_url ?? data?.deliveryPhotoUrl)) {
          clearInterval(id);
          setPhotoPollExhausted(false);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orderId, orderDetails?.status, orderDetails?.delivery_photo_url, orderDetails?.deliveryPhotoUrl, deliveryPhoto]);

  const displayDriverName = orderDetails?.driver_name || driverName;
  const displayDriverRating = orderDetails?.driver_rating ?? driverRating;
  const displayDriverPhoto =
    orderDetails?.driver_photo ?? driverPhotoParam ?? null;
  const displayVehicleLine = formatDriverVehicleLine(orderDetails);
  const displayDriverDeliveries = normalizeDriverDeliveriesCompleted(
    orderDetails?.driver_deliveries_completed ?? driverDeliveriesParam
  );
  const displayDriverTrustLine = formatDriverRatingDeliveriesLine({
    driver_rating: orderDetails?.driver_rating ?? driverRating,
    driver_deliveries_completed:
      orderDetails?.driver_deliveries_completed ?? driverDeliveriesParam,
  });
  const displayDeliveryPhoto = normalizeDeliveryPhotoUrl(
    orderDetails?.delivery_photo_url ??
      orderDetails?.deliveryPhotoUrl ??
      deliveryPhoto
  );
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
      navigation.navigate('Welcome');
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

  const photoUrl = displayDeliveryPhoto;
  const showImage = Boolean(photoUrl) && !imageLoadError;
  const imageUri = photoUrl
    ? imageRetryKey > 0
      ? `${photoUrl}${photoUrl.includes('?') ? '&' : '?'}_r=${imageRetryKey}`
      : photoUrl
    : null;

  const deliveredOrCompleted =
    orderDetails?.status === 'delivered' || orderDetails?.status === 'completed';
  const showProcessingPlaceholder =
    !orderLoading &&
    !orderFetchError &&
    !photoUrl &&
    !photoPollExhausted &&
    deliveredOrCompleted;
  const showPhotoUnavailablePlaceholder =
    !orderLoading &&
    !orderFetchError &&
    !photoUrl &&
    photoPollExhausted &&
    deliveredOrCompleted;

  return (
    <SafeAreaView style={styles.container}>
      {orderLoading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading order…</Text>
        </View>
      ) : null}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {orderFetchError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{orderFetchError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchOrder}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

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

          <View style={styles.photoSection}>
            <Text style={styles.proofLabel}>Proof of Delivery</Text>
            {!orderLoading && showImage && imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.deliveryImage}
                resizeMode="cover"
                onLoadStart={() => setImageLoadError(false)}
                onError={() => setImageLoadError(true)}
              />
            ) : null}
            {!orderLoading && photoUrl && imageLoadError ? (
              <View style={styles.imageErrorBox}>
                <Text style={styles.imageErrorText}>Photo unavailable</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    setImageLoadError(false);
                    setImageRetryKey((k) => k + 1);
                  }}
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {!orderLoading && showProcessingPlaceholder ? (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>Photo being processed…</Text>
              </View>
            ) : null}
            {!orderLoading && showPhotoUnavailablePlaceholder ? (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoUnavailableText}>Photo unavailable</Text>
              </View>
            ) : null}
          </View>

          {!submitted ? (
            <View style={styles.ratingSection}>
              <View style={styles.ratingDriverHeader}>
                <DriverAvatar
                  uri={displayDriverPhoto}
                  name={displayDriverName}
                  size={56}
                  deliveriesCompleted={displayDriverDeliveries}
                />
                <View style={styles.ratingDriverTextCol}>
                  <Text style={styles.ratingTitle}>
                    How was your experience with {displayDriverName}?
                  </Text>
                  {displayVehicleLine ? (
                    <Text style={styles.ratingVehicleLine}>{displayVehicleLine}</Text>
                  ) : null}
                  <Text style={styles.ratingTrustSubline}>{displayDriverTrustLine}</Text>
                </View>
              </View>

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
              <Text style={styles.priceLabel}>Parcel protection</Text>
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
  photoSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  proofLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  photoUnavailableText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  imageErrorBox: {
    width: '100%',
    minHeight: 120,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  imageErrorText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  ratingSection: {
    width: '100%',
    marginBottom: 32,
  },
  ratingDriverHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    width: '100%',
  },
  ratingDriverTextCol: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
    minHeight: 56,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'left',
    marginBottom: 6,
  },
  ratingVehicleLine: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  ratingTrustSubline: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
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
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.border,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default DeliveryConfirmed;
