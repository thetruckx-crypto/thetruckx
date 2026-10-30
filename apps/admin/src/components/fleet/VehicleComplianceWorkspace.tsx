import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Download,
  Plus,
  Eye,
  FileText,
  Calendar,
  Building2,
  Truck,
  RotateCcw,
  Check,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';

interface VehicleComplianceRecord {
  id: string;
  registration_number: string;
  vehicle_type: string;
  make?: string;
  model?: string;
  vendor_id?: string;
  vendor_name?: string;
  verification_status: string;
  eligible_for_operations: boolean;
  
  // Document dates & statuses
  rc_number?: string;
  rc_expiry_date?: string | null;
  rc_verification_status?: string;

  insurance_policy_number?: string;
  insurance_expiry_date?: string | null;
  insurance_verification_status?: string;

  fitness_expiry_date?: string | null;
  fitness_verification_status?: string;

  permit_expiry_date?: string | null;
  permit_verification_status?: string;

  puc_expiry_date?: string | null;
  puc_verification_status?: string;

  updated_at?: string;
}

interface VehicleComplianceWorkspaceProps {
  onNavigateToVehicleDirectory: () => void;
  onNavigateToVerification: (vehicleId: string) => void;
  onNavigateToAddVehicle: () => void;
}

type ExpiryCategory = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING';

function evaluateExpiry(dateStr?: string | null, warningDays = 30): {
  status: ExpiryCategory;
  daysRemaining: number | null;
  formattedDate: string;
} {
  if (!dateStr) {
    return { status: 'MISSING', daysRemaining: null, formattedDate: 'Not Submitted' };
  }
  const expiry = new Date(dateStr);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const formattedDate = expiry.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if (diffDays < 0) {
    return { status: 'EXPIRED', daysRemaining: diffDays, formattedDate };
  }
  if (diffDays <= warningDays) {
    return { status: 'EXPIRING_SOON', daysRemaining: diffDays, formattedDate };
  }
  return { status: 'VALID', daysRemaining: diffDays, formattedDate };
}

