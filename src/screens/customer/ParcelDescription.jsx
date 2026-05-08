import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

function parseEstimatedValueToNumber(range) {
  const v = String(range ?? '').trim();
  if (!v) return null;

  if (/^\d+(\.\d+)?$/.test(v)) {
    return Number(v);
  }

  if (v.toLowerCase().startsWith('under')) {
    const m = v.match(/R(\d+(?:\.\d+)?)/i);
    return m ? Number(m[1]) : null;
  }

  const parts = v.replace(/to/gi, '-').split('-').map((x) => x.replace(/[^\d.]/g, ''));
  if (parts.length === 2) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (!Number.isNaN(a) && !Number.isNaN(b)) return Math.round((a + b) / 2);
  }

  const m = v.match(/R(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

const ParcelDescription = ({ navigation, route }) => {
  const baseParams = route?.params || {};
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSize, setSelectedSize] = useState('medium');
  const [estimatedValue, setEstimatedValue] = useState('500');
  const [fragile, setFragile] = useState(false);
  const [upright, setUpright] = useState(false);
  const [careful, setCareful] = useState(false);
  const [prohibitedConfirmed, setProhibitedConfirmed] = useState(false);
  const [showProhibitedModal, setShowProhibitedModal] = useState(false);

  const categories = [
    { id: 'documents', name: 'Documents & Paperwork', icon: '📄' },
    { id: 'hardware', name: 'Hardware & Contractor Parts', icon: '🔧' },
    { id: 'clothing', name: 'Clothing & Personal', icon: '👕' },
    { id: 'business', name: 'Small Business Stock', icon: '📦' },
    { id: 'electronics', name: 'Small Electronics', icon: '💻' },
    { id: 'gifts', name: 'Gifts & Parcels', icon: '🎁' },
    { id: 'other', name: 'Other', icon: '❓' },
  ];

  const prohibitedItems = [
    '🚫 Illegal drugs or substances',
    '🚫 Weapons, firearms, or explosives',
    '🚫 Hazardous materials or chemicals',
    '🚫 Perishable food items',
    '🚫 Live animals or plants',
    '🚫 Stolen goods or counterfeit items',
    '🚫 Cash or negotiable instruments',
    '🚫 Pornographic or obscene materials',
  ];

  const sizes = [
    { id: 'small', name: 'Small', icon: '🎒', description: 'Fits in a backpack' },
    { id: 'medium', name: 'Medium', icon: '📦', description: 'Shoebox size' },
    { id: 'large', name: 'Large', icon: '🧳', description: 'Suitcase size' },
  ];

  const trimmedValue = String(estimatedValue ?? '').trim();
  const parsedParcelValue =
    trimmedValue === ''
      ? 0
      : parseEstimatedValueToNumber(trimmedValue);

  let valueError = null;
  if (trimmedValue !== '') {
    if (parsedParcelValue === null) valueError = 'Enter a valid amount (numbers only, or e.g. R200-R500)';
    else if (parsedParcelValue < 0) valueError = 'Amount cannot be negative';
  }

  const goPriceConfirm = () => {
    const parcel_value = trimmedValue === '' ? 0 : parsedParcelValue ?? 0;
    const special_handling = JSON.stringify({ fragile, upright, careful });
    navigation.navigate('PriceConfirm', {
      pickup_address: baseParams.pickup_address,
      pickup_lat: baseParams.pickup_lat,
      pickup_lng: baseParams.pickup_lng,
      dropoff_address: baseParams.dropoff_address,
      dropoff_lat: baseParams.dropoff_lat,
      dropoff_lng: baseParams.dropoff_lng,
      parcel_size: selectedSize,
      parcel_type: selectedCategory,
      parcel_value,
      special_handling,
    });
  };

  const handleNext = () => {
    if (!selectedCategory || !selectedSize || valueError) return;
    if (!prohibitedConfirmed) {
      setShowProhibitedModal(true);
    } else {
      goPriceConfirm();
    }
  };

  const handleProhibitedConfirm = () => {
    if (!selectedCategory || !selectedSize || valueError) return;
    setProhibitedConfirmed(true);
    setShowProhibitedModal(false);
    goPriceConfirm();
  };

  const nextDisabled =
    !selectedCategory || !selectedSize || valueError != null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parcel details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
      >

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '50%' }]} />
          </View>
          <Text style={styles.progressText}>Step 2 of 4</Text>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WHAT ARE YOU SENDING?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.categoriesScrollContent}
          >
            <View style={styles.categoriesContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  activeOpacity={0.7}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category.id && styles.categoryChipSelected,
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category.id && styles.categoryTextSelected,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Size */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PARCEL SIZE</Text>
          <View style={styles.sizesContainer}>
            {sizes.map((size) => (
              <TouchableOpacity
                key={size.id}
                style={[
                  styles.sizeCard,
                  selectedSize === size.id && styles.sizeCardSelected,
                ]}
                onPress={() => setSelectedSize(size.id)}
              >
                <Text style={styles.sizeIcon}>{size.icon}</Text>
                <Text style={styles.sizeName}>{size.name}</Text>
                <Text style={styles.sizeDescription}>{size.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Value — default 500 (Option B); leave blank for R0 insurance */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ESTIMATED VALUE (ZAR)</Text>
          <TextInput
            style={[styles.valueInput, valueError ? styles.valueInputError : null]}
            value={estimatedValue}
            onChangeText={(t) => setEstimatedValue(t)}
            keyboardType="decimal-pad"
            placeholder="500"
            placeholderTextColor="#BDBDBD"
          />
          {valueError ? (
            <Text style={styles.valueErrorText}>{valueError}</Text>
          ) : (
            <Text style={styles.valueHint}>Used for insurance. Clear field for R0.</Text>
          )}
        </View>

        {/* Special Handling */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SPECIAL HANDLING</Text>

          {[
            { label: 'Fragile', value: fragile, onToggle: () => setFragile(!fragile) },
            { label: 'Keep Upright', value: upright, onToggle: () => setUpright(!upright) },
            { label: 'Handle with Care', value: careful, onToggle: () => setCareful(!careful) },
          ].map(({ label, value, onToggle }) => (
            <TouchableOpacity key={label} style={styles.toggleItem} onPress={onToggle}>
              <View style={[styles.toggle, value && styles.toggleOn]}>
                <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
              </View>
              <Text style={styles.toggleLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* Next Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.nextButton, nextDisabled && { opacity: 0.45 }]}
          onPress={handleNext}
          disabled={nextDisabled}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      </KeyboardAvoidingView>

      {/* Prohibited Items Modal */}
      {showProhibitedModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Prohibited Items</Text>
            <Text style={styles.modalSubtitle}>
              Before we continue, please confirm your parcel does NOT contain any of the following:
            </Text>

            <ScrollView style={styles.prohibitedList} showsVerticalScrollIndicator={false}>
              {prohibitedItems.map((item, index) => (
                <View key={index} style={styles.prohibitedItem}>
                  <Text style={styles.prohibitedText}>{item}</Text>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.modalWarning}>
              By confirming, you agree that your parcel complies with our terms and conditions.
              Sending prohibited items may result in legal action.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowProhibitedModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleProhibitedConfirm}>
                <Text style={styles.confirmButtonText}>I Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardFlex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000000' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#000000',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  categoriesScrollContent: {
    flexGrow: 0,
    alignItems: 'center',
    paddingRight: 20,
  },
  categoriesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  valueInputError: {
    borderColor: '#D32F2F',
  },
  valueErrorText: {
    marginTop: 8,
    fontSize: 13,
    color: '#D32F2F',
  },
  valueHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#9E9E9E',
  },
  categoryChip: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  sizesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sizeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  sizeCardSelected: {
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#F5F5F5',
  },
  sizeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  sizeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  sizeDescription: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  valueContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  valueOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  valueOptionSelected: {
    backgroundColor: '#F5F5F5',
  },
  valueText: {
    fontSize: 16,
    color: '#000000',
  },
  valueTextSelected: {
    color: '#000000',
    fontWeight: '700',
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggle: {
    width: 48,
    height: 24,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    marginRight: 16,
  },
  toggleOn: {
    backgroundColor: '#00C853',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    margin: 2,
    alignSelf: 'flex-start',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#000000',
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  nextButton: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  prohibitedList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  prohibitedItem: {
    backgroundColor: '#FFF9EB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  prohibitedText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  modalWarning: {
    fontSize: 12,
    color: '#92400E',
    backgroundColor: '#FFF9EB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    lineHeight: 18,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ParcelDescription;
