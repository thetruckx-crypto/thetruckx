import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
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
} from 'lucide-react-native';
import { AppNotificationItem } from '../../../types';
import { authService } from '../../../services/authService';

interface NotificationsScreenProps {
  onBack: () => void;
  onSelectNotification: (item: AppNotificationItem) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  onSelectNotification,
}) => {
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'shipment' | 'booking' | 'system'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await authService.fetchRealNotifications();
      setNotifications(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const filteredItems = notifications.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.category === activeFilter;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'shipment':
        return <Truck size={18} color="#F05A22" />;
      case 'booking':
        return <Package size={18} color="#2563EB" />;
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
        <Text style={styles.topBarTitle}>Notifications</Text>
        <TouchableOpacity
          style={styles.markReadBtn}
          onPress={handleMarkAllRead}
          activeOpacity={0.7}
        >
          <CheckCheck size={18} color="#F05A22" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'shipment' && styles.filterPillActive]}
          onPress={() => setActiveFilter('shipment')}
        >
          <Text style={[styles.filterPillText, activeFilter === 'shipment' && styles.filterPillTextActive]}>
            Shipments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'booking' && styles.filterPillActive]}
          onPress={() => setActiveFilter('booking')}
        >
          <Text style={[styles.filterPillText, activeFilter === 'booking' && styles.filterPillTextActive]}>
            Bookings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'system' && styles.filterPillActive]}
          onPress={() => setActiveFilter('system')}
        >
          <Text style={[styles.filterPillText, activeFilter === 'system' && styles.filterPillTextActive]}>
            System
          </Text>
        </TouchableOpacity>
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
          <Text style={styles.emptyDesc}>You have no unread notifications in this category.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#F05A22']}
              tintColor="#F05A22"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
              onPress={() => onSelectNotification(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconSquircle, { backgroundColor: getIconBg(item.category) }]}>
                {getCategoryIcon(item.category)}
              </View>

              <View style={styles.cardTextCol}>
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]}>
                    {item.title}
                  </Text>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>

                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {item.subtitle}
                </Text>

                <Text style={styles.cardTime}>{item.time}</Text>
              </View>

              <ChevronRight size={16} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        />
      )}
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
  markReadBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF0',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
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
  },
  notifCardUnread: {
    borderColor: '#FFD8C2',
    backgroundColor: '#FFFDFB',
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
  },
  cardTitleUnread: {
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
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
  },
});
