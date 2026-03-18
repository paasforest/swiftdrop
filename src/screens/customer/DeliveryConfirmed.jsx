import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView, TextInput } from 'react-native';

const { width, height } = Dimensions.get('window');

const DeliveryConfirmed = () => {
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const deliveryDetails = {
    address: '456 Oak Avenue, Cape Town',
    timeTaken: '47 minutes',
    driverName: 'Sipho M.',
    deliveryId: '#SD2024031801'
  };

  const handleStarPress = (starRating) => {
    setRating(starRating);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    console.log('Rating submitted:', { rating, comment, deliveryDetails });
  };

  const handleSkip = () => {
    console.log('Rating skipped');
  };

  const handleViewPhoto = () => {
    console.log('View delivery photo');
  };

  const renderStars = () => {
    return [1, 2, 3, 4, 5].map((star) => (
      <TouchableOpacity
        key={star}
        onPress={() => handleStarPress(star)}
        style={styles.starButton}
      >
        <Text style={[
          styles.star,
          star <= rating && styles.starFilled
        ]}>
          {star <= rating ? '⭐' : '☆'}
        </Text>
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Success Animation */}
          <View style={styles.successContainer}>
            <View style={styles.successCircle}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          </View>

          {/* Success Message */}
          <Text style={styles.successTitle}>Delivered!</Text>
          <Text style={styles.successSubtitle}>
            Your parcel has been successfully delivered
          </Text>

          {/* Delivery Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Delivery Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivered to:</Text>
              <Text style={styles.summaryValue}>{deliveryDetails.address}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time taken:</Text>
              <Text style={styles.summaryValue}>{deliveryDetails.timeTaken}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Driver:</Text>
              <Text style={styles.summaryValue}>{deliveryDetails.driverName}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery ID:</Text>
              <Text style={styles.summaryValue}>{deliveryDetails.deliveryId}</Text>
            </View>
          </View>

          {/* Proof of Delivery */}
          <TouchableOpacity style={styles.photoContainer} onPress={handleViewPhoto}>
            <View style={styles.photoThumbnail}>
              <Text style={styles.photoIcon}>📷</Text>
            </View>
            <Text style={styles.photoText}>Proof of Delivery — tap to view</Text>
          </TouchableOpacity>

          {/* Rating Section */}
          {!submitted && (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>
                How was your experience with {deliveryDetails.driverName}?
              </Text>
              
              <View style={styles.starsContainer}>
                {renderStars()}
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
            </View>
          )}

          {/* Submitted Confirmation */}
          {submitted && (
            <View style={styles.submittedContainer}>
              <Text style={styles.submittedText}>Thank you for your feedback!</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {!submitted ? (
              <>
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                  <Text style={styles.submitButtonText}>Submit Rating</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.doneButton} onPress={() => console.log('Go to home')}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmark: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
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
    color: '#666666',
    width: 100,
  },
  summaryValue: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    textAlign: 'right',
    fontWeight: '500',
  },
  photoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  photoThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
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
    color: '#1A73E8',
    fontWeight: '500',
  },
  ratingSection: {
    width: '100%',
    marginBottom: 32,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
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
    fontSize: 40,
    color: '#E0E0E0',
  },
  starFilled: {
    color: '#FFA500',
  },
  commentInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    width: '100%',
    minHeight: 80,
  },
  submittedContainer: {
    padding: 20,
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    width: '100%',
    marginBottom: 32,
  },
  submittedText: {
    fontSize: 16,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  submitButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '500',
  },
  doneButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeliveryConfirmed;
