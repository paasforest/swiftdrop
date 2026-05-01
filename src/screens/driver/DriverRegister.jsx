import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { postJson } from '../../apiClient';
import { API_BASE_URL } from '../../apiConfig';
import { getAuth, setAuth } from '../../authStore';

const TERMS_ERROR = 'Please agree to the SwiftDrop terms to continue.';

function normalizeAssetType(type) {
  if (type && typeof type === 'string' && type.startsWith('image/')) return type;
  return 'image/jpeg';
}

function fileNameFromUri(uri, fallback) {
  const parts = String(uri).split('/');
  const last = parts[parts.length - 1];
  if (last && last.includes('.')) return last;
  return fallback;
}

function UnderReviewBody({ applicationPath }) {
  const isUber = applicationPath === 'uber_bolt';
  return (
    <View style={styles.underReviewCard}>
      <Text style={styles.underReviewTitle}>Application Under Review</Text>
      <Text style={styles.underReviewText}>
        {isUber
          ? 'We are verifying your Uber/Bolt profile. Approval usually takes 2–4 hours.'
          : 'We are reviewing your application. This usually takes 24–48 hours.'}
      </Text>
      <Text style={styles.underReviewSub}>
        After approval, you can log in and start accepting deliveries.
      </Text>
    </View>
  );
}

