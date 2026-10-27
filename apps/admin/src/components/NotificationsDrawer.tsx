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
  RefreshCw,
  Building2,
  Store,
  Clock,
  ShieldAlert,
  Inbox,
  ExternalLink,
  BellRing,
  Send
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { requestWebPushPermission, sendTestWebPushNotification } from '../services/firebase';
import { useToast } from '../context/ToastContext';

export interface NotificationItem {
  id: string;
  category:
    | 'client'
    | 'vendor'
    | 'requirement'
    | 'quote'
    | 'booking'
    | 'trip'
    | 'doc'
    | 'delay'
    | 'payment'
    | 'driver'
    | 'cancel'
    | 'chat';
  title: string;
  refId: string;
  subtitle: string;
  time: string;
  rawTime?: string;
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

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Just now';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Recently';
  }
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
  const [error, setError] = useState<string | null>(null);

  // FCM Web Push Notification state
  const { success: showSuccess, error: showError, info: showInfo } = useToast();
  const [fcmEnabled, setFcmEnabled] = useState<boolean>(() => {
    return typeof window !== 'undefined' && Boolean(localStorage.getItem('necl_web_fcm_token'));
  });
  const [fcmLoading, setFcmLoading] = useState<boolean>(false);
  const [testSending, setTestSending] = useState<boolean>(false);

  const handleEnableWebPush = async () => {
    setFcmLoading(true);
    try {
      const result = await requestWebPushPermission();
      if (result.granted && result.token) {
        setFcmEnabled(true);
        showSuccess('Web Push notifications enabled and FCM token registered successfully!');
      } else {
        showError(result.error || 'Failed to enable push notifications');
      }
    } catch (err: any) {
      showError(err.message || 'Error requesting push notification permission');
    } finally {
      setFcmLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestSending(true);
    try {
      await sendTestWebPushNotification(
        'NECL Admin Test Alert',
        'Firebase Cloud Messaging Web Push is functioning properly!'
      );
      showInfo('Test push notification dispatched via Firebase Cloud Messaging.');
    } catch (err: any) {
      showError(err.message || 'Failed to dispatch test notification');
    } finally {
      setTestSending(false);
    }
  };

  // Read status store in localStorage for persistence across reloads
  const getReadIds = (): Set<string> => {
    try {
      const stored = localStorage.getItem('necl_read_notifications_v1');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const persistReadIds = (ids: Set<string>) => {
    try {
      localStorage.setItem('necl_read_notifications_v1', JSON.stringify(Array.from(ids)));
    } catch {}
  };

  // Fetch real database records to form live notifications
  const fetchDbNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const readIds = getReadIds();

      const [
        { data: clients },
        { data: vendors },
        { data: docs },
        { data: reqs },
        { data: boks },
        { data: trips },
        { data: drivers },
      ] = await Promise.all([
        supabase
          .from('client_companies')
          .select('id, company_name, client_code, city, state, status, created_at')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('vendor_companies')
          .select('id, vendor_name, vendor_code, address, status, created_at')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('documents')
          .select('id, category, document_type, reference_id, file_name, verification_status, created_at')
          .eq('verification_status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('requirements')
          .select('id, requirement_code, title, status, pickup_address, destination_address, created_at, client_companies(company_name)')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('bookings')
          .select('id, booking_code, booking_status, payment_status, confirmed_at, client_companies(company_name)')
          .order('confirmed_at', { ascending: false })
          .limit(8),
        supabase
          .from('trips')
          .select('id, trip_status, started_at, booking_id, vendor_rate, vehicles(registration_number)')
          .order('started_at', { ascending: false })
          .limit(6),
        supabase
          .from('drivers')
          .select('id, full_name, licence_number, licence_expiry_date, verification_status, created_at')
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

      const items: NotificationItem[] = [];

      // 1. Client onboarding notifications
      (clients || []).forEach((c) => {
        const isPending = c.status === 'PENDING' || c.status === 'PENDING_APPROVAL';
        const notifId = `notif-client-${c.id}`;
        items.push({
          id: notifId,
          category: 'client',
          title: isPending ? 'New Client Awaiting Verification' : `Client ${c.status}`,
          refId: c.client_code || 'Client Onboarding',
          subtitle: `${c.company_name} • ${c.city ? `${c.city}, ${c.state || ''}` : 'Pending details'}`,
          time: formatRelativeTime(c.created_at),
          rawTime: c.created_at,
          isRead: readIds.has(notifId) || !isPending,
          isImportant: isPending,
        });
      });

      // 2. Vendor onboarding notifications
      (vendors || []).forEach((v) => {
        const isPending = v.status === 'PENDING' || v.status === 'PENDING_APPROVAL';
        const notifId = `notif-ven-${v.id}`;
        items.push({
          id: notifId,
          category: 'vendor',
          title: isPending ? 'New Vendor Registration' : `Vendor ${v.status}`,
          refId: v.vendor_code || 'Transporter',
          subtitle: `${v.vendor_name} • ${v.address || 'Address pending'}`,
          time: formatRelativeTime(v.created_at),
          rawTime: v.created_at,
          isRead: readIds.has(notifId) || !isPending,
          isImportant: isPending,
        });
      });

      // 3. Document verification alerts
      (docs || []).forEach((d) => {
        const notifId = `notif-doc-${d.id}`;
        items.push({
          id: notifId,
          category: 'doc',
          title: 'Document Pending Verification',
          refId: d.document_type || 'KYC Document',
          subtitle: `${d.category} Document • ${d.file_name || 'Uploaded certificate'}`,
          time: formatRelativeTime(d.created_at),
          rawTime: d.created_at,
          isRead: readIds.has(notifId),
          isImportant: true,
        });
      });

      // 4. Requirements notifications
      (reqs || []).forEach((r) => {
        const clientName = (r as any).client_companies?.company_name || 'Client';
        const isUnderReview = r.status === 'UNDER_REVIEW' || r.status === 'PENDING';
        const notifId = `notif-req-${r.id}`;
        items.push({
          id: notifId,
          category: 'requirement',
          title: `Requirement: ${r.status.replace(/_/g, ' ')}`,
          refId: r.requirement_code || `REQ-${r.id.slice(0, 8)}`,
          subtitle: `${clientName} • ${r.pickup_address || 'Origin'} → ${r.destination_address || 'Destination'}`,
          time: formatRelativeTime(r.created_at),
          rawTime: r.created_at,
          isRead: readIds.has(notifId) || !isUnderReview,
          isImportant: isUnderReview,
        });
      });

      // 5. Bookings notifications
      (boks || []).forEach((b) => {
        const clientName = (b as any).client_companies?.company_name || 'Client';
        const isPending = b.payment_status === 'PAYMENT_PENDING' || b.booking_status === 'CONFIRMED';
        const notifId = `notif-bok-${b.id}`;
        items.push({
          id: notifId,
          category: 'booking',
          title: `Booking: ${b.booking_status.replace(/_/g, ' ')}`,
          refId: b.booking_code || `BK-${b.id.slice(0, 8)}`,
          subtitle: `${clientName} • Payment: ${b.payment_status.replace(/_/g, ' ')}`,
          time: formatRelativeTime(b.confirmed_at),
          rawTime: b.confirmed_at,
          isRead: readIds.has(notifId) || !isPending,
          isImportant: isPending,
        });
      });

      // 6. Active Trips notifications
      (trips || []).forEach((t) => {
        const vehNo = (t as any).vehicles?.registration_number || 'Carrier Truck';
        const inTransit = t.trip_status === 'IN_TRANSIT';
        const notifId = `notif-trip-${t.id}`;
        items.push({
          id: notifId,
          category: 'trip',
          title: `Trip ${t.trip_status === 'IN_TRANSIT' ? 'In Transit' : t.trip_status.replace(/_/g, ' ')}`,
          refId: vehNo,
          subtitle: `Rate: ₹${(t.vendor_rate || 0).toLocaleString('en-IN')} • Live tracking active`,
          time: formatRelativeTime(t.started_at),
          rawTime: t.started_at,
          isRead: readIds.has(notifId) || !inTransit,
          isImportant: inTransit,
        });
      });

      // 7. Drivers notifications
      (drivers || []).forEach((d) => {
        let urgent = false;
        let subtitle = `Licence: ${d.licence_number || 'N/A'}`;
        if (d.licence_expiry_date) {
          const exp = new Date(d.licence_expiry_date);
          const days = Math.ceil((exp.getTime() - Date.now()) / (1000 * 3600 * 24));
          urgent = days <= 30;
          subtitle += ` • Valid till: ${d.licence_expiry_date} (${days > 0 ? `${days}d left` : 'Expired'})`;
        }
        const notifId = `notif-drv-${d.id}`;
        items.push({
          id: notifId,
          category: 'driver',
          title: urgent ? 'Driver Licence Expiring Soon' : 'Driver Enrolled',
          refId: d.full_name,
          subtitle,
          time: formatRelativeTime(d.created_at),
          rawTime: d.created_at,
          isRead: readIds.has(notifId) || !urgent,
          isImportant: urgent,
        });
      });

      // Sort by recency
      items.sort((a, b) => {
        const timeA = a.rawTime ? new Date(a.rawTime).getTime() : 0;
        const timeB = b.rawTime ? new Date(b.rawTime).getTime() : 0;
        return timeB - timeA;
      });

      setNotifications(items);

      // Sync unread count to parent topbar
      const unread = items.filter((n) => !n.isRead && !n.isArchived).length;
      if (onUpdateUnreadCount) {
        onUpdateUnreadCount(unread);
      }
    } catch (err: any) {
      console.error('Failed to load real notifications from database:', err);
      setError(err?.message || 'Failed to fetch live notifications from database');
    } finally {
      setLoading(false);
    }
  }, [onUpdateUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchDbNotifications();
    }
  }, [isOpen, fetchDbNotifications]);

  // Dynamic counts for notification tabs
  const tabCounts = useMemo(() => {
    const total = notifications.filter((n) => !n.isArchived).length;
    const unread = notifications.filter((n) => !n.isRead && !n.isArchived).length;
    const important = notifications.filter((n) => n.isImportant && !n.isArchived).length;
    const archived = notifications.filter((n) => n.isArchived).length;
    return { total, unread, important, archived };
  }, [notifications]);

  // Sync external unread count when changed
  const updateCountState = (newList: NotificationItem[]) => {
    const unread = newList.filter((n) => !n.isRead && !n.isArchived).length;
    if (onUpdateUnreadCount) {
      onUpdateUnreadCount(unread);
    }
    const readIds = new Set(newList.filter((n) => n.isRead).map((n) => n.id));
    persistReadIds(readIds);
    window.dispatchEvent(new CustomEvent('necl:refresh-badges'));
  };

  // Filter list by selected tab
  const displayedNotifications = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter((n) => !n.isRead && !n.isArchived);
      case 'important':
        return notifications.filter((n) => n.isImportant && !n.isArchived);
      case 'archived':
        return notifications.filter((n) => n.isArchived);
      case 'all':
      default:
        return notifications.filter((n) => !n.isArchived);
    }
  }, [notifications, activeTab]);

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    setNotifications(updated);
    updateCountState(updated);
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    updateCountState(updated);
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      const updated = notifications.map((n) => (n.id === item.id ? { ...n, isRead: true } : n));
      setNotifications(updated);
      updateCountState(updated);
    }
    onSelectNotification(item);
  };

  if (!isOpen) return null;

  const renderCategoryIcon = (category: NotificationItem['category']) => {
    switch (category) {
      case 'client':
        return <Building2 size={16} color="#0284C7" />;
      case 'vendor':
        return <Store size={16} color="#F05A22" />;
      case 'doc':
        return <FileText size={16} color="#D97706" />;
      case 'requirement':
        return <ClipboardListIcon size={16} color="#7C3AED" />;
      case 'booking':
        return <Truck size={16} color="#059669" />;
      case 'trip':
        return <Navigation size={16} color="#2563EB" />;
      case 'driver':
        return <Users size={16} color="#0D9488" />;
      case 'quote':
        return <IndianRupee size={16} color="#16A34A" />;
      case 'payment':
        return <CheckCircle2 size={16} color="#10B981" />;
      case 'delay':
        return <AlertTriangle size={16} color="#EF4444" />;
      default:
        return <AlertCircle size={16} color="#64748B" />;
    }
  };

  return (
    <div className="notif-drawer-backdrop" onClick={onClose}>
      <div className="notif-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="notif-drawer-header">
          <div className="notif-header-title-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 className="notif-drawer-title">Notifications</h3>
              {tabCounts.unread > 0 && (
                <span className="notif-unread-pill">{tabCounts.unread} new</span>
              )}
              <button
                className="topbar-icon-btn"
                title="Refresh notifications"
                onClick={fetchDbNotifications}
                style={{ width: '28px', height: '28px', borderRadius: '6px' }}
              >
                <RefreshCw size={13} className={loading ? 'spin-animate' : ''} />
              </button>
            </div>
            <button className="notif-drawer-close-btn" onClick={onClose} title="Close drawer">
              <X size={18} />
            </button>
          </div>

          {/* FCM Push Notification Controls Banner */}
          <div
            style={{
              margin: '10px 0 12px 0',
              padding: '10px 12px',
              background: fcmEnabled ? '#F0FDF4' : '#FFF7ED',
              border: fcmEnabled ? '1px solid #BBF7D0' : '1px solid #FED7AA',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: fcmEnabled ? '#DCFCE7' : '#FFEDD5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BellRing size={15} color={fcmEnabled ? '#16A34A' : '#EA580C'} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: fcmEnabled ? '#15803D' : '#C2410C' }}>
                  {fcmEnabled ? 'FCM Web Push: Active' : 'FCM Web Push: Not Enabled'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  {fcmEnabled ? 'Receiving real-time browser alerts' : 'Enable browser alerts for shipments & quotes'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {fcmEnabled ? (
                <button
                  type="button"
                  onClick={handleSendTestPush}
                  disabled={testSending}
                  style={{
                    background: '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: testSending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'opacity 0.2s',
                    opacity: testSending ? 0.7 : 1,
                  }}
                  title="Dispatch a real test notification to this browser"
                >
                  <Send size={11} /> {testSending ? 'Sending…' : 'Test Push'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableWebPush}
                  disabled={fcmLoading}
                  style={{
                    background: '#FA5700',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: fcmLoading ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.2s',
                    opacity: fcmLoading ? 0.7 : 1,
                  }}
                >
                  {fcmLoading ? 'Enabling…' : 'Enable Push'}
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs with Dynamic Active Badges */}
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
              Urgent ({tabCounts.important})
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
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            Live System Events
          </span>
          {tabCounts.unread > 0 && (
            <button className="btn-mark-all-read" onClick={handleMarkAllRead}>
              <Check size={12} strokeWidth={2.5} />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Notifications List (Actual System Data) */}
        <div className="notif-items-scroll-area">
          {loading && notifications.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <RefreshCw size={24} className="spin-animate" style={{ color: '#F05A22', margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: '#64748B' }}>
                Fetching operational notifications...
              </p>
            </div>
          ) : error ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <AlertCircle size={32} style={{ color: '#EF4444', margin: '0 auto 10px' }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>
                Unable to load notifications
              </p>
              <p style={{ margin: '6px 0 16px', fontSize: '12px', color: '#64748B' }}>{error}</p>
              <button
                type="button"
                className="btn-orange-action"
                style={{ padding: '6px 14px', fontSize: '12px', margin: '0 auto' }}
                onClick={fetchDbNotifications}
              >
                Retry
              </button>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#94A3B8' }}>
              <Inbox size={40} style={{ margin: '0 auto 12px', color: '#CBD5E1' }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#334155' }}>
                {activeTab === 'unread'
                  ? 'All notifications caught up!'
                  : activeTab === 'important'
                  ? 'No urgent priority alerts'
                  : 'No notifications in this tab'}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748B' }}>
                New operational registrations, documents, and trips appear here dynamically.
              </p>
            </div>
          ) : (
            displayedNotifications.map((item) => (
              <div
                key={item.id}
                className={`notif-card-row ${!item.isRead ? 'unread' : ''}`}
                onClick={() => handleItemClick(item)}
              >
                {/* Category Icon Badge */}
                <div className={`notif-category-icon ${item.category}`}>
                  {renderCategoryIcon(item.category)}
                </div>

                {/* Main Content */}
                <div className="notif-content-wrap">
                  <div className="notif-title-line">
                    <div className="notif-main-title">
                      <span className="notif-category-badge">{item.category.toUpperCase()}</span>
                      <span className="notif-text-title">{item.title}</span>
                      {!item.isRead && <span className="notif-dot-unread" title="Unread event" />}
                    </div>
                    <span className="notif-timestamp">{item.time}</span>
                  </div>

                  <div className="notif-ref-id">{item.refId}</div>
                  <div className="notif-desc-subtitle">{item.subtitle}</div>
                </div>

                {/* Mark Single as Read Icon Button */}
                {!item.isRead && (
                  <button
                    type="button"
                    className="btn-item-mark-read"
                    title="Mark as read"
                    onClick={(e) => handleMarkAsRead(item.id, e)}
                  >
                    <Check size={12} strokeWidth={2.5} />
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
            <span>Viewing Live Data • {tabCounts.total} Total</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ClipboardListIcon helper
const ClipboardListIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </svg>
);

export default NotificationsDrawer;
