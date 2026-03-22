import React from 'react';
import { Modal, View, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';

export default function FullImageModal({ visible, uri, onClose }) {
  if (!uri) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.closeHit} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.textWhite} />
        </Pressable>
        <Image source={{ uri }} style={styles.img} resizeMode="contain" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    padding: 16,
  },
  closeHit: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    padding: 8,
  },
  img: {
    width: '100%',
    height: '80%',
  },
});
