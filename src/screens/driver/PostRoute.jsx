import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView, TextInput } from 'react-native';

const { width, height } = Dimensions.get('window');

const PostRoute = () => {
  const [fromCity, setFromCity] = useState('Worcester');
  const [toCity, setToCity] = useState('Cape Town');
  const [departureDate, setDepartureDate] = useState(new Date().toLocaleDateString());
  const [departureTime, setDepartureTime] = useState('09:00');
  const [bootSpace, setBootSpace] = useState('medium');
  const [maxParcels, setMaxParcels] = useState(2);

  const bootSpaceOptions = ['Small', 'Medium', 'Large'];

  const handlePostRoute = () => {
    console.log('Post route:', {
      from: fromCity,
      to: toCity,
      date: departureDate,
      time: departureTime,
      bootSpace,
      maxParcels
    });
  };

  const handleBack = () => {
    console.log('Back pressed');
  };

  const handleInfo = () => {
    console.log('Show info about posting routes');
  };

  const incrementParcels = () => {
    if (maxParcels < 5) {
      setMaxParcels(maxParcels + 1);
    }
  };

  const decrementParcels = () => {
    if (maxParcels > 1) {
      setMaxParcels(maxParcels - 1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Post Your Route</Text>
          <TouchableOpacity onPress={handleInfo}>
            <Text style={styles.infoIcon}>ℹ️</Text>
          </TouchableOpacity>
        </View>

        {/* Explanation */}
        <View style={styles.explanationContainer}>
          <Text style={styles.explanationText}>
            Share where you are going and earn by delivering parcels along your way.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {/* From City */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>From</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>📍</Text>
              <TextInput
                style={styles.input}
                value={fromCity}
                onChangeText={setFromCity}
                placeholder="Starting city"
              />
            </View>
          </View>

          {/* To City */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>To</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>📍</Text>
              <TextInput
                style={styles.input}
                value={toCity}
                onChangeText={setToCity}
                placeholder="Destination city"
              />
            </View>
          </View>

          {/* Departure Date */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Departure Date</Text>
            <TouchableOpacity style={styles.dateContainer}>
              <Text style={styles.dateIcon}>📅</Text>
              <Text style={styles.dateText}>{departureDate}</Text>
            </TouchableOpacity>
          </View>

          {/* Departure Time */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Departure Time</Text>
            <TouchableOpacity style={styles.timeContainer}>
              <Text style={styles.timeIcon}>🕐</Text>
              <Text style={styles.timeText}>{departureTime}</Text>
            </TouchableOpacity>
          </View>

          {/* Boot Space */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Boot Space</Text>
            <View style={styles.chipsContainer}>
              {bootSpaceOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.chip,
                    bootSpace === option.toLowerCase() && styles.chipSelected
                  ]}
                  onPress={() => setBootSpace(option.toLowerCase())}
                >
                  <Text style={[
                    styles.chipText,
                    bootSpace === option.toLowerCase() && styles.chipTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Max Parcels */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Max Parcels</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={decrementParcels}
                disabled={maxParcels <= 1}
              >
                <Text style={[
                  styles.stepperText,
                  maxParcels <= 1 && styles.stepperTextDisabled
                ]}>
                  −
                </Text>
              </TouchableOpacity>
              
              <View style={styles.stepperValue}>
                <Text style={styles.stepperNumber}>{maxParcels}</Text>
              </View>
              
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={incrementParcels}
                disabled={maxParcels >= 5}
              >
                <Text style={[
                  styles.stepperText,
                  maxParcels >= 5 && styles.stepperTextDisabled
                ]}>
                  +
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Notice Banner */}
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeIcon}>🔔</Text>
          <Text style={styles.noticeText}>
            You will be notified when parcels match your route. You choose which ones to accept.
          </Text>
        </View>
      </ScrollView>

      {/* Post Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.postButton} onPress={handlePostRoute}>
          <Text style={styles.postButtonText}>Post Route</Text>
        </TouchableOpacity>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backArrow: {
    fontSize: 24,
    color: '#1A73E8',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  infoIcon: {
    fontSize: 20,
    color: '#666666',
  },
  explanationContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  explanationText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 4,
  },
  inputIcon: {
    fontSize: 20,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
  },
  dateIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
  },
  timeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  timeText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  chip: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#1A73E8',
    borderColor: '#1A73E8',
  },
  chipText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 4,
  },
  stepperButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperText: {
    fontSize: 20,
    color: '#1A73E8',
    fontWeight: 'bold',
  },
  stepperTextDisabled: {
    color: '#CCCCCC',
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  noticeBanner: {
    backgroundColor: '#FFF3CD',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 100,
  },
  noticeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
  },
  postButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PostRoute;
