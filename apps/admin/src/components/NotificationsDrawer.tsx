import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  FileText,
  IndianRupee,
  Truck,
  Navigation,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Users,
  XCircle,
  MessageSquare,
  ArrowRight,
  Check,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../utils/supabase';

export interface NotificationItem {
  id: string;
  category: 'requirement' | 'quote' | 'booking' | 'trip' | 'doc' | 'delay' | 'payment' | 'driver' | 'cancel' | 'chat';
  title: string;
  refId: string;
  subtitle: string;
  time: string;
  isRead: boolean;
  isImportant?: boolean;
  isArchived?: boolean;
}

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNotification: (notif: NotificationItem) => void;
  unreadCount?: number;
  onUpdateUnreadCount?: (count: number) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onSelectNotification,
  unreadCount: externalUnreadCount,
  onUpdateUnreadCount,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'important' | 'archived'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch real database records to form live notifications
  const fetchDbNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: reqs },
        { data: boks },
        { data: trips },
        { data: drivers }
      ] = await Promise.all([
        supabase.from('requirements').select('*, client_companies(company_name)').order('created_at', { ascending: false }).limit(10),
        supabase.from('bookings').select('*, client_companies(company_name)').order('confirmed_at', { ascending: false }).limit(10),
        supabase.from('trips').select('*, vehicles(registration_number)').order('created_at', { ascending: false }).limit(5),
        supabase.from('drivers').select('*').limit(5),
      ]);

      const items: NotificationItem[] = [];

      // 1. Requirements notifications
      (reqs || []).forEach(r => {
        const clientName = (r as any).client_companies?.company_name || 'Client';
        const isUnderReview = r.status === 'UNDER_REVIEW';
        items.push({
          id: `notif-req-${r.id}`,
          category: 'requirement',
          title: `Requirement: ${r.status}`,
          refId: r.id,
          subtitle: `Client: ${clientName} | Route: ${r.pickup_address} → ${r.destination_address}`,
          time: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
          isRead: !isUnderReview,
          isImportant: isUnderReview,
        });
      });

      // 2. Bookings notifications
      (boks || []).forEach(b => {
        const clientName = (b as any).client_companies?.company_name || 'Client';
        const isPending = b.payment_status === 'PAYMENT_PENDING';
        items.push({
          id: `notif-bok-${b.id}`,
          category: 'booking',
          title: `Booking: ${b.booking_status}`,
          refId: b.id,
          subtitle: `Client: ${clientName} | Payment: ${b.payment_status}`,
          time: b.confirmed_at ? new Date(b.confirmed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
          isRead: !isPending,
          isImportant: isPending,
        });
      });

      // 3. Active Trips notifications
      (trips || []).forEach(t => {
        const vehNo = t.vehicles?.registration_number || 'Carrier Truck';
        const inTransit = t.trip_status === 'IN_TRANSIT';
        items.push({
          id: `notif-trip-${t.id}`,
          category: 'trip',
          title: `Trip ${t.trip_status === 'IN_TRANSIT' ? 'In Transit' : t.trip_status}`,
          refId: `Booking: ${t.booking_id}`,
          subtitle: `Vehicle: ${vehNo} | Vendor Rate: ₹${(t.vendor_rate || 0).toLocaleString('en-IN')}`,
          time: t.started_at ? new Date(t.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
          isRead: !inTransit,
          isImportant: inTransit,
        });
      });

      // 4. Drivers notifications
      (drivers || []).forEach(d => {
        if (d.licence_expiry_date) {
          const exp = new Date(d.licence_expiry_date);
          const days = Math.ceil((exp.getTime() - Date.now()) / (1000 * 3600 * 24));
          const urgent = days < 30;
          items.push({
            id: `notif-drv-${d.id}`,
            category: 'driver',
            title: urgent ? 'Driver License Expiring Soon' : 'Driver Verified',
            refId: d.full_name,
            subtitle: `Licence: ${d.licence_number} | Valid till: ${d.licence_expiry_date}`,
            time: 'Active Record',
            isRead: !urgent,
            isImportant: urgent,
          });
        }
      });

      setNotifications(items);

      // Sync unread count
      const unread = items.filter(n => !n.isRead && !n.isArchived).length;
      if (onUpdateUnreadCount) {
        onUpdateUnreadCount(unread);
      }
    } catch (err) {
      console.error('Failed to load real notifications from database:', err);
    } finally {
      setLoading(false);
    }
  }, [onUpdateUnreadCount]);

  useEffect(() => {
    fetchDbNotifications();
  }, [fetchDbNotifications]);

  // Dynamic counts for notification tabs
  const tabCounts = useMemo(() => {
    const total = notifications.filter(n => !n.isArchived).length;
    const unread = notifications.filter(n => !n.isRead && !n.isArchived).length;
    const important = notifications.filter(n => n.isImportant && !n.isArchived).length;
    const archived = notifications.filter(n => n.isArchived).length;
    return { total, unread, important, archived };
  }, [notifications]);

  // Sync external unread count when changed
  const updateCountState = (newList: NotificationItem[]) => {
    const unread = newList.filter(n => !n.isRead && !n.isArchived).length;
    if (onUpdateUnreadCount) {
      onUpdateUnreadCount(unread);
    }
  };

  // Filter list by selected tab
  const displayedNotifications = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter(n => !n.isRead && !n.isArchived);
      case 'important':
        return notifications.filter(n => n.isImportant && !n.isArchived);
      case 'archived':
        return notifications.filter(n => n.isArchived);
      case 'all':
      default:
        return notifications.filter(n => !n.isArchived);
    }
  }, [notifications, activeTab]);

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.map(n => (n.id === id ? { ...n, isRead: true } : n));
    setNotifications(updated);
    updateCountState(updated);
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    setNotifications(updated);
    updateCountState(updated);
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      const updated = notifications.map(n => (n.id === item.id ? { ...n, isRead: true } : n));
      setNotifications(updated);
      updateCountState(updated);
    }
    onSelectNotification(item);
  };

  if (!isOpen) return null;

  return (
    <div className="notif-drawer-backdrop" onClick={onClose}>
      <div className="notif-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="notif-drawer-header">
          <div className="notif-header-title-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 className="notif-drawer-title">Notifications</h3>
              {tabCounts.unread > 0 && (
                <span className="notif-unread-pill">{tabCounts.unread}</span>
              )}
              <button
                className="topbar-icon-btn"
                title="Refresh notifications"
                onClick={fetchDbNotifications}
                style={{ width: '26px', height: '26px' }}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
              </button>
            </div>
            <button className="notif-drawer-close-btn" onClick={onClose} title="Close drawer">
              <X size={18} />
            </button>
          </div>

          {/* Filter Tabs with Active Gold Underline Indicator */}
          <div className="notif-drawer-tabs">
            <button
              className={`notif-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({tabCounts.total})
            </button>
            <button
              className={`notif-tab ${activeTab === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              Unread ({tabCounts.unread})
            </button>
            <button
              className={`notif-tab ${activeTab === 'important' ? 'active' : ''}`}
              onClick={() => setActiveTab('important')}
            >
              Important ({tabCounts.important})
            </button>
            <button
              className={`notif-tab ${activeTab === 'archived' ? 'active' : ''}`}
              onClick={() => setActiveTab('archived')}
            >
              Archived ({tabCounts.archived})
            </button>
          </div>
        </div>

        {/* Action sub-bar */}
        <div className="notif-action-subbar">
          <span>Real-time Operations Updates</span>
          {tabCounts.unread > 0 && (
            <button className="btn-mark-all-read" onClick={handleMarkAllRead}>
              <Check size={13} strokeWidth={2.5} /> Mark all read
            </button>
          )}
        </div>

        {/* Notifications List (100% Real Database Events) */}
        <div className="notif-items-scroll-area">
          {displayedNotifications.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#94A3B8' }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 12px', color: '#CBD5E1' }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#64748B' }}>
                {activeTab === 'unread'
                  ? 'All notifications caught up!'
                  : activeTab === 'important'
                  ? 'No critical priority alerts'
                  : 'No notifications in this folder'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                New operational database events will appear here dynamically.
              </p>
            </div>
          ) : (
            displayedNotifications.map((item) => (
              <div
                key={item.id}
                className={`notif-card-row ${!item.isRead ? 'unread' : ''}`}
                onClick={() => handleItemClick(item)}
              >
                {/* Category Icon */}
                <div className={`notif-category-icon ${item.category}`}>
                  {item.category === 'requirement' && <FileText size={18} />}
                  {item.category === 'quote' && <IndianRupee size={18} />}
                  {item.category === 'booking' && <Truck size={18} />}
                  {item.category === 'trip' && <Navigation size={18} />}
                  {item.category === 'doc' && <AlertCircle size={18} />}
                  {item.category === 'delay' && <AlertTriangle size={18} />}
                  {item.category === 'payment' && <CheckCircle2 size={18} />}
                  {item.category === 'driver' && <Users size={18} />}
                  {item.category === 'cancel' && <XCircle size={18} />}
                  {item.category === 'chat' && <MessageSquare size={18} />}
                </div>

                {/* Text Content */}
                <div className="notif-content-wrap">
                  <div className="notif-title-line">
                    <div className="notif-main-title">
                      <span>{item.title}</span>
                      {!item.isRead && <span className="gold-unread-dot" title="Unread"></span>}
                    </div>
                    <span className="notif-timestamp">{item.time}</span>
                  </div>

                  <div className="notif-ref-id">{item.refId}</div>
                  <div className="notif-desc-subtitle">{item.subtitle}</div>
                </div>

                {/* Mark Single as Read Icon Button */}
                {!item.isRead && (
                  <button
                    className="btn-item-mark-read"
                    title="Mark as read"
                    onClick={(e) => handleMarkAsRead(item.id, e)}
                  >
                    <Check size={13} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div className="notif-drawer-footer">
          <button
            className="btn-view-all-notifs"
            onClick={() => {
              setActiveTab('all');
            }}
          >
            <span>View All Notifications</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationsDrawer;
