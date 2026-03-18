import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView, TextInput } from 'react-native';

const { width, height } = Dimensions.get('window');

const DriverRegister = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Form state
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Document upload state
  const [documents, setDocuments] = useState({
    idDocument: null,
    driversLicense: null,
    vehicleRegistration: null,
    licenseDisc: null,
    sapsCertificate: null
  });

  const handleDocumentUpload = (docType) => {
    // Simulate document upload
    setDocuments(prev => ({
      ...prev,
      [docType]: {
        name: `${docType}_uploaded.pdf`,
        uploaded: true,
        uploadDate: new Date().toLocaleDateString()
      }
    }));
  };

  const handleContinue = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      console.log('Submit registration');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <Text style={styles.progressText}>Step {currentStep} of {totalSteps}</Text>
      <View style={styles.progressBar}>
        {[...Array(totalSteps)].map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressStep,
              index + 1 <= currentStep && styles.progressStepActive
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderPersonalDetails = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Personal Details</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
      />
      
      <TextInput
        style={styles.input}
        placeholder="ID Number"
        value={idNumber}
        onChangeText={setIdNumber}
        keyboardType="numeric"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <View style={styles.phoneContainer}>
        <Text style={styles.phonePrefix}>+27</Text>
        <TextInput
          style={styles.phoneInput}
          placeholder="Phone Number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );

  const renderDocumentUpload = () => {
    const documentTypes = [
      {
        id: 'idDocument',
        title: 'National ID',
        icon: '🆔',
        required: true
      },
      {
        id: 'driversLicense',
        title: "Driver's License",
        icon: '🚗',
        required: true
      },
      {
        id: 'vehicleRegistration',
        title: 'Vehicle Registration',
        icon: '📋',
        required: true
      },
      {
        id: 'licenseDisc',
        title: 'License Disc',
        icon: '💿',
        required: true
      },
      {
        id: 'sapsCertificate',
        title: 'SAPS Clearance Certificate',
        icon: '🏛️',
        required: false,
        badge: 'Optional but recommended'
      }
    ];

    return (
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Upload Your Documents</Text>
        
        <View style={styles.documentsGrid}>
          {documentTypes.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={[
                styles.documentCard,
                documents[doc.id]?.uploaded && styles.documentCardUploaded
              ]}
              onPress={() => handleDocumentUpload(doc.id)}
            >
              <View style={styles.documentHeader}>
                <Text style={styles.documentIcon}>{doc.icon}</Text>
                {!doc.required && (
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>Optional</Text>
                  </View>
                )}
              </View>
              
              <Text style={styles.documentTitle}>{doc.title}</Text>
              
              {documents[doc.id]?.uploaded ? (
                <View style={styles.uploadedInfo}>
                  <Text style={styles.uploadedFileName}>
                    {documents[doc.id].name}
                  </Text>
                  <Text style={styles.uploadedDate}>
                    {documents[doc.id].uploadDate}
                  </Text>
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.uploadPrompt}>
                  <Text style={styles.uploadText}>Tap to upload</Text>
                  <Text style={styles.uploadIcon}>📤</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Become a Driver</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Form Content */}
        <View style={styles.formContainer}>
          {currentStep === 1 && (
            <>
              {renderPersonalDetails()}
              {renderDocumentUpload()}
            </>
          )}
          
          {/* Add other steps here */}
          {currentStep > 1 && (
            <View style={styles.placeholderStep}>
              <Text style={styles.placeholderText}>Step {currentStep} content</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!fullName || !idNumber || !email || !phone) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!fullName || !idNumber || !email || !phone}
        >
          <Text style={styles.continueButtonText}>
            {currentStep === totalSteps ? 'Submit Application' : 'Continue to Vehicle Details'}
          </Text>
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
  placeholder: {
    width: 24,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  progressText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStep: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  progressStepActive: {
    backgroundColor: '#1A73E8',
    width: 24,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  formSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 16,
  },
  phonePrefix: {
    padding: 16,
    fontSize: 16,
    color: '#666666',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  documentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  documentCard: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    minHeight: 140,
  },
  documentCardUploaded: {
    borderColor: '#4CAF50',
    borderStyle: 'solid',
    backgroundColor: '#E8F5E8',
  },
  documentHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  documentIcon: {
    fontSize: 24,
  },
  optionalBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionalText: {
    fontSize: 10,
    color: '#856404',
    fontWeight: '500',
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadedInfo: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  uploadedFileName: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  uploadedDate: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  uploadPrompt: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadIcon: {
    fontSize: 20,
  },
  placeholderStep: {
    alignItems: 'center',
    padding: 40,
  },
  placeholderText: {
    fontSize: 18,
    color: '#666666',
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
  continueButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DriverRegister;
