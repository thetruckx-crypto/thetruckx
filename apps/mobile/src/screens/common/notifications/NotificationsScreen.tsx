import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  Truck,
  Package,
  Info,
  CheckCheck,
  ChevronRight,
  ShieldCheck,
  FileText,
  CreditCard,
  AlertTriangle,
  Sparkles,
} from 'lucide-react-native';
import { AppNotificationItem, MobileRole } from '../../../types';
import { authService } from '../../../services/authService';

interface NotificationsScreenProps {
  onBack: () => void;
  onSelectNotification: (item: AppNotificationItem) => void;
  role?: MobileRole;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  onSelectNotification,
  role: propRole,
}) => {
  const [currentRole, setCurrentRole] = useState<MobileRole>(propRole || 'CLIENT');
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load session role and notifications
  const loadNotifications = useCallback(async () => {
    try {
      const session = await authService.getCurrentSession();
      const effectiveRole = propRole || session?.role || 'CLIENT';
      setCurrentRole(effectiveRole);

      const data = await authService.fetchRealNotifications(session?.userId, effectiveRole);
      setNotifications(data || []);
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propRole]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Filter tabs tailored per role
  const filterTabs = useMemo(() => {
    if (currentRole === 'VENDOR') {
      return [
        { id: 'all', label: 'All' },
        { id: 'requirement', label: 'RFQs' },
        { id: 'quotation', label: 'Quotes' },
        { id: 'booking', label: 'Bookings' },
        { id: 'shipment', label: 'Trips' },
        { id: 'document', label: 'Docs' },
        { id: 'payment', label: 'Payouts' },
      ];
    }
    if (currentRole === 'DRIVER') {
      return [
        { id: 'all', label: 'All' },
        { id: 'shipment', label: 'Trips & Routes' },
        { id: 'document', label: 'POD & Docs' },
        { id: 'system', label: 'Alerts' },
      ];
    }
    // Default Client Role
    return [
      { id: 'all', label: 'All' },
      { id: 'requirement', label: 'Requests' },
      { id: 'quotation', label: 'Bids' },
      { id: 'booking', label: 'Bookings' },
      { id: 'shipment', label: 'Shipments' },
      { id: 'payment', label: 'Payments' },
    ];
  }, [currentRole]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((item) => item.category === activeFilter);
  }, [notifications, activeFilter]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'shipment':
        return <Truck size={18} color="#F05A22" />;
      case 'booking':
        return <Package size={18} color="#2563EB" />;
      case 'quotation':
        return <Sparkles size={18} color="#D97706" />;
      case 'requirement':
        return <Package size={18} color="#4F46E5" />;
      case 'payment':
        return <CreditCard size={18} color="#059669" />;
      case 'document':
        return <FileText size={18} color="#7C3AED" />;
      case 'system':
      default:
        return <ShieldCheck size={18} color="#16A34A" />;
    }
  };

  const getIconBg = (category: string) => {
    switch (category) {
      case 'shipment':
        return '#FFF5ED';
      case 'booking':
        return '#EFF6FF';
      case 'quotation':
        return '#FEF3C7';
      case 'requirement':
        return '#EEF2FF';
      case 'payment':
        return '#ECFDF5';
      case 'document':
        return '#F5F3FF';
      case 'system':
      default:
        return '#F0FDF4';
    }
  };

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

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.topBarTitle}>Notifications</Text>
          <Text style={styles.topBarSub}>
            {currentRole === 'CLIENT'
              ? 'Client Shipper Console'
              : currentRole === 'VENDOR'
              ? 'Fleet Partner Portal'
              : 'Driver Cab Dashboard'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={styles.markReadBtn}
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
            accessibilityLabel="Mark all as read"
          >
            <CheckCheck size={18} color="#F05A22" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {filterTabs.map((tab) => {
            const count =
              tab.id === 'all'
                ? notifications.length
                : notifications.filter((n) => n.category === tab.id).length;
            const isActive = activeFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setActiveFilter(tab.id)}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {tab.label} {count > 0 ? `(${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Notifications List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F05A22" />
          <Text style={styles.loadingText}>Fetching real notifications...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Bell size={32} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>All Caught Up</Text>
          <Text style={styles.emptyDesc}>
            No unread notifications in this category. You will receive real-time updates as business events occur.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F05A22']} />}
          renderItem={({ item }) => {
            const isUnread = !item.isRead;
            return (
              <TouchableOpacity
                style={[styles.notifCard, isUnread && styles.notifCardUnread]}
                onPress={() => onSelectNotification(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconSquircle, { backgroundColor: getIconBg(item.category) }]}>
                  {getCategoryIcon(item.category)}
                </View>

                <View style={styles.cardTextCol}>
                  <View style={styles.cardHeaderRow}>
                    <Text
                      style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    {isUnread && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.cardTime}>{item.time || 'Recently'}</Text>
                    <View style={styles.roleCategoryTag}>
                      <Text style={styles.roleCategoryText}>{item.category.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                <ChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            );
          }}
        />
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B192C',
  },
  topBarSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  markReadBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  filtersWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filtersScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  filterPillActive: {
    backgroundColor: '#F05A22',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    padding: 16,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    gap: 12,
    marginBottom: 8,
  },
  notifCardUnread: {
    borderColor: '#FFD8C2',
    backgroundColor: '#FFFDFB',
    borderLeftWidth: 4,
    borderLeftColor: '#F05A22',
  },
  iconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextCol: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#172B4D',
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '800',
    color: '#0B192C',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
    marginLeft: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  roleCategoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  roleCategoryText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
