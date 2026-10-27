import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertCircle, Eye, ListOrdered, CheckCircle2 } from 'lucide-react-native';

interface RegistrationUpdateHeaderBannerProps {
  isUpdateMode?: boolean;
  onlyIncompleteSteps?: boolean;
  stepIndex: number;
  totalSteps?: number;
  incompleteStepsCount?: number;
  currentIncompleteStepNumber?: number;
  missingFields?: string[];
  onToggleViewAllSteps?: () => void;
}

export const RegistrationUpdateHeaderBanner: React.FC<RegistrationUpdateHeaderBannerProps> = ({
  isUpdateMode = false,
  onlyIncompleteSteps = true,
  stepIndex,
  totalSteps = 7,
  incompleteStepsCount = 0,
  currentIncompleteStepNumber = 1,
  missingFields,
  onToggleViewAllSteps,
}) => {
  if (!isUpdateMode) return null;

  return (
    <View style={styles.container}>
      {onlyIncompleteSteps ? (
        <View style={styles.incompleteBanner}>
          <View style={styles.topRow}>
            <View style={styles.badgeWrap}>
              <AlertCircle size={14} color="#D97706" />
              <Text style={styles.badgeText}>
                MISSING STEP {currentIncompleteStepNumber || 1} OF {incompleteStepsCount || 1}
              </Text>
            </View>
            {onToggleViewAllSteps && (
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={onToggleViewAllSteps}
                activeOpacity={0.8}
              >
                <Eye size={12} color="#F05A22" />
                <Text style={styles.toggleBtnText}>View All Steps / Edit Completed Details</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.descriptionText}>
            Showing only incomplete steps that require your attention.
            {missingFields && missingFields.length > 0
              ? ` Required: ${missingFields.join(', ')}`
              : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.allStepsBanner}>
          <View style={styles.topRow}>
            <View style={styles.allBadgeWrap}>
              <ListOrdered size={14} color="#0284C7" />
              <Text style={styles.allBadgeText}>
                STEP {stepIndex} OF {totalSteps} • VIEWING ALL STEPS
              </Text>
            </View>
            {onToggleViewAllSteps && incompleteStepsCount > 0 && (
              <TouchableOpacity
                style={styles.incompleteToggleBtn}
                onPress={onToggleViewAllSteps}
                activeOpacity={0.8}
              >
                <AlertCircle size={12} color="#D97706" />
                <Text style={styles.incompleteToggleText}>Show Missing Steps Only ({incompleteStepsCount})</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.allDescriptionText}>
            Prepopulated with your saved details. You can review and edit any completed step.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  incompleteBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  allStepsBanner: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  allBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  allBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369A1',
    letterSpacing: 0.5,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F05A22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F05A22',
  },
  incompleteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  incompleteToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  descriptionText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
  },
  allDescriptionText: {
    fontSize: 11,
    color: '#0C4A6E',
    lineHeight: 15,
  },
});
