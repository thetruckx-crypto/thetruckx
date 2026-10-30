import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { AlertCircle, X } from 'lucide-react-native';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onDismiss,
  style,
}) => {
  if (!message) return null;

  return (
    <View style={[styles.container, style]}>
      <AlertCircle size={18} color="#DC3545" style={styles.icon} />
      <Text style={styles.message}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <X size={14} color="#DC3545" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 8,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    flex: 1,
    fontSize: 13,
    color: '#DC3545',
    fontWeight: '500',
    lineHeight: 18,
  },
  dismissBtn: {
    padding: 4,
    marginLeft: 6,
  },
});
