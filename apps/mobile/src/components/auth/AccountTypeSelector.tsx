import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
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

  const roleName = getRoleDisplayName(selectedRole);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Login as ${roleName}. Tap to change account type.`}
      accessibilityHint="Opens account type selector bottom sheet"
    >
      <View style={styles.textColumn}>
        <Text style={styles.label}>Login as</Text>
        <Text style={styles.roleValue}>{roleName}</Text>
      </View>

      <ChevronDown
        size={20}
        color="#172B4D"
        strokeWidth={2}
        style={styles.chevron}
      />
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
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
      },
      android: {
        elevation: 0.5,
      },
    }),
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7B8798',
    letterSpacing: 0.2,
    lineHeight: 16,
    includeFontPadding: false,
    marginBottom: 2,
  },
  roleValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
    letterSpacing: -0.2,
    lineHeight: 22,
    includeFontPadding: false,
  },
  chevron: {
    marginLeft: 12,
  },
});
