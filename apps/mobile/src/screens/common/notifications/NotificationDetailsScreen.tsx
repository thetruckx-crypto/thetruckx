import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {
  ArrowLeft,
  Truck,
  Package,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Share2,
} from 'lucide-react-native';
import { AppNotificationItem } from '../../../types';

interface NotificationDetailsScreenProps {
  notification: AppNotificationItem;
  onBack: () => void;
  onViewRelatedRecord?: (refId: string) => void;
}

export const NotificationDetailsScreen: React.FC<NotificationDetailsScreenProps> = ({
  notification,
  onBack,
  onViewRelatedRecord,
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'shipment':
        return <Truck size={22} color="#F05A22" />;
      case 'booking':
        return <Package size={22} color="#2563EB" />;
      case 'system':
      default:
        return <ShieldCheck size={22} color="#16A34A" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'shipment':
        return { label: 'Shipment Movement', bg: '#FFF5ED', text: '#F05A22' };
      case 'booking':
        return { label: 'Commercial Booking', bg: '#EFF6FF', text: '#2563EB' };
      case 'system':
      default:
        return { label: 'Operations Notice', bg: '#F0FDF4', text: '#16A34A' };
    }
  };

  const badge = getCategoryBadge(notification.category);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Notification Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Main Details Card */}
        <View style={styles.detailsCard}>
          {/* Badge & Icon Row */}
          <View style={styles.headerRow}>
            <View style={[styles.categoryBadge, { backgroundColor: badge.bg }]}>
              {getCategoryIcon(notification.category)}
              <Text style={[styles.categoryBadgeText, { color: badge.text }]}>
                {badge.label}
              </Text>
            </View>

            <View style={styles.timeWrap}>
              <Calendar size={13} color="#94A3B8" />
              <Text style={styles.timeText}>{notification.time}</Text>
            </View>
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.titleText}>{notification.title}</Text>
          <Text style={styles.subtitleText}>{notification.subtitle}</Text>

          {/* Reference ID Pill */}
          {notification.refId && (
            <View style={styles.refBox}>
              <Text style={styles.refLabel}>Reference Code:</Text>
              <Text style={styles.refValue}>{notification.refId}</Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* Full Content */}
          <Text style={styles.contentHeader}>Details & Status Update</Text>
          <Text style={styles.contentText}>
            {notification.content ||
              `${notification.subtitle}. For real-time updates and support, refer to the TRUCKS dispatch operations desk.`}
          </Text>
        </View>

        {/* Action Button: View Related Record */}
        {notification.refId && onViewRelatedRecord && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onViewRelatedRecord(notification.refId!)}
            activeOpacity={0.85}
            accessibilityLabel="View Related Record"
          >
            <ExternalLink size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>
              {notification.refId.startsWith('BOK')
                ? 'View Related Booking'
                : notification.refId.startsWith('REQ')
                ? 'View Related Requirement'
                : notification.refId.startsWith('TRP') ||
                  notification.refId.startsWith('NEC') ||
                  notification.refId.startsWith('SHP') ||
                  notification.category === 'shipment'
                ? 'View Live Tracking & Shipment'
                : 'View Related Record'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.backBtnBottom}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnBottomText}>Back to Notifications</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172B4D',
  },
  scrollContainer: {
    padding: 20,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 14,
  },
  refBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  refLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  refValue: {
    fontSize: 12.5,
    color: '#172B4D',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5EAF0',
    marginVertical: 14,
  },
  contentHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#172B4D',
    marginBottom: 6,
  },
  contentText: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 21,
  },
  actionBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  backBtnBottom: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  backBtnBottomText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