const DriverRegister = ({ navigation }) => {
  const [applicationPath, setApplicationPath] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [profilePhoto, setProfilePhoto] = useState(null);

  const [uberProfileScreenshot, setUberProfileScreenshot] = useState(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehiclePhotoExisting, setVehiclePhotoExisting] = useState(null);

  const [idDocument, setIdDocument] = useState(null);
  const [driverLicence, setDriverLicence] = useState(null);
  const [vehicleRegistration, setVehicleRegistration] = useState(null);
  const [licenseDisc, setLicenseDisc] = useState(null);
  const [selfieWithId, setSelfieWithId] = useState(null);
  const [vehiclePhoto, setVehiclePhoto] = useState(null);
  const [sapsClearance, setSapsClearance] = useState(null);

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [underReview, setUnderReview] = useState(false);
  const [underReviewPath, setUnderReviewPath] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (pendingSubmit) {
        const auth = getAuth();
        if (auth?.token) {
          setPendingSubmit(false);
          submitApplication();
        }
      }
    }, [pendingSubmit])
  );

  const requestPickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload documents.');
      return null;
    }
    return true;
  }, []);

  const pickSingleImage = useCallback(
    async (setter) => {
      const ok = await requestPickImage();
      if (!ok) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      setter({
        uri: asset.uri,
        type: normalizeAssetType(asset.type),
        fileName: asset.fileName || fileNameFromUri(asset.uri, 'upload.jpg'),
      });
    },
    [requestPickImage]
  );

  async function pickDocument(setter) {
    const ok = await requestPickImage();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    setter({
      uri: asset.uri,
      type: normalizeAssetType(asset.type),
      fileName: asset.fileName || fileNameFromUri(asset.uri, 'upload.jpg'),
    });
  }

  async function takeSelfie(setter) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take your selfie with ID.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
      cameraType: ImagePicker.CameraType.front,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    setter({
      uri: asset.uri,
      type: normalizeAssetType(asset.type),
      fileName: asset.fileName || fileNameFromUri(asset.uri, 'selfie.jpg'),
    });
  }

  const validateCommon = () => {
    if (!termsAccepted) return TERMS_ERROR;
    if (!fullName.trim()) return 'Full name is required.';
    if (!email.trim()) return 'Email is required.';
    if (!phone.trim()) return 'Phone number is required.';
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    if (!profilePhoto) return 'Profile photo is required.';
    return null;
  };

  const validateUber = () => {
    if (!uberProfileScreenshot) return 'Uber/Bolt profile screenshot is required.';
    if (!vehiclePhotoExisting) return 'Vehicle photo is required.';
    if (!vehicleMake.trim()) return 'Vehicle make is required.';
    if (!vehicleModel.trim()) return 'Vehicle model is required.';
    if (!vehicleYear.trim()) return 'Vehicle year is required.';
    if (!vehicleColor.trim()) return 'Vehicle colour is required.';
    if (!vehiclePlate.trim()) return 'Vehicle plate number is required.';
    return null;
  };

  const validateNewDriver = () => {
    if (!idDocument) return 'SA ID document is required.';
    if (!driverLicence) return "Driver's licence is required.";
    if (!vehicleRegistration) return 'Vehicle registration is required.';
    if (!licenseDisc) return 'License disc is required.';
    if (!selfieWithId) return 'Selfie with ID is required.';
    if (!vehiclePhoto) return 'Vehicle photo is required.';
    if (!vehicleMake.trim()) return 'Vehicle make is required.';
    if (!vehicleModel.trim()) return 'Vehicle model is required.';
    if (!vehicleYear.trim()) return 'Vehicle year is required.';
    if (!vehicleColor.trim()) return 'Vehicle colour is required.';
    if (!vehiclePlate.trim()) return 'Vehicle plate number is required.';
    return null;
  };

  const handleSendOtpOrRegister = async () => {
    setErrorMessage(null);
    const commonErr = validateCommon();
    if (commonErr) { setErrorMessage(commonErr); return; }
    if (applicationPath === 'uber_bolt') {
      const uberErr = validateUber();
      if (uberErr) { setErrorMessage(uberErr); return; }
    }
    if (applicationPath === 'new_driver') {
      const newErr = validateNewDriver();
      if (newErr) { setErrorMessage(newErr); return; }
    }

    setBusy(true);
    try {
      const data = await postJson('/api/auth/register-driver', {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      if (data.phoneVerificationRequired === false && data.token && data.refreshToken) {
        setAuth({ token: data.token, refreshToken: data.refreshToken, user: data.user });
        await submitApplication();
        return;
      }

      setPendingSubmit(true);
      navigation.navigate('DriverOTPScreen', { phone: phone.trim() });
    } catch (e) {
      setErrorMessage(e.message || 'Driver registration failed');
    } finally {
      setBusy(false);
    }
  };

  const appendImageFile = (formData, key, asset) => {
    if (!asset) return;
    formData.append(key, { uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || `${key}.jpg` });
  };

  const submitApplication = async () => {
    if (hasSubmitted) return;
    const auth = getAuth();
    if (!auth?.token) throw new Error('Not signed in. Please verify OTP again.');
    if (!applicationPath) throw new Error('Missing application path.');

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('application_path', applicationPath);

      if (applicationPath === 'uber_bolt') {
        appendImageFile(formData, 'selfie', profilePhoto);
        appendImageFile(formData, 'uber_profile_screenshot', uberProfileScreenshot);
        appendImageFile(formData, 'vehicle_photo', vehiclePhotoExisting);
        formData.append('vehicle_make', vehicleMake.trim());
        formData.append('vehicle_model', vehicleModel.trim());
        formData.append('vehicle_year', vehicleYear.trim());
        formData.append('vehicle_color', vehicleColor.trim());
        formData.append('vehicle_plate', vehiclePlate.trim());
      }
      if (applicationPath === 'new_driver') {
        appendImageFile(formData, 'selfie', selfieWithId || profilePhoto);
        appendImageFile(formData, 'national_id', idDocument);
        appendImageFile(formData, 'drivers_license', driverLicence);
        appendImageFile(formData, 'vehicle_registration', vehicleRegistration);
        appendImageFile(formData, 'license_disc', licenseDisc);
        appendImageFile(formData, 'saps_clearance', sapsClearance);
        appendImageFile(formData, 'vehicle_photo_front', vehiclePhoto);
        appendImageFile(formData, 'vehicle_photo_back', vehiclePhoto);
        appendImageFile(formData, 'vehicle_photo_side', vehiclePhoto);
        formData.append('vehicle_make', vehicleMake.trim());
        formData.append('vehicle_model', vehicleModel.trim());
        formData.append('vehicle_year', vehicleYear.trim());
        formData.append('vehicle_color', vehicleColor.trim());
        formData.append('vehicle_plate', vehiclePlate.trim().toUpperCase());
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/driver/submit-application`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
        body: formData,
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!res.ok) throw new Error(json?.error || `Submit failed with HTTP ${res.status}`);

      setHasSubmitted(true);
      setUnderReviewPath(applicationPath);
      setUnderReview(true);
    } catch (e) {
      setErrorMessage(e.message || 'Application submission failed');
    } finally {
      setBusy(false);
    }
  };

  const renderPathPicker = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>How do you want to join?</Text>

      {[
        { key: 'uber_bolt', title: 'Existing Uber/Bolt Driver', sub: 'Already driving? Fast-track with your existing profile.' },
        { key: 'new_driver', title: 'New Driver Application', sub: 'Apply from scratch with documents and vehicle photos.' },
      ].map((p) => {
        const selected = applicationPath === p.key;
        return (
          <TouchableOpacity
            key={p.key}
            style={[styles.pathCard, selected && styles.pathCardSelected]}
            onPress={() => setApplicationPath(p.key)}
          >
            <View style={styles.pathCardRow}>
              <View style={styles.pathCardText}>
                <Text style={[styles.pathTitle, selected && styles.pathTitleSelected]}>{p.title}</Text>
                <Text style={styles.pathSub}>{p.sub}</Text>
              </View>
              {selected && (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkCircleText}>✓</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderAccountDetails = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Your details</Text>
      <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#9E9E9E" value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#9E9E9E" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor="#9E9E9E" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#9E9E9E" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor="#9E9E9E" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setTermsAccepted(!termsAccepted)}>
        <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
          {termsAccepted && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>I agree to the SwiftDrop Terms & Conditions</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProfilePhoto = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Profile photo</Text>
      <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setProfilePhoto)}>
        <Ionicons name="camera-outline" size={18} color="#000000" style={{ marginRight: 8 }} />
        <Text style={styles.uploadButtonText}>{profilePhoto ? '✓ Photo selected' : 'Upload profile photo'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderUberPath = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Uber / Bolt profile</Text>
      <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setUberProfileScreenshot)}>
        <Ionicons name="image-outline" size={18} color="#000000" style={{ marginRight: 8 }} />
        <Text style={styles.uploadButtonText}>{uberProfileScreenshot ? '✓ Screenshot uploaded' : 'Upload Uber/Bolt screenshot'}</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Vehicle details</Text>
      <TextInput style={styles.input} placeholder="Make (e.g. Toyota)" placeholderTextColor="#9E9E9E" value={vehicleMake} onChangeText={setVehicleMake} />
      <TextInput style={styles.input} placeholder="Model" placeholderTextColor="#9E9E9E" value={vehicleModel} onChangeText={setVehicleModel} />
      <TextInput style={styles.input} placeholder="Year" placeholderTextColor="#9E9E9E" value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Colour" placeholderTextColor="#9E9E9E" value={vehicleColor} onChangeText={setVehicleColor} />
      <TextInput style={styles.input} placeholder="Plate number" placeholderTextColor="#9E9E9E" value={vehiclePlate} onChangeText={setVehiclePlate} />

      <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setVehiclePhotoExisting)}>
        <Ionicons name="car-outline" size={18} color="#000000" style={{ marginRight: 8 }} />
        <Text style={styles.uploadButtonText}>{vehiclePhotoExisting ? '✓ Vehicle photo selected' : 'Upload vehicle photo'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNewDriverPath = () => (
    <>
      <View style={styles.docsSection}>
        <Text style={styles.docsSectionTitle}>Required documents</Text>
        <Text style={styles.docsSectionSub}>Upload clear photos of your documents</Text>

        {[
          { label: 'SA ID document', key: 'id', value: idDocument, setter: setIdDocument, camera: false },
          { label: "Driver's licence", key: 'licence', value: driverLicence, setter: setDriverLicence, camera: false },
          { label: 'Vehicle registration', key: 'vehicle_reg', value: vehicleRegistration, setter: setVehicleRegistration, camera: false },
          { label: 'Licence disc', key: 'disc', value: licenseDisc, setter: setLicenseDisc, camera: false },
          { label: 'Selfie with ID', key: 'selfie', value: selfieWithId, setter: setSelfieWithId, camera: true },
          { label: 'Vehicle photo', key: 'vehicle_photo', value: vehiclePhoto, setter: setVehiclePhoto, camera: false },
        ].map((doc) => (
          <TouchableOpacity
            key={doc.key}
            style={[styles.docUploadRow, doc.value && styles.docUploadDone]}
            onPress={() => (doc.camera ? takeSelfie(doc.setter) : pickDocument(doc.setter))}
          >
            <View style={styles.docIcon}>
              <Text style={{ fontSize: 20 }}>{doc.value ? '✓' : '📄'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docLabel}>{doc.label}</Text>
              <Text style={styles.docStatus}>{doc.value ? 'Uploaded ✓' : 'Tap to upload'}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.docUploadRow, sapsClearance && styles.docUploadDone, { marginTop: 4 }]}
          onPress={() => pickDocument(setSapsClearance)}
        >
          <View style={styles.docIcon}>
            <Text style={{ fontSize: 20 }}>{sapsClearance ? '✓' : '📄'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.docLabel}>SAPS clearance (optional)</Text>
            <Text style={styles.docStatus}>{sapsClearance ? 'Uploaded ✓' : 'Tap to upload'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.vehicleSection}>
        <Text style={styles.docsSectionTitle}>Vehicle details</Text>

        {[
          { label: 'Make (e.g. Toyota)', value: vehicleMake, setter: setVehicleMake },
          { label: 'Model (e.g. Corolla)', value: vehicleModel, setter: setVehicleModel },
          { label: 'Year (e.g. 2019)', value: vehicleYear, setter: setVehicleYear, keyboard: 'numeric' },
          { label: 'Color', value: vehicleColor, setter: setVehicleColor },
          { label: 'Number plate', value: vehiclePlate, setter: setVehiclePlate, autoCapitalize: 'characters' },
        ].map((field) => (
          <TextInput
            key={field.label}
            style={styles.vehicleInput}
            placeholder={field.label}
            placeholderTextColor="#9E9E9E"
            value={field.value}
            onChangeText={field.setter}
            keyboardType={field.keyboard || 'default'}
            autoCapitalize={field.autoCapitalize || 'words'}
          />
        ))}
      </View>
    </>
  );

  const canSubmit = useMemo(() => {
    if (!applicationPath) return false;
    if (validateCommon()) return false;
    if (applicationPath === 'uber_bolt') return !validateUber();
    if (applicationPath === 'new_driver') return !validateNewDriver();
    return false;
  }, [applicationPath, termsAccepted, fullName, email, phone, password, confirmPassword, profilePhoto,
    uberProfileScreenshot, vehicleMake, vehicleModel, vehicleYear, vehicleColor, vehiclePlate, vehiclePhotoExisting,
    idDocument, driverLicence, vehicleRegistration, licenseDisc, sapsClearance, selfieWithId, vehiclePhoto]);

  if (underReview) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <UnderReviewBody applicationPath={underReviewPath} />
          <TouchableOpacity style={styles.registerButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.registerButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a driver</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Logo section */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.brandName}>Join SwiftDrop</Text>
          <Text style={styles.brandTagline}>Earn money on trips you already make</Text>
        </View>

        {renderPathPicker()}

        {applicationPath ? (
          <>
            {renderAccountDetails()}
            {renderProfilePhoto()}
            {applicationPath === 'uber_bolt' ? renderUberPath() : renderNewDriverPath()}
          </>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.registerButton, (!canSubmit || busy) && { opacity: 0.45 }]}
          onPress={handleSendOtpOrRegister}
          disabled={!canSubmit || busy}
        >
          {busy
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.registerButtonText}>Continue & Verify Phone</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000000' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000000' },
  logoSection: {
    alignItems: 'center', paddingTop: 32, paddingBottom: 24,
  },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#000000',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoText: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  brandName: { fontSize: 24, fontWeight: '700', color: '#000000', marginBottom: 4 },
  brandTagline: { fontSize: 13, color: '#9E9E9E', textAlign: 'center' },
  section: { paddingHorizontal: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#000000', marginBottom: 12 },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 15, color: '#000000', marginBottom: 12,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF', marginRight: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#000000', borderColor: '#000000' },
  checkboxMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  checkboxLabel: { fontSize: 14, color: '#000000', flex: 1, lineHeight: 20 },
  pathCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E0E0E0',
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  pathCardSelected: { borderColor: '#000000', backgroundColor: '#F5F5F5' },
  pathCardRow: { flexDirection: 'row', alignItems: 'center' },
  pathCardText: { flex: 1 },
  pathTitle: { fontSize: 15, fontWeight: '700', color: '#000000' },
  pathTitleSelected: { color: '#000000' },
  pathSub: { fontSize: 13, color: '#9E9E9E', marginTop: 3, lineHeight: 18 },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#00C853',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  checkCircleText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  uploadButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12,
  },
  uploadButtonText: { fontSize: 14, fontWeight: '600', color: '#000000' },
  errorBox: {
    marginHorizontal: 20, marginTop: 8, padding: 14,
    backgroundColor: '#FEE2E2', borderRadius: 12,
  },
  errorText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
  bottomContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F5F5F5',
  },
  registerButton: {
    backgroundColor: '#000000', borderRadius: 14, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  registerButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  underReviewCard: {
    backgroundColor: '#F5F5F5', borderRadius: 16, padding: 20, marginBottom: 20,
  },
  underReviewTitle: { fontSize: 20, fontWeight: '800', color: '#000000', marginBottom: 10 },
  underReviewText: { fontSize: 15, fontWeight: '500', color: '#000000', lineHeight: 22 },
  underReviewSub: { marginTop: 12, fontSize: 13, color: '#9E9E9E' },
  docsSection: {
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  docsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  docsSectionSub: {
    fontSize: 13,
    color: '#9E9E9E',
    marginBottom: 16,
  },
  docUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  docUploadDone: {
    borderColor: '#00C853',
    backgroundColor: '#F0FFF4',
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  docLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  docStatus: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  vehicleSection: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  vehicleInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000000',
    marginBottom: 10,
  },
});

export default DriverRegister;
