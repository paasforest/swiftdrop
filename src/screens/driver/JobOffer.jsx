import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * Pending job offers require a driver-facing API (e.g. GET /job-offers).
 * Matching is handled on the server; this screen is a honest placeholder until that ships.
 */
const JobOffer = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Available jobs</Text>
        <Text style={styles.body}>
          When a customer order matches your route, a job offer will appear here. Push notifications
          can alert you when that endpoint is connected.
        </Text>
        <Text style={styles.hint}>
          For now, complete onboarding in the app and watch the driver home “Recent jobs” after you
          accept assignments from the operations flow.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width,
    height,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  body: {
    fontSize: 15,
    color: '#444444',
    lineHeight: 22,
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 28,
  },
  btn: {
    backgroundColor: '#1A73E8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default JobOffer;
