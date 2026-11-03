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
  Alert,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  Truck,
  Package,
  CheckCheck,
  ChevronRight,
  ShieldCheck,
  FileText,
  CreditCard,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from 'lucide-react-native';
import { AppNotificationItem, MobileRole } from '../../../types';
import { authService } from '../../../services/authService';
import { supabase } from '../../../supabase';

interface NotificationsScreenProps {
  onBack: () => void;
  onSelectNotification?: (item: AppNotificationItem) => void;
  role?: MobileRole;
  onNavigateToRequirement?: (requirementId: string) => void;
  onNavigateToQuotations?: (requirementId?: string) => void;
  onNavigateToBooking?: (bookingId: string) => void;
  onNavigateToTracking?: (tripOrBookingId: string) => void;
  onNavigateToPOD?: (tripOrBookingId: string) => void;
  onNavigateToInvoices?: (bookingId?: string) => void;
  onNavigateToDocumentCorrection?: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  onSelectNotification,
  role: propRole,
  onNavigateToRequirement,
  onNavigateToQuotations,
  onNavigateToBooking,
  onNavigateToTracking,
  onNavigateToPOD,
  onNavigateToInvoices,
  onNavigateToDocumentCorrection,
}) => {
  const [currentRole, setCurrentRole] = useState<MobileRole>(propRole || 'CLIENT');
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  // Load session role and notifications
  const loadNotifications = useCallback(
    async (showLoadingSpinner = true) => {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      setError(null);
      try {
        const session = await authService.getCurrentSession();
        const effectiveRole = propRole || session?.role || 'CLIENT';
        setCurrentRole(effectiveRole);

        const data = await authService.fetchRealNotifications(session?.userId, effectiveRole);
        setNotifications(data || []);
      } catch (err: any) {
        console.warn('[NotificationsScreen] Load error:', err);
        setError('Unable to load your notifications. Please check your connection and try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [propRole]
  );

  useEffect(() => {
    loadNotifications(true);

    // Setup Supabase Realtime synchronization for client business notifications
    let channel: any = null;
    let debounceTimer: any = null;

    const triggerRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadNotifications(false);
      }, 400);
    };

    try {
      channel = supabase
        .channel(`realtime-notifs-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requirements' }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'client_quotes' }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_pod_submissions' }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'client_invoices' }, triggerRefresh)
        .subscribe();
    } catch (subErr) {
      console.warn('[NotificationsScreen] Realtime subscription notice:', subErr);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications(false);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
    try {
      await authService.markAllNotificationsAsRead(undefined, currentRole);
    } catch (err) {
      console.warn('[NotificationsScreen] Mark all read warning:', err);
    }
  };

  // Efficient pagination
  const handleLoadMore = () => {
    if (displayLimit < notifications.length) {
      setDisplayLimit((prev) => Math.min(prev + 20, notifications.length));
    }
  };

  const visibleNotifications = useMemo(() => {
    return notifications.slice(0, displayLimit);
  }, [notifications, displayLimit]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead && !n.read).length;
  }, [notifications]);

  // Click Action with Authorization & Availability Verification
  const handlePressNotification = async (item: AppNotificationItem) => {
    // 1. Mark as read immediately in state & persistent storage
    if (!item.isRead && !item.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true, read: true } : n))
      );
      authService.markNotificationAsRead(item.id).catch(() => {});
    }

    const targetRef = item.entityId || item.refId;
    const entityType = item.entityType;

    // If client, verify record availability & ownership before navigating
    if (currentRole === 'CLIENT' && targetRef) {
      try {
        setIsActionPending(true);

        if (entityType === 'REQUIREMENT' || targetRef.startsWith('REQ') || targetRef.startsWith('TR-')) {
          const { data: reqRec } = await supabase
            .from('requirements')
            .select('id')
            .eq('id', targetRef)
            .maybeSingle();

          if (!reqRec) {
            Alert.alert(
              'Record Unavailable',
              'The requested transport requirement is no longer available or has been updated.'
            );
            setIsActionPending(false);
            return;
          }

          setIsActionPending(false);
          if (onNavigateToRequirement) {
            onNavigateToRequirement(reqRec.id);
            return;
          }
        } else if (entityType === 'QUOTATION' || item.category === 'quotation') {
          const { data: reqRec } = await supabase
            .from('requirements')
            .select('id')
            .eq('id', targetRef)
            .maybeSingle();

          if (!reqRec) {
            Alert.alert(
              'Record Unavailable',
              'Quotations for this transport requirement are no longer available.'
            );
            setIsActionPending(false);
            return;
          }

          setIsActionPending(false);
          if (onNavigateToQuotations) {
            onNavigateToQuotations(reqRec.id);
            return;
          }
        } else if (entityType === 'BOOKING' || targetRef.startsWith('BOK') || targetRef.startsWith('BK')) {
          const { data: bRec } = await supabase
            .from('bookings')
            .select('id')
            .or(`id.eq.${targetRef},booking_number.eq.${targetRef}`)
            .maybeSingle();

          if (!bRec) {
            Alert.alert('Record Unavailable', 'The requested booking details could not be found.');
            setIsActionPending(false);
            return;
          }

          setIsActionPending(false);
          if (onNavigateToBooking) {
            onNavigateToBooking(bRec.id);
            return;
          }
        } else if (
          entityType === 'TRIP' ||
          targetRef.startsWith('TRP') ||
          targetRef.startsWith('NEC') ||
          targetRef.startsWith('SHP') ||
          item.category === 'shipment'
        ) {
          const { data: tRec } = await supabase
            .from('trips')
            .select('id, booking_id')
            .or(`id.eq.${targetRef},booking_id.eq.${targetRef}`)
            .maybeSingle();

          if (!tRec) {
            Alert.alert('Record Unavailable', 'Shipment tracking information is currently unavailable.');
            setIsActionPending(false);
            return;
          }

          setIsActionPending(false);
          if (onNavigateToTracking) {
            onNavigateToTracking(tRec.booking_id || tRec.id);
            return;
          }
        } else if (
          entityType === 'DOCUMENT_REJECTED' ||
          item.category === 'document_correction' ||
          item.title?.toLowerCase().includes('reject') ||
          item.subtitle?.toLowerCase().includes('reject')
        ) {
          setIsActionPending(false);
          if (onNavigateToDocumentCorrection) {
            onNavigateToDocumentCorrection();
            return;
          }
        } else if (entityType === 'POD' || item.category === 'document') {
          setIsActionPending(false);
          if (onNavigateToPOD) {
            onNavigateToPOD(targetRef);
            return;
          }
        } else if (entityType === 'INVOICE' || item.category === 'payment') {
          setIsActionPending(false);
          if (onNavigateToInvoices) {
            onNavigateToInvoices(targetRef);
            return;
          } else if (onNavigateToBooking) {
            onNavigateToBooking(targetRef);
            return;
          }
        }
      } catch (checkErr) {
        console.warn('[NotificationsScreen] Verification notice:', checkErr);
      } finally {
        setIsActionPending(false);
      }
    }

    // Default fallback: view notification details
    if (onSelectNotification) {
      onSelectNotification(item);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'shipment':
        return <Truck size={18} color="#F15A24" />;
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

  const getCategoryLabel = (category: string, entityType?: string) => {
    if (entityType === 'REQUIREMENT' || category === 'requirement') return 'Requirement';
    if (entityType === 'QUOTATION' || category === 'quotation') return 'Quotation';
    if (entityType === 'BOOKING' || category === 'booking') return 'Booking';
    if (entityType === 'TRIP' || category === 'shipment') return 'Shipment';
    if (entityType === 'POD' || category === 'document') return 'Proof of Delivery';
    if (entityType === 'INVOICE' || category === 'payment') return 'Invoice';
    return 'Notice';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color="#0C1A34" />
        </TouchableOpacity>

        <View style={styles.topBarTitleRow}>
          <Text style={styles.topBarTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markReadBtn}
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
            accessibilityLabel="Mark all as read"
          >
            <CheckCheck size={16} color="#F15A24" />
            <Text style={styles.markReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content: Unified Chronological List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F15A24" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: '#FEE2E2' }]}>
            <AlertTriangle size={30} color="#DC2626" />
          </View>
          <Text style={styles.emptyTitle}>Unable to Load Notifications</Text>
          <Text style={styles.emptyDesc}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadNotifications(true)}
            activeOpacity={0.8}
          >
            <RefreshCw size={15} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Bell size={32} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No Notifications Yet</Text>
          <Text style={styles.emptyDesc}>
            When your transport requirements, quotations, bookings, or shipments have updates, they
            will appear here in real time.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleNotifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#F15A24']}
              tintColor="#F15A24"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item }) => {
            const isUnread = !item.isRead && !item.read;
            const categoryLabel = getCategoryLabel(item.category, item.entityType);

            return (
              <TouchableOpacity
                style={[styles.notifCard, isUnread && styles.notifCardUnread]}
                onPress={() => handlePressNotification(item)}
                activeOpacity={0.82}
                disabled={isActionPending}
              >
                {/* Left Icon squircle */}
                <View style={[styles.iconSquircle, { backgroundColor: getIconBg(item.category) }]}>
                  {getCategoryIcon(item.category)}
                </View>

                {/* Card Content Column */}
                <View style={styles.cardTextCol}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardTitleWrap}>
                      <Text
                        style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.cardTime}>{item.time || 'Recently'}</Text>
                  </View>

                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>

                  <View style={styles.cardFooterRow}>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>{categoryLabel}</Text>
                    </View>
                    {item.refId ? (
                      <View style={styles.refPill}>
                        <Text style={styles.refPillText}>{item.refId}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <ChevronRight size={16} color={isUnread ? '#F15A24' : '#CBD5E1'} />
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            visibleNotifications.length < notifications.length ? (
              <View style={styles.loadMoreWrapper}>
                <ActivityIndicator size="small" color="#F15A24" />
                <Text style={styles.loadMoreText}>Loading more updates...</Text>
              </View>
            ) : null
          }
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
  topBarTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0C1A34',
    letterSpacing: -0.2,
  },
  unreadCountBadge: {
    backgroundColor: '#F15A24',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  markReadText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F15A24',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 28,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: '#FFFDFB',
    borderColor: '#FED7AA',
    borderLeftWidth: 4,
    borderLeftColor: '#F15A24',
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    marginBottom: 3,
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },
  cardTitleUnread: {
    fontWeight: '800',
    color: '#0C1A34',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F15A24',
    marginLeft: 6,
  },
  cardTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 8,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  refPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
  },
  refPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1A34',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F15A24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 14,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loadMoreWrapper: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