export const VehicleComplianceWorkspace: React.FC<VehicleComplianceWorkspaceProps> = ({
  onNavigateToVehicleDirectory,
  onNavigateToVerification,
  onNavigateToAddVehicle,
}) => {
  const toast = useToast();
  const { adminProfile } = useAuth();

  const [vehicles, setVehicles] = useState<VehicleComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<'ALL' | 'COMPLIANT' | 'EXPIRING' | 'EXPIRED' | 'PENDING'>('ALL');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('ALL');
  const [selectedDocFilter, setSelectedDocFilter] = useState<'ALL' | 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT'>('ALL');
  const [warningDays, setWarningDays] = useState(30);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; fileType: string } | null>(null);

  // Fetch live vehicle compliance data
  const loadComplianceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureAdminSession();

      const { data, error: supaErr } = await supabase
        .from('vehicles')
        .select(`
          id,
          registration_number,
          vehicle_type,
          make,
          model,
          vendor_id,
          verification_status,
          eligible_for_operations,
          rc_number,
          rc_expiry_date,
          rc_verification_status,
          insurance_policy_number,
          insurance_expiry_date,
          insurance_verification_status,
          fitness_expiry_date,
          fitness_verification_status,
          permit_expiry_date,
          permit_verification_status,
          updated_at,
          vendor_companies(id, vendor_name)
        `)
        .order('created_at', { ascending: false });

      if (supaErr) throw supaErr;

      const mapped: VehicleComplianceRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        registration_number: row.registration_number,
        vehicle_type: row.vehicle_type,
        make: row.make,
        model: row.model,
        vendor_id: row.vendor_id,
        vendor_name: row.vendor_companies?.vendor_name || 'NECL Direct Fleet',
        verification_status: row.verification_status || 'PENDING_DOCS',
        eligible_for_operations: Boolean(row.eligible_for_operations),
        rc_number: row.rc_number,
        rc_expiry_date: row.rc_expiry_date,
        rc_verification_status: row.rc_verification_status || 'PENDING',
        insurance_policy_number: row.insurance_policy_number,
        insurance_expiry_date: row.insurance_expiry_date,
        insurance_verification_status: row.insurance_verification_status || 'PENDING',
        fitness_expiry_date: row.fitness_expiry_date,
        fitness_verification_status: row.fitness_verification_status || 'PENDING',
        permit_expiry_date: row.permit_expiry_date,
        permit_verification_status: row.permit_verification_status || 'PENDING',
        puc_expiry_date: null,
        puc_verification_status: 'PENDING',
        updated_at: row.updated_at,
      }));

      setVehicles(mapped);
    } catch (err: any) {
      console.error('Error fetching vehicle compliance:', err);
      setError(err.message || 'Unable to load vehicle compliance records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadComplianceData();
  }, [loadComplianceData]);

  // Derive compliance evaluation for each vehicle
  const evaluatedVehicles = useMemo(() => {
    return vehicles.map((v) => {
      const rc = evaluateExpiry(v.rc_expiry_date, warningDays);
      const ins = evaluateExpiry(v.insurance_expiry_date, warningDays);
      const fit = evaluateExpiry(v.fitness_expiry_date, warningDays);
      const per = evaluateExpiry(v.permit_expiry_date, warningDays);

      const hasExpired = rc.status === 'EXPIRED' || ins.status === 'EXPIRED' || fit.status === 'EXPIRED';
      const hasExpiringSoon = !hasExpired && (rc.status === 'EXPIRING_SOON' || ins.status === 'EXPIRING_SOON' || fit.status === 'EXPIRING_SOON');
      const hasMissing = rc.status === 'MISSING' || ins.status === 'MISSING' || fit.status === 'MISSING';
      const isPendingReview = v.verification_status === 'PENDING' || v.verification_status === 'PENDING_DOCS' ||
        v.rc_verification_status === 'PENDING' || v.insurance_verification_status === 'PENDING';

      let overallCompliance: 'COMPLIANT' | 'EXPIRING_SOON' | 'NON_COMPLIANT' | 'PENDING_REVIEW' = 'COMPLIANT';

      if (hasExpired || (hasMissing && v.verification_status !== 'APPROVED')) {
        overallCompliance = 'NON_COMPLIANT';
      } else if (hasExpiringSoon) {
        overallCompliance = 'EXPIRING_SOON';
      } else if (isPendingReview) {
        overallCompliance = 'PENDING_REVIEW';
      }

      return {
        ...v,
        rc,
        ins,
        fit,
        per,
        overallCompliance,
      };
    });
  }, [vehicles, warningDays]);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = evaluatedVehicles.length;
    const compliant = evaluatedVehicles.filter(v => v.overallCompliance === 'COMPLIANT').length;
    const expiringSoon = evaluatedVehicles.filter(v => v.overallCompliance === 'EXPIRING_SOON').length;
    const nonCompliant = evaluatedVehicles.filter(v => v.overallCompliance === 'NON_COMPLIANT').length;
    const pendingReview = evaluatedVehicles.filter(v => v.overallCompliance === 'PENDING_REVIEW').length;

    return { total, compliant, expiringSoon, nonCompliant, pendingReview };
  }, [evaluatedVehicles]);

  // Unique vendors for filter
  const uniqueVendors = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach(v => {
      if (v.vendor_name) map.set(v.vendor_name, v.vendor_name);
    });
    return Array.from(map.values()).sort();
  }, [vehicles]);

  // Filtered dataset
  const filteredVehicles = useMemo(() => {
    return evaluatedVehicles.filter((v) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesReg = v.registration_number.toLowerCase().includes(q);
        const matchesVen = (v.vendor_name || '').toLowerCase().includes(q);
        const matchesType = (v.vehicle_type || '').toLowerCase().includes(q);
        if (!matchesReg && !matchesVen && !matchesType) return false;
      }

      // 2. Status Tab Filter
      if (selectedStatusTab === 'COMPLIANT' && v.overallCompliance !== 'COMPLIANT') return false;
      if (selectedStatusTab === 'EXPIRING' && v.overallCompliance !== 'EXPIRING_SOON') return false;
      if (selectedStatusTab === 'EXPIRED' && v.overallCompliance !== 'NON_COMPLIANT') return false;
      if (selectedStatusTab === 'PENDING' && v.overallCompliance !== 'PENDING_REVIEW') return false;

      // 3. Vendor Filter
      if (selectedVendorFilter !== 'ALL' && v.vendor_name !== selectedVendorFilter) return false;

      // 4. Document Type Filter
      if (selectedDocFilter === 'RC' && v.rc.status === 'VALID') return false;
      if (selectedDocFilter === 'INSURANCE' && v.ins.status === 'VALID') return false;
      if (selectedDocFilter === 'FITNESS' && v.fit.status === 'VALID') return false;
      if (selectedDocFilter === 'PERMIT' && v.per.status === 'VALID') return false;

      return true;
    });
  }, [evaluatedVehicles, searchQuery, selectedStatusTab, selectedVendorFilter, selectedDocFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / itemsPerPage));
  const paginatedVehicles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVehicles.slice(start, start + itemsPerPage);
  }, [filteredVehicles, currentPage, itemsPerPage]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatusTab('ALL');
    setSelectedVendorFilter('ALL');
    setSelectedDocFilter('ALL');
    setWarningDays(30);
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (filteredVehicles.length === 0) {
      toast.error('No compliance records to export.');
      return;
    }

    const headers = [
      'Registration Number',
      'Vendor Name',
      'Vehicle Type',
      'RC Status',
      'RC Expiry',
      'Insurance Status',
      'Insurance Expiry',
      'Fitness Status',
      'Fitness Expiry',
      'Overall Compliance',
    ];

    const rows = filteredVehicles.map(v => [
      v.registration_number,
      `"${v.vendor_name || ''}"`,
      `"${v.vehicle_type || ''}"`,
      v.rc.status,
      v.rc.formattedDate,
      v.ins.status,
      v.ins.formattedDate,
      v.fit.status,
      v.fit.formattedDate,
      v.overallCompliance,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Vehicle_Compliance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Compliance report exported successfully.');
  };

  return (
    <div className="directory-page-container" style={{ padding: '24px 32px' }}>
      {/* ── Top Header ── */}
      <div className="directory-hero-banner" style={{ marginBottom: 20 }}>
        <div className="directory-hero-header">
          <div className="directory-hero-title-group">
            <div className="directory-hero-icon-box" style={{ background: '#FFF5F0', color: '#F05A22' }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 className="directory-hero-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#172B4D' }}>
                  Vehicle Compliance Workspace
                </h1>
                <span className="badge-blue" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6 }}>
                  Real-time Regulatory Monitor
                </span>
              </div>
              <p className="directory-hero-desc" style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13.5 }}>
                Centralized monitoring of RC, Commercial Insurance, Fitness, State Permits, and PUC certificates across all registered fleet assets.
              </p>
            </div>
          </div>

          <div className="directory-hero-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => {
                setRefreshing(true);
                loadComplianceData();
              }}
              disabled={refreshing}
              className="directory-btn-white"
              title="Refresh compliance dataset"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button onClick={handleExportCSV} className="directory-btn-white" title="Export CSV report">
              <Download size={15} />
              <span>Export CSV</span>
            </button>

            <button onClick={onNavigateToVehicleDirectory} className="directory-btn-white">
              <Truck size={15} />
              <span>Vehicle Master</span>
            </button>

            <button onClick={onNavigateToAddVehicle} className="directory-btn-orange">
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Vehicle</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 5 Metric Summary Cards ── */}
      <div className="directory-kpi-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {/* Total Vehicles */}
        <div
          className={`directory-kpi-card ${selectedStatusTab === 'ALL' ? 'active-kpi' : ''}`}
          onClick={() => { setSelectedStatusTab('ALL'); setCurrentPage(1); }}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon-squircle blue">
            <Truck size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Total Fleet</span>
            </div>
            <div className="directory-kpi-value">{loading ? '...' : summary.total}</div>
            <div className="directory-kpi-subtitle">Monitored vehicles</div>
          </div>
        </div>

        {/* Fully Compliant */}
        <div
          className={`directory-kpi-card ${selectedStatusTab === 'COMPLIANT' ? 'active-kpi' : ''}`}
          onClick={() => { setSelectedStatusTab('COMPLIANT'); setCurrentPage(1); }}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon-squircle green">
            <CheckCircle2 size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Compliant</span>
            </div>
            <div className="directory-kpi-value" style={{ color: '#16A34A' }}>{loading ? '...' : summary.compliant}</div>
            <div className="directory-kpi-subtitle">All certificates valid</div>
          </div>
        </div>

        {/* Expiring Soon */}
        <div
          className={`directory-kpi-card ${selectedStatusTab === 'EXPIRING' ? 'active-kpi' : ''}`}
          onClick={() => { setSelectedStatusTab('EXPIRING'); setCurrentPage(1); }}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon-squircle amber">
            <Clock size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Expiring Soon</span>
            </div>
            <div className="directory-kpi-value" style={{ color: '#D97706' }}>{loading ? '...' : summary.expiringSoon}</div>
            <div className="directory-kpi-subtitle">Within {warningDays} days</div>
          </div>
        </div>

        {/* Non-Compliant / Expired */}
        <div
          className={`directory-kpi-card ${selectedStatusTab === 'EXPIRED' ? 'active-kpi' : ''}`}
          onClick={() => { setSelectedStatusTab('EXPIRED'); setCurrentPage(1); }}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon-squircle red">
            <XCircle size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Expired / Non-Compliant</span>
            </div>
            <div className="directory-kpi-value" style={{ color: '#DC2626' }}>{loading ? '...' : summary.nonCompliant}</div>
            <div className="directory-kpi-subtitle">Blocked from dispatch</div>
          </div>
        </div>

        {/* Pending Review */}
        <div
          className={`directory-kpi-card ${selectedStatusTab === 'PENDING' ? 'active-kpi' : ''}`}
          onClick={() => { setSelectedStatusTab('PENDING'); setCurrentPage(1); }}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon-squircle purple">
            <FileText size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Pending Review</span>
            </div>
            <div className="directory-kpi-value" style={{ color: '#7C3AED' }}>{loading ? '...' : summary.pendingReview}</div>
            <div className="directory-kpi-subtitle">Awaiting officer audit</div>
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="directory-filter-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94A3B8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search vehicle reg no (e.g. AS-01), vendor, truck type..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Warning Period */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Warning:</label>
            <select
              value={warningDays}
              onChange={(e) => setWarningDays(Number(e.target.value))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF' }}
            >
              <option value={15}>15 Days</option>
              <option value={30}>30 Days (Default)</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>

          {/* Vendor Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Vendor:</label>
            <select
              value={selectedVendorFilter}
              onChange={(e) => { setSelectedVendorFilter(e.target.value); setCurrentPage(1); }}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', maxWidth: 180 }}
            >
              <option value="ALL">All Vendors</option>
              {uniqueVendors.map(vn => (
                <option key={vn} value={vn}>{vn}</option>
              ))}
            </select>
          </div>

          {/* Document Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Doc Risk:</label>
            <select
              value={selectedDocFilter}
              onChange={(e) => { setSelectedDocFilter(e.target.value as any); setCurrentPage(1); }}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF' }}
            >
              <option value="ALL">All Documents</option>
              <option value="RC">RC Expired/Due</option>
              <option value="INSURANCE">Insurance Expired/Due</option>
              <option value="FITNESS">Fitness Expired/Due</option>
              <option value="PERMIT">Permit Expired/Due</option>
            </select>
          </div>

          {/* Reset Filters */}
          <button
            onClick={handleResetFilters}
            className="directory-btn-white"
            style={{ padding: '8px 12px' }}
            title="Reset filters to default"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ── Compliance Records Table ── */}
      <div className="directory-table-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <RefreshCw size={32} className="animate-spin text-[#F05A22]" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, color: '#475569', fontSize: 14 }}>Auditing vehicle compliance and expiry records...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <AlertCircle size={36} color="#DC2626" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>Compliance Data Error</h3>
            <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>{error}</p>
            <button onClick={loadComplianceData} className="directory-btn-orange">
              <RefreshCw size={14} /> Retry Audit
            </button>
          </div>
        ) : paginatedVehicles.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#64748B' }}>
              <ShieldCheck size={32} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
              {searchQuery || selectedStatusTab !== 'ALL' || selectedVendorFilter !== 'ALL'
                ? 'No matching compliance records'
                : 'No vehicles registered in fleet'}
            </h3>
            <p style={{ color: '#64748B', fontSize: 13.5, maxWidth: 440, margin: '0 auto 18px' }}>
              {searchQuery || selectedStatusTab !== 'ALL'
                ? 'Try adjusting your search query, warning threshold, or filter criteria.'
                : 'Registered vehicles will automatically appear in this compliance workspace upon onboarding.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {(searchQuery || selectedStatusTab !== 'ALL' || selectedVendorFilter !== 'ALL') && (
                <button onClick={handleResetFilters} className="directory-btn-white">
                  Clear Filters
                </button>
              )}
              <button onClick={onNavigateToAddVehicle} className="directory-btn-orange">
                <Plus size={15} /> Add Vehicle
              </button>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="directory-table" style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '14px 18px' }}>Vehicle Reg & Model</th>
                  <th style={{ padding: '14px 16px' }}>Vendor Partner</th>
                  <th style={{ padding: '14px 16px' }}>RC Certificate</th>
                  <th style={{ padding: '14px 16px' }}>Commercial Insurance</th>
                  <th style={{ padding: '14px 16px' }}>Fitness Certificate</th>
                  <th style={{ padding: '14px 16px' }}>State Permit</th>
                  <th style={{ padding: '14px 16px' }}>Overall Compliance</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVehicles.map((v) => {
                  return (
                    <tr
                      key={v.id}
                      style={{ borderBottom: '1px solid #F1F5F9', fontSize: 13, transition: 'background 0.15s ease' }}
                      className="hover:bg-slate-50/60"
                    >
                      {/* Registration & Make */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Truck size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'monospace', fontSize: 13.5 }}>
                              {v.registration_number}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#64748B' }}>
                              {v.vehicle_type} {v.make ? `• ${v.make}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vendor */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={14} color="#64748B" />
                          <span style={{ fontWeight: 600, color: '#1E293B', fontSize: 12.5 }}>
                            {v.vendor_name}
                          </span>
                        </div>
                      </td>

                      {/* RC Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {v.rc.status === 'VALID' && <CheckCircle2 size={13} color="#16A34A" />}
                            {v.rc.status === 'EXPIRING_SOON' && <Clock size={13} color="#D97706" />}
                            {v.rc.status === 'EXPIRED' && <XCircle size={13} color="#DC2626" />}
                            {v.rc.status === 'MISSING' && <AlertTriangle size={13} color="#94A3B8" />}
                            <span style={{
                              fontWeight: 600,
                              fontSize: 12,
                              color: v.rc.status === 'VALID' ? '#16A34A' : v.rc.status === 'EXPIRING_SOON' ? '#D97706' : v.rc.status === 'EXPIRED' ? '#DC2626' : '#64748B'
                            }}>
                              {v.rc.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            {v.rc.formattedDate}
                          </div>
                        </div>
                      </td>

                      {/* Insurance */}
                      <td style={{ padding: '14px 16px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {v.ins.status === 'VALID' && <CheckCircle2 size={13} color="#16A34A" />}
                            {v.ins.status === 'EXPIRING_SOON' && <Clock size={13} color="#D97706" />}
                            {v.ins.status === 'EXPIRED' && <XCircle size={13} color="#DC2626" />}
                            {v.ins.status === 'MISSING' && <AlertTriangle size={13} color="#94A3B8" />}
                            <span style={{
                              fontWeight: 600,
                              fontSize: 12,
                              color: v.ins.status === 'VALID' ? '#16A34A' : v.ins.status === 'EXPIRING_SOON' ? '#D97706' : v.ins.status === 'EXPIRED' ? '#DC2626' : '#64748B'
                            }}>
                              {v.ins.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            {v.ins.formattedDate}
                          </div>
                        </div>
                      </td>

                      {/* Fitness */}
                      <td style={{ padding: '14px 16px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {v.fit.status === 'VALID' && <CheckCircle2 size={13} color="#16A34A" />}
                            {v.fit.status === 'EXPIRING_SOON' && <Clock size={13} color="#D97706" />}
                            {v.fit.status === 'EXPIRED' && <XCircle size={13} color="#DC2626" />}
                            {v.fit.status === 'MISSING' && <AlertTriangle size={13} color="#94A3B8" />}
                            <span style={{
                              fontWeight: 600,
                              fontSize: 12,
                              color: v.fit.status === 'VALID' ? '#16A34A' : v.fit.status === 'EXPIRING_SOON' ? '#D97706' : v.fit.status === 'EXPIRED' ? '#DC2626' : '#64748B'
                            }}>
                              {v.fit.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            {v.fit.formattedDate}
                          </div>
                        </div>
                      </td>

                      {/* Permit */}
                      <td style={{ padding: '14px 16px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {v.per.status === 'VALID' && <CheckCircle2 size={13} color="#16A34A" />}
                            {v.per.status === 'EXPIRING_SOON' && <Clock size={13} color="#D97706" />}
                            {v.per.status === 'EXPIRED' && <XCircle size={13} color="#DC2626" />}
                            {v.per.status === 'MISSING' && <AlertTriangle size={13} color="#94A3B8" />}
                            <span style={{
                              fontWeight: 600,
                              fontSize: 12,
                              color: v.per.status === 'VALID' ? '#16A34A' : v.per.status === 'EXPIRING_SOON' ? '#D97706' : v.per.status === 'EXPIRED' ? '#DC2626' : '#64748B'
                            }}>
                              {v.per.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            {v.per.formattedDate}
                          </div>
                        </div>
                      </td>

                      {/* Overall Compliance */}
                      <td style={{ padding: '14px 16px' }}>
                        {v.overallCompliance === 'COMPLIANT' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 700 }}>
                            <ShieldCheck size={13} /> Compliant
                          </span>
                        )}
                        {v.overallCompliance === 'EXPIRING_SOON' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#B45309', padding: '4px 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 700 }}>
                            <Clock size={13} /> Due Soon
                          </span>
                        )}
                        {v.overallCompliance === 'NON_COMPLIANT' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEE2E2', color: '#B91C1C', padding: '4px 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 700 }}>
                            <ShieldAlert size={13} /> Non-Compliant
                          </span>
                        )}
                        {v.overallCompliance === 'PENDING_REVIEW' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F3E8FF', color: '#7E22CE', padding: '4px 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 700 }}>
                            <Clock size={13} /> Pending Audit
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          onClick={() => onNavigateToVerification(v.id)}
                          style={{
                            padding: '6px 12px',
                            background: '#FFF5F0',
                            border: '1px solid rgba(240, 90, 34, 0.25)',
                            color: '#F05A22',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                          title="Open detailed compliance audit"
                        >
                          <Eye size={13} />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Table Footer & Pagination ── */}
        {!loading && filteredVehicles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <span style={{ fontSize: 12.5, color: '#64748B' }}>
              Showing <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredVehicles.length)}</strong> of <strong>{filteredVehicles.length}</strong> vehicles
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Document Preview Modal ── */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          documentTitle={previewDoc.title}
          fileName={`${previewDoc.title.replace(/\s+/g, '_')}.pdf`}
          fileUrlOrPath={previewDoc.url}
        />
      )}
    </div>
  );
};
