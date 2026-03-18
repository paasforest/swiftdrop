import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        <Text style={styles.title}>🎉 SwiftDrop</Text>
        <Text style={styles.subtitle}>Your app is working!</Text>
        <Text style={styles.message}>
          If you can see this, the basic setup is correct.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1A73E8',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 20,
  },
});
