import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { MobileRole } from '../../types';

interface AccountTypeSelectorProps {
  selectedRole: MobileRole;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export const AccountTypeSelector: React.FC<AccountTypeSelectorProps> = ({
  selectedRole,
  onPress,
  style,
}) => {
  const getRoleDisplayName = (r: MobileRole): string => {
    switch (r) {
      case 'CLIENT':
        return 'Client';
      case 'VENDOR':
        return 'Vendor';
      case 'DRIVER':
        return 'Driver';
      default:
        return 'Client';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Login as ${getRoleDisplayName(selectedRole)}. Tap to change account type.`}
    >
      <View style={styles.textWrap}>
        <Text style={styles.label}>Login as</Text>
        <Text style={styles.roleValue}>{getRoleDisplayName(selectedRole)}</Text>
      </View>
      <ChevronDown size={18} color="#172B4D" strokeWidth={2.4} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E0E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7B8798',
    marginBottom: 4,
  },
  roleValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
  },
});
