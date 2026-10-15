import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Camera, Image as ImageIcon, FileText, X, ShieldCheck } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface PickedDocumentResult {
  uri: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  blob?: any;
}

interface DocumentPickerModalProps {
  visible: boolean;
  documentTitle: string;
  docType?: string;
  onClose: () => void;
  onFilePicked: (file: PickedDocumentResult) => void;
}

export const DocumentPickerModal: React.FC<DocumentPickerModalProps> = ({
  visible,
  documentTitle,
  docType = 'DOCUMENT',
  onClose,
  onFilePicked,
}) => {
  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '500 KB';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const validateSize = (bytes?: number): boolean => {
    if (bytes && bytes > 10 * 1024 * 1024) {
      Alert.alert(
        'File Too Large',
        'The selected document exceeds the 10 MB limit. Please select a smaller file or take a lower resolution photo.'
      );
      return false;
    }
    return true;
  };

  // 1. Take Photo with Device Camera
  const handleTakePhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'Please enable camera access in your device settings to take a photo of your certificate.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!validateSize(asset.fileSize)) return;

        const cleanExt = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
        const generatedName = `${docType.toLowerCase().replace(/_/g, '-')}-photo-${Date.now().toString().slice(-4)}.${cleanExt}`;

        onClose();
        onFilePicked({
          uri: asset.uri,
          fileName: asset.fileName || generatedName,
          fileSize: formatBytes(asset.fileSize),
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Failed to capture photo from camera.');
    }
  };

  // 2. Select Image from Photo Gallery / Storage
  const handleSelectImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Gallery Permission Required',
            'Please enable photo library access in your device settings to select document images.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!validateSize(asset.fileSize)) return;

        const cleanExt = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
        const generatedName = `${docType.toLowerCase().replace(/_/g, '-')}-gallery-${Date.now().toString().slice(-4)}.${cleanExt}`;

        onClose();
        onFilePicked({
          uri: asset.uri,
          fileName: asset.fileName || generatedName,
          fileSize: formatBytes(asset.fileSize),
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Failed to select image from photo library.');
    }
  };

  // 3. Browse PDF / Document from Local Storage
  const handleBrowseDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!validateSize(asset.size)) return;

        const cleanExt = (asset.name.split('.').pop() || 'pdf').toLowerCase();
        const generatedName = `${docType.toLowerCase().replace(/_/g, '-')}-doc-${Date.now().toString().slice(-4)}.${cleanExt}`;

        onClose();
        onFilePicked({
          uri: asset.uri,
          fileName: asset.name || generatedName,
          fileSize: formatBytes(asset.size),
          mimeType: asset.mimeType || (cleanExt === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        });
      }
    } catch (err: any) {
      Alert.alert('Document Error', err.message || 'Failed to browse document from device storage.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText}>Upload Document</Text>
              <Text style={styles.docSubtitle} numberOfLines={1}>
                {documentTitle}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Close picker dialog"
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Compliance Notice Banner */}
          <View style={styles.complianceNotice}>
            <ShieldCheck size={16} color="#16A779" />
            <Text style={styles.complianceNoticeText}>
              Ensure the document is clear, complete, and all 4 corners are visible. PDF or JPG under 10 MB.
            </Text>
          </View>

          {/* Option 1: Take Photo */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={handleTakePhoto}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#FFF5ED' }]}>
              <Camera size={22} color="#F15A29" />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={styles.optionTitle}>Take Photo with Camera</Text>
              <Text style={styles.optionDesc}>Capture physical certificate using device camera</Text>
            </View>
          </TouchableOpacity>

          {/* Option 2: Gallery Image */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={handleSelectImage}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
              <ImageIcon size={22} color="#16A779" />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={styles.optionTitle}>Choose from Photo Gallery</Text>
              <Text style={styles.optionDesc}>Select certificate photo stored on your device</Text>
            </View>
          </TouchableOpacity>

          {/* Option 3: PDF / Document */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={handleBrowseDocument}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <FileText size={22} color="#2563EB" />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={styles.optionTitle}>Browse PDF / Documents</Text>
              <Text style={styles.optionDesc}>Select scanned PDF or document file from storage</Text>
            </View>
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 25, 51, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#0B1933',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B1933',
  },
  docSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F15A29',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  complianceNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  complianceNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#166534',
    lineHeight: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0B1933',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    color: '#64748B',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
});
