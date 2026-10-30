import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Building2, Truck, User, Check, X } from 'lucide-react-native';
import { MobileRole } from '../../types';

interface AccountTypeBottomSheetProps {
  visible: boolean;
  selectedRole: MobileRole;
  onSelectRole: (role: MobileRole) => void;
  onClose: () => void;
}

interface RoleOption {
  role: MobileRole;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export const AccountTypeBottomSheet: React.FC<AccountTypeBottomSheetProps> = ({
  visible,
  selectedRole,
  onSelectRole,
  onClose,
}) => {
  const options: RoleOption[] = [
    {
      role: 'CLIENT',
      title: 'Client',
      description: 'Book and manage your shipments.',
      icon: <Building2 size={22} color="#172B4D" strokeWidth={2} />,
    },
    {
      role: 'VENDOR',
      title: 'Vendor',
      description: 'Manage your fleet and services.',
      icon: <Truck size={22} color="#172B4D" strokeWidth={2} />,
    },
    {
      role: 'DRIVER',
      title: 'Driver',
      description: 'Access your trips and deliveries.',
      icon: <User size={22} color="#172B4D" strokeWidth={2} />,
    },
  ];

  const handleSelect = (role: MobileRole) => {
    onSelectRole(role);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Drag Handle Indicator */}
              <View style={styles.dragHandle} />

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>Select Account Type</Text>
                  <Text style={styles.subtitle}>Choose your operational role to continue</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                  accessibilityLabel="Close"
                >
                  <X size={18} color="#7B8798" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>

              {/* Options List */}
              <View style={styles.optionsList}>
                {options.map((opt) => {
                  const isSelected = selectedRole === opt.role;

                  return (
                    <TouchableOpacity
                      key={opt.role}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => handleSelect(opt.role)}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
                        {opt.icon}
                      </View>

                      <View style={styles.optionTextWrap}>
                        <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                          {opt.title}
                        </Text>
                        <Text style={styles.optionDesc}>{opt.description}</Text>
                      </View>

                      <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                        {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: '#7B8798',
    marginTop: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  optionsList: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E0E8',
    borderRadius: 14,
    padding: 14,
  },
  optionCardSelected: {
    borderColor: '#F15A24',
    backgroundColor: '#FFF7ED',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F4F6F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconWrapSelected: {
    backgroundColor: '#FFE9DE',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: '#F15A24',
  },
  optionDesc: {
    fontSize: 12.5,
    color: '#7B8798',
    lineHeight: 17,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D9E0E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkCircleSelected: {
    backgroundColor: '#F15A24',
    borderColor: '#F15A24',
  },
});
