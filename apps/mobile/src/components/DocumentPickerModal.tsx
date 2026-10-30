import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Camera, Image as ImageIcon, FileText, X, ShieldCheck, Sparkles } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  compressMobileImage,
  isOptimizableImage,
  formatBytes,
} from '../utils/mobileImageCompressor';

export interface PickedDocumentResult {
  uri: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  blob?: any;
  originalSize?: string;
  compressedSize?: string;
  compressionRatio?: string;
  isCompressed?: boolean;
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
  const [isCompressing, setIsCompressing] = useState(false);

  const validateSize = (bytes?: number): boolean => {
    if (bytes && bytes > 20 * 1024 * 1024) {
      Alert.alert(
        'File Too Large',
        'The selected document exceeds the 20 MB system limit. Please select a smaller file.'
      );
      return false;
    }
    return true;
  };

  // 1. Take Photo via Native Camera
  const handleTakePhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'Please enable camera permissions in your device settings to take a document photo.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!validateSize(asset.fileSize)) return;

        const cleanExt = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
        const generatedName = `${docType.toLowerCase().replace(/_/g, '-')}-photo-${Date.now().toString().slice(-4)}.${cleanExt}`;

        setIsCompressing(true);
        try {
          const comp = await compressMobileImage(asset.uri);
          setIsCompressing(false);
          onClose();
          onFilePicked({
            uri: comp.uri,
            fileName: asset.fileName || generatedName,
            fileSize: comp.sizeLabel,
            mimeType: 'image/jpeg',
            originalSize: comp.originalSizeFormatted,
            compressedSize: comp.compressedSizeFormatted,
            compressionRatio: `${comp.savingsPercentage}% reduction`,
            isCompressed: comp.wasCompressed,
          });
        } catch (compErr: any) {
          setIsCompressing(false);
          onClose();
          onFilePicked({
            uri: asset.uri,
            fileName: asset.fileName || generatedName,
            fileSize: formatBytes(asset.fileSize),
            mimeType: asset.mimeType || 'image/jpeg',
          });
        }
      }
    } catch (err: any) {
      setIsCompressing(false);
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
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!validateSize(asset.fileSize)) return;

        const cleanExt = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
        const generatedName = `${docType.toLowerCase().replace(/_/g, '-')}-gallery-${Date.now().toString().slice(-4)}.${cleanExt}`;

        setIsCompressing(true);
        try {
          const comp = await compressMobileImage(asset.uri);
          setIsCompressing(false);
          onClose();
          onFilePicked({
            uri: comp.uri,
            fileName: asset.fileName || generatedName,
            fileSize: comp.sizeLabel,
            mimeType: 'image/jpeg',
            originalSize: comp.originalSizeFormatted,
            compressedSize: comp.compressedSizeFormatted,
            compressionRatio: `${comp.savingsPercentage}% reduction`,
            isCompressed: comp.wasCompressed,
          });
        } catch (compErr: any) {
          setIsCompressing(false);
          onClose();
          onFilePicked({
            uri: asset.uri,
            fileName: asset.fileName || generatedName,
            fileSize: formatBytes(asset.fileSize),
            mimeType: asset.mimeType || 'image/jpeg',
          });
        }
      }
    } catch (err: any) {
      setIsCompressing(false);
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

        if (isOptimizableImage(asset.name || asset.mimeType || '')) {
          setIsCompressing(true);
          try {
            const comp = await compressMobileImage(asset.uri);
            setIsCompressing(false);
            onClose();
            onFilePicked({
              uri: comp.uri,
              fileName: asset.name || generatedName,
              fileSize: comp.sizeLabel,
              mimeType: 'image/jpeg',
              originalSize: comp.originalSizeFormatted,
              compressedSize: comp.compressedSizeFormatted,
              compressionRatio: `${comp.savingsPercentage}% reduction`,
              isCompressed: comp.wasCompressed,
            });
          } catch {
            setIsCompressing(false);
            onClose();
            onFilePicked({
              uri: asset.uri,
              fileName: asset.name || generatedName,
              fileSize: formatBytes(asset.size),
              mimeType: asset.mimeType || 'image/jpeg',
            });
          }
        } else {
          // PDF or non-raster document
          onClose();
          onFilePicked({
            uri: asset.uri,
            fileName: asset.name || generatedName,
            fileSize: formatBytes(asset.size),
            mimeType: asset.mimeType || (cleanExt === 'pdf' ? 'application/pdf' : 'image/jpeg'),
            originalSize: formatBytes(asset.size),
            compressedSize: formatBytes(asset.size),
            isCompressed: false,
          });
        }
      }
    } catch (err: any) {
      setIsCompressing(false);
      Alert.alert('Document Error', err.message || 'Failed to browse document from device storage.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isCompressing ? undefined : onClose}
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
              disabled={isCompressing}
              accessibilityLabel="Close picker dialog"
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {isCompressing ? (
            /* Active Compression Loader */
            <View style={styles.compressingWrap}>
              <View style={styles.compressingIconCircle}>
                <Sparkles size={28} color="#F15A29" />
              </View>
              <ActivityIndicator size="large" color="#F15A29" style={{ marginVertical: 14 }} />
              <Text style={styles.compressingTitle}>Optimizing Document</Text>
              <Text style={styles.compressingDesc}>
                Compressing high-resolution photo and computing optimized file footprint...
              </Text>
            </View>
          ) : (
            <>
              {/* Compliance Notice Banner */}
              <View style={styles.complianceNotice}>
                <ShieldCheck size={16} color="#16A779" />
                <Text style={styles.complianceNoticeText}>
                  Images are automatically compressed to ensure fast uploads while preserving 100% text legibility.
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
            </>
          )}
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
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B1933',
    letterSpacing: -0.2,
  },
  docSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
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
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 16,
  },
  complianceNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#15803D',
    lineHeight: 16,
    fontWeight: '500',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
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
    fontWeight: '600',
    color: '#0B1933',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  compressingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compressingIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compressingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B1933',
    marginBottom: 6,
  },
  compressingDesc: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
});
