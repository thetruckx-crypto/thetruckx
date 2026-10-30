import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  Truck,
  UserCheck,
  FileSpreadsheet,
  Receipt,
  ShieldCheck,
  Compass,
  Scale,
  CheckSquare,
  IndianRupee,
  AlertTriangle,
  BarChart3,
  Settings,
  Layers,
  DollarSign,
  Plus,
  FileText,
  TrendingUp,
  Sliders,
  Shield,
  MessageSquare,
} from 'lucide-react';

interface HubTab {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number | string | null;
  highlight?: boolean;
}

interface HubConfig {
  hubTitle: string;
  badgeText?: string;
  tabs: HubTab[];
}

export function HubNavigationHeader({
  badges = {},
}: {
  badges?: {
    vendors?: number;
    requirements?: number;
    bookings?: number;
    drivers?: number;
    documents?: number;
    pod?: number;
    payments?: number;
    exceptions?: number;
    chats?: number;
  };
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  // Determine current active hub based on path
  let config: HubConfig | null = null;

  // 1. Carrier & Vendor Partner Hub
  if (path.startsWith('/admin/vendors')) {
    config = {
      hubTitle: 'Carrier & Vendor Operations Hub',
      badgeText: 'Unified Hub 4',
      tabs: [
        {
          id: 'directory',
          label: 'Carrier Directory',
          path: '/admin/vendors',
          icon: <Building2 size={15} />,
        },
        {
          id: 'verifications',
          label: 'Verification Queue',
          path: '/admin/vendors/verification-requests',
          icon: <UserCheck size={15} />,
          badge: badges.vendors && badges.vendors > 0 ? badges.vendors : undefined,
        },
        {
          id: 'approvals',
          label: 'Document Approvals',
          path: '/admin/vendors/document-approvals',
          icon: <ShieldCheck size={15} />,
        },
        {
          id: 'invite',
          label: '+ Onboard Carrier',
          path: '/admin/vendors/new',
          icon: <Plus size={15} />,
          highlight: true,
        },
      ],
    };
  }

  // 2. Fleet & Asset Command Hub
  else if (path.startsWith('/admin/fleet') || path.startsWith('/admin/drivers')) {
    config = {
      hubTitle: 'Fleet & Driver Asset Command Hub',
      badgeText: 'Unified Hub 5',
      tabs: [
        {
          id: 'fleet',
          label: 'Vehicle Master Directory',
          path: '/admin/fleet',
          icon: <Truck size={15} />,
        },
        {
          id: 'vehicle-verification',
          label: 'Vehicle Compliance',
          path: '/admin/fleet/verification',
          icon: <ShieldCheck size={15} />,
        },
        {
          id: 'tie-ups',
          label: 'Vendor Tie-Up Approvals',
          path: '/admin/fleet/tie-up-approval',
          icon: <Layers size={15} />,
        },
        {
          id: 'drivers',
          label: 'Drivers Verification Queue',
          path: '/admin/drivers',
          icon: <Users size={15} />,
          badge: badges.drivers && badges.drivers > 0 ? badges.drivers : undefined,
        },
        {
          id: 'add-vehicle',
          label: '+ Add Vehicle',
          path: '/admin/fleet/new',
          icon: <Plus size={15} />,
          highlight: true,
        },
      ],
    };
  }

  // 3. Freight Sourcing, Pricing & RFQ Exchange
  else if (
    path.startsWith('/admin/requirements') ||
    path.startsWith('/admin/quotations') ||
    path.startsWith('/admin/vendor-quotations') ||
    path.startsWith('/admin/pricing')
  ) {
    config = {
      hubTitle: 'Freight Sourcing & RFQ Exchange',
      badgeText: 'Unified Hub 6',
      tabs: [
        {
          id: 'requirements',
          label: 'Client Requirements',
          path: '/admin/requirements',
          icon: <FileSpreadsheet size={15} />,
          badge: badges.requirements && badges.requirements > 0 ? badges.requirements : undefined,
        },
        {
          id: 'vendor-quotes',
          label: 'Reverse Auction Bids',
          path: '/admin/vendor-quotations',
          icon: <DollarSign size={15} />,
        },
        {
          id: 'client-quotes',
          label: 'Quotations & Margins',
          path: '/admin/quotations',
          icon: <Receipt size={15} />,
        },
        {
          id: 'pricing',
          label: 'Pricing Matrix Formulas',
          path: '/admin/pricing',
          icon: <TrendingUp size={15} />,
        },
      ],
    };
  }

  // 4. In-Transit Control Tower & Tracking
  else if (path.startsWith('/admin/tracking') || path.startsWith('/admin/documents')) {
    config = {
      hubTitle: 'In-Transit Control Tower & Telemetry',
      badgeText: 'Unified Hub 8',
      tabs: [
        {
          id: 'tracking',
          label: 'Live Fleet Tracking Map',
          path: '/admin/tracking',
          icon: <Compass size={15} />,
        },
        {
          id: 'documents',
          label: 'Pre-Trip Document Clearance',
          path: '/admin/documents',
          icon: <ShieldCheck size={15} />,
          badge: badges.documents && badges.documents > 0 ? badges.documents : undefined,
        },
      ],
    };
  }

  // 5. Delivery Closure, POD & Weighbridge Hub
  else if (path.startsWith('/admin/pod') || path.startsWith('/admin/weighbridge')) {
    config = {
      hubTitle: 'Delivery Closure & Settlement Hub',
      badgeText: 'Unified Hub 9',
      tabs: [
        {
          id: 'pod',
          label: 'Digital POD Review & Sign-Off',
          path: '/admin/pod',
          icon: <CheckSquare size={15} />,
          badge: badges.pod && badges.pod > 0 ? badges.pod : undefined,
        },
        {
          id: 'weighbridge',
          label: 'Weighbridge Slips & Shortages',
          path: '/admin/weighbridge',
          icon: <Scale size={15} />,
        },
      ],
    };
  }

  // 6. Incident Triage & Omnichannel Communications
  else if (path.startsWith('/admin/communications') || path.startsWith('/admin/exceptions')) {
    config = {
      hubTitle: 'Incident Triage & Omnichannel Communications',
      badgeText: 'Unified Hub 11',
      tabs: [
        {
          id: 'comms',
          label: 'Omnichannel Chat Console',
          path: '/admin/communications',
          icon: <MessageSquare size={15} />,
          badge: badges.chats && badges.chats > 0 ? badges.chats : undefined,
        },
        {
          id: 'exceptions',
          label: 'Operational Exceptions Queue',
          path: '/admin/exceptions',
          icon: <AlertTriangle size={15} />,
          badge: badges.exceptions && badges.exceptions > 0 ? badges.exceptions : undefined,
        },
      ],
    };
  }

  // 7. Financial Ledger & Billing Portal
  else if (path.startsWith('/admin/payments')) {
    config = {
      hubTitle: 'Financial Ledger & Settlement Portal',
      badgeText: 'Unified Hub 10',
      tabs: [
        {
          id: 'all-payments',
          label: 'All Payments Overview',
          path: '/admin/payments',
          icon: <IndianRupee size={15} />,
          badge: badges.payments && badges.payments > 0 ? badges.payments : undefined,
        },
        {
          id: 'client-receivables',
          label: 'Client Receivables (Invoicing)',
          path: '/admin/payments?tab=client',
          icon: <Receipt size={15} />,
        },
        {
          id: 'vendor-payables',
          label: 'Vendor Payables (Settlements)',
          path: '/admin/payments?tab=vendor',
          icon: <DollarSign size={15} />,
        },
      ],
    };
  }

  // 8. Super Admin Governance Suite
  else if (
    path.startsWith('/admin/superadmin') ||
    path.startsWith('/admin/settings') ||
    path.startsWith('/admin/reports')
  ) {
    config = {
      hubTitle: 'Super Admin Governance & System Intelligence',
      badgeText: 'Unified Hub 12',
      tabs: [
        {
          id: 'reports',
          label: 'MIS & SLA Reports',
          path: '/admin/reports',
          icon: <BarChart3 size={15} />,
        },
        {
          id: 'users',
          label: 'Admin Staff & Users',
          path: '/admin/superadmin/users',
          icon: <Users size={15} />,
        },
        {
          id: 'rbac',
          label: 'RBAC Permission Matrix',
          path: '/admin/superadmin/rbac',
          icon: <Shield size={15} />,
        },
        {
          id: 'analytics',
          label: 'Commercial Yield Analytics',
          path: '/admin/superadmin/analytics',
          icon: <TrendingUp size={15} />,
        },
        {
          id: 'parameters',
          label: 'System Parameters',
          path: '/admin/superadmin/system-parameters',
          icon: <Sliders size={15} />,
        },
        {
          id: 'audit-logs',
          label: 'Immutable Audit Trail',
          path: '/admin/superadmin/audit-logs',
          icon: <FileText size={15} />,
        },
        {
          id: 'settings',
          label: 'System Settings',
          path: '/admin/settings',
          icon: <Settings size={15} />,
        },
      ],
    };
  }

  // If no hub matches or dashboard/client simple page, return null
  if (!config) return null;

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '0.6rem 1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#F05A22',
            background: 'rgba(240,90,34,0.08)',
            padding: '2px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {config.badgeText || 'Unified Hub'}
        </span>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
          {config.hubTitle}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.35rem',
        }}
      >
        {config.tabs.map((tab) => {
          const isActive =
            tab.path === path ||
            (tab.path.includes('?') &&
              path === tab.path.split('?')[0] &&
              location.search.includes(tab.path.split('?')[1])) ||
            (path.startsWith(tab.path) &&
              tab.path !== '/admin/fleet' &&
              tab.path !== '/admin/vendors' &&
              tab.path !== '/admin/payments');

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: isActive ? 600 : 500,
                border: isActive
                  ? '1px solid #F05A22'
                  : tab.highlight
                  ? '1px dashed #CBD5E1'
                  : '1px solid #E2E8F0',
                background: isActive
                  ? '#FFF5F2'
                  : tab.highlight
                  ? '#F8FAFC'
                  : '#FFFFFF',
                color: isActive
                  ? '#F05A22'
                  : tab.highlight
                  ? '#0F172A'
                  : '#64748B',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {Boolean(tab.badge) && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: '#EF4444',
                    color: '#FFFFFF',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    lineHeight: 1.2,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
