import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, Shield, BarChart3, FileText, Settings,
  Plus, Edit2, Trash2, CheckCircle, XCircle, Search,
  RefreshCw, Loader2, Download, Filter, TrendingUp,
  IndianRupee, AlertTriangle, Eye, Smartphone, CheckSquare, Clock, UserCheck,
  Lock, Unlock, ChevronRight, ChevronDown, Check, RotateCcw, AlertCircle,
  Layers, FileSpreadsheet, Receipt, CalendarCheck, ShieldCheck, Compass, Scale, Sliders, Save
} from "lucide-react";
import { supabase } from "../../utils/supabase";
import { apiFetch } from "../../utils/api";
import { useToast } from "../../context/ToastContext";

// ─── Shared helpers ────────────────────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: "2rem", right: "2rem", background: "#F45325", color: "#fff",
      padding: "1rem 1.5rem", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,.2)",
      display: "flex", alignItems: "center", gap: ".75rem", zIndex: 9999, fontWeight: 600
    }}>
      <CheckCircle size={20} />{msg}
    </div>
  );
}

// ─── 1. Admin User Management ─────────────────────────────────────────────────
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_sign_in_at?: string;
}

interface RoleDisputeRequest {
  id: string;
  mobile: string;
  current_role: 'CLIENT' | 'VENDOR' | 'DRIVER';
  desired_role: 'CLIENT' | 'VENDOR' | 'DRIVER';
  reason: string;
  status: 'PENDING_ADMIN_APPROVAL' | 'APPROVED_DEACTIVATED' | 'DELETED';
  requested_at: string;
}

export const AdminUserManagement: React.FC = () => {
  const globalToast = useToast();
  const [activeTab, setActiveTab] = useState<'ADMIN_STAFF' | 'ROLE_DISPUTES'>('ROLE_DISPUTES');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [disputes, setDisputes] = useState<RoleDisputeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [manualPhone, setManualPhone] = useState("");
  const [manualDesiredRole, setManualDesiredRole] = useState<'CLIENT' | 'VENDOR' | 'DRIVER'>('CLIENT');
  const [form, setForm] = useState({ name: "", email: "", role: "ADMIN", password: "" });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("admin_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setUsers(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchDisputes = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("role_change_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      if (data && data.length > 0) {
        setDisputes(data as any);
        return;
      }
    } catch (e) {
      // fallback to auth_audit_log
    }

    try {
      const { data: auditData } = await supabase
        .from("auth_audit_log")
        .select("*")
        .eq("event_type", "ROLE_DEACTIVATION_REQUESTED")
        .order("created_at", { ascending: false });

      if (auditData && auditData.length > 0) {
        const mapped: RoleDisputeRequest[] = auditData.map((a: any) => ({
          id: a.details?.id || a.id,
          mobile: a.details?.mobile || a.user_id,
          current_role: a.details?.currentRole || "CLIENT",
          desired_role: a.details?.requestedRole || "VENDOR",
          reason: a.details?.reason || "User requested role correction",
          status: a.details?.status || "PENDING",
          requested_at: a.details?.requestedAt || a.created_at,
        }));
        setDisputes(mapped);
      }
    } catch (e) {
      console.warn("Could not query role change disputes", e);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchDisputes();
  }, [fetchUsers, fetchDisputes]);

  const handleCreate = async () => {
    if (!form.name || !form.email) {
      globalToast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      await supabase.from("admin_users").insert({
        name: form.name, email: form.email, role: form.role, is_active: true
      });
      globalToast.success("Admin user created successfully");
      setShowModal(false);
      setForm({ name: "", email: "", role: "ADMIN", password: "" });
      fetchUsers();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const toggleActive = async (user: AdminUser) => {
    await supabase.from("admin_users").update({ is_active: !user.is_active }).eq("id", user.id);
    setToast(`User ${user.is_active ? "deactivated" : "activated"}`);
    fetchUsers();
  };

  const handleApproveDeactivation = async (req: RoleDisputeRequest) => {
    try {
      await supabase
        .from("role_change_requests")
        .update({ status: "APPROVED_DEACTIVATED" })
        .eq("id", req.id);
    } catch {}

    const clean = req.mobile.replace(/\D/g, "").slice(-10);
    try {
      if (req.current_role === "CLIENT") {
        await supabase.from("client_users").update({ status: "DEACTIVATED" }).eq("mobile", clean);
      } else if (req.current_role === "VENDOR") {
        await supabase.from("vendor_users").update({ status: "DEACTIVATED" }).eq("mobile", clean);
      } else if (req.current_role === "DRIVER") {
        await supabase.from("drivers").update({ status: "DEACTIVATED" }).or(`mobile.eq.${clean},phone.eq.${clean}`);
      }
    } catch {}

    setDisputes(prev =>
      prev.map(d => d.id === req.id ? { ...d, status: 'APPROVED_DEACTIVATED' } : d)
    );
    setToast(`Account +91 ${req.mobile} deactivated & released! User can now register as ${req.desired_role}.`);
  };

  const handleDeleteAccount = async (req: RoleDisputeRequest) => {
    try {
      await supabase
        .from("role_change_requests")
        .delete()
        .eq("id", req.id);
    } catch {}

    const clean = req.mobile.replace(/\D/g, "").slice(-10);
    try {
      if (req.current_role === "CLIENT") {
        await supabase.from("client_users").delete().eq("mobile", clean);
      } else if (req.current_role === "VENDOR") {
        await supabase.from("vendor_users").delete().eq("mobile", clean);
      } else if (req.current_role === "DRIVER") {
        await supabase.from("drivers").delete().or(`mobile.eq.${clean},phone.eq.${clean}`);
      }
    } catch {}

    setDisputes(prev => prev.filter(d => d.id !== req.id));
    setToast(`Incorrect account record for +91 ${req.mobile} deleted from database.`);
  };

  const handleManualRelease = async () => {
    const clean = manualPhone.replace(/\D/g, "");
    if (clean.length !== 10) {
      globalToast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    const newEntry: RoleDisputeRequest = {
      id: `manual-${Date.now()}`,
      mobile: clean,
      current_role: 'CLIENT',
      desired_role: manualDesiredRole,
      reason: 'Admin verified and released mobile manually.',
      status: 'APPROVED_DEACTIVATED',
      requested_at: new Date().toISOString()
    };
    try {
      await supabase.from("role_change_requests").insert(newEntry);
    } catch (e) {
      console.warn(e);
    }
    setDisputes(prev => [newEntry, ...prev]);
    setShowReleaseModal(false);
    setManualPhone("");
    setToast(`Mobile +91 ${clean} deactivated & released for registration as ${manualDesiredRole}.`);
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDisputes = disputes.filter(d =>
    d.mobile.includes(search) ||
    d.current_role.toLowerCase().includes(search.toLowerCase()) ||
    d.desired_role.toLowerCase().includes(search.toLowerCase()) ||
    d.reason.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="cli-dir-wrapper">
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Super Admin</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">User Management & Role Verification</span>
      </div>

      <div className="page-header-row">
        <div>
          <h1 className="page-title">User Management & Role Dispute Approvals</h1>
          <p className="page-subtitle">
            Manage admin staff and review/approve mobile role deactivations for Client, Vendor, and Driver users
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {activeTab === 'ROLE_DISPUTES' ? (
            <button className="btn-create-gold" onClick={() => setShowReleaseModal(true)}>
              <Smartphone size={16} /><span>Release Mobile Number</span>
            </button>
          ) : (
            <button className="btn-create-gold" onClick={() => setShowModal(true)}>
              <Plus size={16} /><span>Add Admin User</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Sub-Tab Switcher */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", borderBottom: "2px solid rgba(244,83,37,0.15)", paddingBottom: "0.5rem" }}>
        <button
          onClick={() => setActiveTab('ROLE_DISPUTES')}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.6rem 1.2rem", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem",
            background: activeTab === 'ROLE_DISPUTES' ? "#F45325" : "transparent",
            color: activeTab === 'ROLE_DISPUTES' ? "#FFFFFF" : "#4A5568"
          }}
        >
          <Smartphone size={16} />
          <span>Mobile Role Dispute Approvals</span>
          <span style={{
            background: activeTab === 'ROLE_DISPUTES' ? "#FFFFFF" : "#F45325",
            color: activeTab === 'ROLE_DISPUTES' ? "#F45325" : "#FFFFFF",
            fontSize: "0.75rem", padding: "0.1rem 0.45rem", borderRadius: "999px"
          }}>
            {disputes.filter(d => d.status === 'PENDING_ADMIN_APPROVAL').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ADMIN_STAFF')}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.6rem 1.2rem", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem",
            background: activeTab === 'ADMIN_STAFF' ? "#F45325" : "transparent",
            color: activeTab === 'ADMIN_STAFF' ? "#FFFFFF" : "#4A5568"
          }}
        >
          <Shield size={16} />
          <span>Admin Panel Staff & Roles</span>
          <span style={{
            background: activeTab === 'ADMIN_STAFF' ? "#FFFFFF" : "#F45325",
            color: activeTab === 'ADMIN_STAFF' ? "#F45325" : "#FFFFFF",
            fontSize: "0.75rem", padding: "0.1rem 0.45rem", borderRadius: "999px"
          }}>
            {users.length}
          </span>
        </button>
      </div>

      {activeTab === 'ROLE_DISPUTES' ? (
        <>
          {/* KPI bar for Role Disputes */}
          <div className="client-kpi-bar">
            <div className="kpi-stat-card">
              <div className="kpi-stat-icon" style={{ background: "rgba(244,83,37,0.12)" }}>
                <Clock size={20} color="#F45325" />
              </div>
              <div>
                <div className="kpi-stat-label">Pending Verification</div>
                <div className="kpi-stat-value">
                  {disputes.filter(d => d.status === 'PENDING_ADMIN_APPROVAL').length}
                </div>
              </div>
            </div>
            <div className="kpi-stat-card">
              <div className="kpi-stat-icon" style={{ background: "rgba(16,185,129,0.12)" }}>
                <CheckCircle size={20} color="#10B981" />
              </div>
              <div>
                <div className="kpi-stat-label">Approved & Released</div>
                <div className="kpi-stat-value">
                  {disputes.filter(d => d.status === 'APPROVED_DEACTIVATED').length}
                </div>
              </div>
            </div>
            <div className="kpi-stat-card">
              <div className="kpi-stat-icon" style={{ background: "rgba(59,130,246,0.12)" }}>
                <Smartphone size={20} color="#3B82F6" />
              </div>
              <div>
                <div className="kpi-stat-label">Total Requests</div>
                <div className="kpi-stat-value">{disputes.length}</div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="client-toolbar-bar">
            <div className="search-input-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                className="search-input-field" type="text"
                placeholder="Search by mobile number, role, or reason..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-create-gold" style={{ background: "#FFFFFF", color: "#111111" }} onClick={fetchDisputes}>
              <RefreshCw size={16} /><span>Refresh Queue</span>
            </button>
          </div>

          {/* Role Disputes Table */}
          <div className="white-data-table-card">
            <table className="data-table-standard">
              <thead>
                <tr>
                  <th>Mobile Number</th>
                  <th>Registered Role</th>
                  <th>Desired Role</th>
                  <th>Reason for Dispute</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: "center" }}>Admin Verification Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDisputes.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "#64748B" }}>
                      No role disputes pending verification.
                    </td>
                  </tr>
                )}
                {filteredDisputes.map(req => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: 700, color: "#0A1931" }}>
                      +91 {req.mobile}
                    </td>
                    <td>
                      <span className="status-badge" style={{ background: "#FEE2E2", color: "#DC2626", fontWeight: 700 }}>
                        {req.current_role}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge" style={{ background: "#DEF7EC", color: "#0E9F6E", fontWeight: 700 }}>
                        {req.desired_role}
                      </span>
                    </td>
                    <td style={{ color: "#374151", maxWidth: "280px" }}>
                      {req.reason}
                    </td>
                    <td>
                      <span className="status-badge" style={{
                        background: req.status === 'PENDING_ADMIN_APPROVAL' ? "#FEF3EE" : "#E0F2FE",
                        color: req.status === 'PENDING_ADMIN_APPROVAL' ? "#F45325" : "#0284C7",
                        fontWeight: 700
                      }}>
                        {req.status === 'PENDING_ADMIN_APPROVAL' ? 'Pending Verification' : 'Approved & Released'}
                      </span>
                    </td>
                    <td style={{ color: "#6B7280", fontSize: "0.85rem" }}>
                      {new Date(req.requested_at).toLocaleString()}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {req.status === 'PENDING_ADMIN_APPROVAL' ? (
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                          <button
                            onClick={() => handleApproveDeactivation(req)}
                            style={{
                              padding: "0.45rem 0.9rem",
                              background: "#F45325",
                              color: "#FFFFFF",
                              border: "none", borderRadius: "6px", cursor: "pointer",
                              fontSize: "0.8rem", fontWeight: 700
                            }}
                          >
                            Deactivate & Release
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(req)}
                            style={{
                              padding: "0.45rem 0.75rem",
                              background: "#EF4444",
                              color: "#FFFFFF",
                              border: "none", borderRadius: "6px", cursor: "pointer",
                              fontSize: "0.8rem", fontWeight: 700
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", alignItems: "center" }}>
                          <span style={{ fontSize: "0.8rem", color: "#0E9F6E", fontWeight: 700 }}>
                            Ready for Re-Registration
                          </span>
                          <button
                            onClick={() => handleDeleteAccount(req)}
                            style={{
                              padding: "0.3rem 0.6rem",
                              background: "#F3F4F6",
                              color: "#6B7280",
                              border: "none", borderRadius: "4px", cursor: "pointer",
                              fontSize: "0.75rem"
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* KPI bar for Admin Users */}
          <div className="client-kpi-bar">
            <div className="kpi-stat-card">
              <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}><Users size={20} color="#F45325" /></div>
              <div><div className="kpi-stat-label">Total Users</div><div className="kpi-stat-value">{users.length}</div></div>
            </div>
            <div className="kpi-stat-card">
              <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}><CheckCircle size={20} color="#F45325" /></div>
              <div><div className="kpi-stat-label">Active</div><div className="kpi-stat-value">{users.filter(u => u.is_active).length}</div></div>
            </div>
            <div className="kpi-stat-card">
              <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}><Shield size={20} color="#F45325" /></div>
              <div><div className="kpi-stat-label">Super Admins</div><div className="kpi-stat-value">{users.filter(u => u.role === "SUPER_ADMIN").length}</div></div>
            </div>
            <div className="kpi-stat-card">
              <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}><Users size={20} color="#F45325" /></div>
              <div><div className="kpi-stat-label">Admins</div><div className="kpi-stat-value">{users.filter(u => u.role === "ADMIN").length}</div></div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="client-toolbar-bar">
            <div className="search-input-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                className="search-input-field" type="text"
                placeholder="Search by name or email..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-create-gold" style={{ background: "#FFFFFF", color: "#111111" }} onClick={fetchUsers}>
              <RefreshCw size={16} /><span>Refresh</span>
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "4rem" }}>
              <Loader2 size={40} color="#F45325" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <div className="white-data-table-card">
              <table className="data-table-standard">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748B" }}>No users found</td></tr>
                  )}
                  {filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 600, color: "#111111" }}>{user.name}</td>
                      <td style={{ color: "#64748B" }}>{user.email}</td>
                      <td>
                        <span className="status-badge" style={{
                          background: "#FEF3EE",
                          color: "#F45325"
                        }}>
                          {user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge" style={{
                          background: user.is_active ? "#DEF7EC" : "#FEE2E2",
                          color: user.is_active ? "#0E9F6E" : "#DC2626"
                        }}>
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ color: "#64748B", fontSize: "0.85rem" }}>
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => toggleActive(user)}
                          style={{
                            padding: "0.4rem 0.9rem",
                            background: user.is_active ? "#FEF3EE" : "#DEF7EC",
                            color: user.is_active ? "#F45325" : "#0E9F6E",
                            border: "none", borderRadius: "6px", cursor: "pointer",
                            fontSize: "0.8rem", fontWeight: 600
                          }}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Manual Release Mobile Modal */}
      {showReleaseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1.5rem" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: "100%", maxWidth: "480px" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0A1931", marginBottom: "0.5rem" }}>
              Release Mobile for Re-Registration
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#6B7280", marginBottom: "1.5rem" }}>
              Deactivates the existing account registered under the wrong role and allows the user to immediately register again.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", fontWeight: 600, marginBottom: "0.4rem" }}>
                  10-Digit Mobile Number *
                </label>
                <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(244,83,37,0.3)", borderRadius: "6px", overflow: "hidden" }}>
                  <span style={{ padding: "0.75rem", background: "#F3F4F6", color: "#374151", fontWeight: 600, fontSize: "0.9rem" }}>+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={manualPhone}
                    onChange={e => setManualPhone(e.target.value)}
                    style={{ flex: 1, padding: "0.75rem", border: "none", outline: "none", fontSize: "0.9rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Authorized New Role *
                </label>
                <select
                  value={manualDesiredRole}
                  onChange={e => setManualDesiredRole(e.target.value as any)}
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid rgba(244,83,37,0.3)", borderRadius: "6px", fontSize: "0.9rem" }}
                >
                  <option value="CLIENT">Client (Shipper)</option>
                  <option value="VENDOR">Vendor (Transporter / Fleet Owner)</option>
                  <option value="DRIVER">Driver</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1.75rem" }}>
              <button
                onClick={() => setShowReleaseModal(false)}
                style={{ flex: 1, padding: "0.75rem", background: "#F3F4F6", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, color: "#374151" }}
              >
                Cancel
              </button>
              <button
                onClick={handleManualRelease}
                className="btn-create-gold"
                style={{ flex: 1 }}
              >
                Deactivate & Release
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1.5rem" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#111111", marginBottom: "1.5rem" }}>Add Admin User</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[
                { label: "Full Name *", key: "name", type: "text", ph: "John Doe" },
                { label: "Email Address *", key: "email", type: "email", ph: "john@necl.in" },
                { label: "Temporary Password *", key: "password", type: "password", ph: "••••••••" },
              ].map(({ label, key, type, ph }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem" }}>{label}</label>
                  <input
                    type={type} placeholder={ph} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid rgba(244,83,37,0.25)", borderRadius: "6px", fontSize: "0.9rem" }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem" }}>Role *</label>
                <select
                  value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid rgba(244,83,37,0.25)", borderRadius: "6px", fontSize: "0.9rem" }}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="OPERATIONS_MANAGER">Operations Manager</option>
                  <option value="FINANCE_TEAM">Finance Team</option>
                  <option value="CUSTOMER_SERVICE">Customer Service</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "0.75rem", background: "#FFFFFF", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="btn-create-gold" style={{ flex: 1 }}>
                {saving ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ─── 2. Granular Toggle-Based Permissions Management ────────────────────────
export interface ModulePermissionConfig {
  enabled: boolean;
  actions: Record<string, boolean>;
  scope?: 'ALL' | 'ASSIGNED';
}

export type PermissionsMatrix = Record<string, ModulePermissionConfig>;

interface ModuleDefinition {
  key: string;
  name: string;
  group: string;
  description: string;
  allowedActions: { key: string; label: string; isCommercial?: boolean; isDanger?: boolean }[];
}

const PERMISSION_MODULE_DEFINITIONS: ModuleDefinition[] = [
  // 1. Overview & Mobile Users
  {
    key: "dashboard",
    name: "Dashboard & Analytics",
    group: "OVERVIEW & MOBILE USERS",
    description: "Operational KPIs, real-time volume metrics, and quick action shortcuts",
    allowedActions: [
      { key: "view", label: "View Dashboard" },
      { key: "export", label: "Export Metrics" },
    ],
  },
  {
    key: "clients",
    name: "Client Management",
    group: "OVERVIEW & MOBILE USERS",
    description: "Client directory, mobile registration approvals, profiles, and account suspension",
    allowedActions: [
      { key: "view", label: "View Clients" },
      { key: "create", label: "Create Client" },
      { key: "edit", label: "Edit Profile" },
      { key: "approve", label: "Approve Registration" },
      { key: "reject", label: "Reject / Request Corrections" },
      { key: "suspend", label: "Suspend / Restore", isDanger: true },
      { key: "export", label: "Export Client Data" },
      { key: "delete", label: "Delete Records", isDanger: true },
    ],
  },
  {
    key: "vendors",
    name: "Vendor Management",
    group: "OVERVIEW & MOBILE USERS",
    description: "Transporter directory, mobile registration approvals, fleet associations, and verification",
    allowedActions: [
      { key: "view", label: "View Vendors" },
      { key: "create", label: "Invite Vendor" },
      { key: "edit", label: "Edit Vendor Details" },
      { key: "approve", label: "Approve Registration" },
      { key: "reject", label: "Reject Application" },
      { key: "suspend", label: "Suspend / Block", isDanger: true },
      { key: "export", label: "Export Vendor List" },
      { key: "delete", label: "Delete Records", isDanger: true },
    ],
  },
  {
    key: "drivers",
    name: "Driver Verification & Fleet",
    group: "OVERVIEW & MOBILE USERS",
    description: "Driver verification queue, license audits, vendor tie-up, and status management",
    allowedActions: [
      { key: "view", label: "View Drivers" },
      { key: "create", label: "Add Driver" },
      { key: "edit", label: "Edit Driver Info" },
      { key: "approve", label: "Approve License" },
      { key: "reject", label: "Reject Verification" },
      { key: "suspend", label: "Suspend Driver", isDanger: true },
      { key: "verify", label: "Compliance Audit" },
      { key: "export", label: "Export Drivers" },
      { key: "delete", label: "Delete Records", isDanger: true },
    ],
  },
  {
    key: "fleet",
    name: "Fleet Directory & Vehicles",
    group: "OVERVIEW & MOBILE USERS",
    description: "Master vehicle registry, RC/insurance audits, vendor tie-up approvals",
    allowedActions: [
      { key: "view", label: "View Fleet" },
      { key: "create", label: "Register Vehicle" },
      { key: "edit", label: "Edit Vehicle Specs" },
      { key: "approve", label: "Approve Vehicle" },
      { key: "reject", label: "Reject Vehicle" },
      { key: "suspend", label: "Deactivate Vehicle", isDanger: true },
      { key: "verify", label: "Verify Documents" },
      { key: "export", label: "Export Fleet" },
      { key: "delete", label: "Delete Vehicle", isDanger: true },
    ],
  },

  // 2. Sourcing, Quotations & Bookings
  {
    key: "requirements",
    name: "Transport Requirements",
    group: "SOURCING, QUOTATIONS & BOOKINGS",
    description: "Client freight inquiries, route specifications, cargo tons, and sourcing review",
    allowedActions: [
      { key: "view", label: "View Requirements" },
      { key: "create", label: "Create Requirement" },
      { key: "edit", label: "Edit Requirements" },
      { key: "approve", label: "Accept for Sourcing" },
      { key: "reject", label: "Reject / Cancel" },
      { key: "assign", label: "Assign to Ops Team" },
      { key: "export", label: "Export Inquiries" },
      { key: "delete", label: "Delete Records", isDanger: true },
    ],
  },
  {
    key: "quotations",
    name: "Vendor Sourcing & RFQ",
    group: "SOURCING, QUOTATIONS & BOOKINGS",
    description: "Dispatching RFQs to selected vendors, tracking response deadlines",
    allowedActions: [
      { key: "view", label: "View RFQ Batches" },
      { key: "create", label: "Dispatch RFQ" },
      { key: "edit", label: "Modify Deadline" },
      { key: "assign", label: "Select Vendors" },
      { key: "export", label: "Export RFQ Data" },
      { key: "delete", label: "Cancel RFQ", isDanger: true },
    ],
  },
  {
    key: "vendor_quotes",
    name: "Vendor Quotations & Comparison",
    group: "SOURCING, QUOTATIONS & BOOKINGS",
    description: "Confidential transporter submissions, rate analysis, and winning bid selection",
    allowedActions: [
      { key: "view", label: "View Vendor Quotes" },
      { key: "create", label: "Record Offline Quote" },
      { key: "edit", label: "Adjust Quote Items" },
      { key: "approve", label: "Award Quote" },
      { key: "reject", label: "Decline Rate" },
      { key: "export", label: "Export Transporter Rates" },
      { key: "view_margins", label: "Commercial Margin Access", isCommercial: true },
    ],
  },
  {
    key: "pricing",
    name: "Client Quotes & Pricing",
    group: "SOURCING, QUOTATIONS & BOOKINGS",
    description: "Client-facing quotations, line-item charges, markup calculations, GST",
    allowedActions: [
      { key: "view", label: "View Client Quotes" },
      { key: "create", label: "Generate Quote" },
      { key: "edit", label: "Revise Rate & Line Items" },
      { key: "approve", label: "Send to Client" },
      { key: "reject", label: "Mark Expired" },
      { key: "export", label: "Export Proposals" },
      { key: "view_margins", label: "Internal Margin Breakdown", isCommercial: true },
    ],
  },
  {
    key: "bookings",
    name: "Booking & Multi-Trip Operations",
    group: "SOURCING, QUOTATIONS & BOOKINGS",
    description: "Confirmed freight contracts, multi-trip split, vehicle & driver assignments",
    allowedActions: [
      { key: "view", label: "View Bookings" },
      { key: "create", label: "Confirm Booking" },
      { key: "edit", label: "Edit Booking Info" },
      { key: "assign", label: "Assign Lorry & Driver" },
      { key: "close", label: "Complete Booking" },
      { key: "export", label: "Export Bookings" },
      { key: "delete", label: "Cancel Booking", isDanger: true },
    ],
  },

  // 3. Execution, Clearance & Tracking
  {
    key: "pretrip",
    name: "Pre-Trip Checks & Gate Passes",
    group: "EXECUTION, CLEARANCE & TRACKING",
    description: "Statutory checklist clearance (RC, Insurance, PUC, License, E-Way Bill)",
    allowedActions: [
      { key: "view", label: "View Checklists" },
      { key: "edit", label: "Fill Checklist" },
      { key: "verify", label: "Issue Gate Pass" },
      { key: "upload", label: "Upload Pass Copy" },
      { key: "export", label: "Download Gate Pass" },
    ],
  },
  {
    key: "tracking",
    name: "Trip Tracking & Milestones",
    group: "EXECUTION, CLEARANCE & TRACKING",
    description: "Trip milestones progression (Departed, Loading, In Transit, Arrived, Delivered)",
    allowedActions: [
      { key: "view", label: "View Live Trips" },
      { key: "create", label: "Log Manual Milestone" },
      { key: "edit", label: "Update Milestone Notes" },
      { key: "export", label: "Export Trip History" },
    ],
  },
  {
    key: "weighbridge",
    name: "Weighbridge & Weight Slips",
    group: "EXECUTION, CLEARANCE & TRACKING",
    description: "Gross, tare, net weight capture, weighbridge slip audits, billable tons",
    allowedActions: [
      { key: "view", label: "View Weighments" },
      { key: "create", label: "Record Weight Slip" },
      { key: "edit", label: "Adjust Tare/Gross" },
      { key: "verify", label: "Certify Weights" },
      { key: "upload", label: "Upload Weighbridge Slip" },
      { key: "export", label: "Export Weight Slips" },
    ],
  },
  {
    key: "documents",
    name: "Document Clearance & Vault",
    group: "EXECUTION, CLEARANCE & TRACKING",
    description: "Central statutory document repository, KYC verification, compliance checks",
    allowedActions: [
      { key: "view", label: "View Document Vault" },
      { key: "verify", label: "Verify Compliance" },
      { key: "upload", label: "Upload Direct Document" },
      { key: "reject", label: "Reject Document" },
      { key: "export", label: "Download File Archives" },
      { key: "delete", label: "Purge Documents", isDanger: true },
    ],
  },
  {
    key: "pod",
    name: "Proof of Delivery & Trip Closure",
    group: "EXECUTION, CLEARANCE & TRACKING",
    description: "Receiver sign-off, signed LR challan audit, discrepancies resolution, trip closure",
    allowedActions: [
      { key: "view", label: "View POD Queue" },
      { key: "approve", label: "Approve Clean POD" },
      { key: "reject", label: "Reject POD / Reason" },
      { key: "close", label: "Close Trip & Release Lorry" },
      { key: "export", label: "Download POD Copies" },
    ],
  },

  // 4. Financials, Reports & Governance
  {
    key: "payments",
    name: "Payments & Financial Ledger",
    group: "FINANCE, REPORTS & GOVERNANCE",
    description: "Client receivables, payment receipts, UTR logs, vendor payables",
    allowedActions: [
      { key: "view", label: "View Payments Ledger" },
      { key: "create", label: "Record Payment Receipt" },
      { key: "edit", label: "Edit Payment Reference" },
      { key: "export", label: "Export Financial Statement" },
      { key: "view_margins", label: "Commercial Profit Margins", isCommercial: true },
    ],
  },
  {
    key: "exceptions",
    name: "Exceptions & Disruptions",
    group: "FINANCE, REPORTS & GOVERNANCE",
    description: "Breakdowns, accidents, route deviations, cargo loss, and detention escalations",
    allowedActions: [
      { key: "view", label: "View Exceptions" },
      { key: "create", label: "File Exception" },
      { key: "edit", label: "Update Resolution" },
      { key: "close", label: "Resolve Exception" },
      { key: "export", label: "Export Incident Log" },
    ],
  },
  {
    key: "communications",
    name: "Communications Hub",
    group: "FINANCE, REPORTS & GOVERNANCE",
    description: "Client, vendor, and driver chat channels, announcements, notifications",
    allowedActions: [
      { key: "view", label: "View Messages" },
      { key: "create", label: "Broadcast Announcement" },
      { key: "export", label: "Export Chat History" },
    ],
  },
  {
    key: "reports",
    name: "Operational & Financial Reports",
    group: "FINANCE, REPORTS & GOVERNANCE",
    description: "Freight rate analytics, trip SLA reports, client volume, detention analysis",
    allowedActions: [
      { key: "view", label: "View Reports" },
      { key: "export", label: "Export Excel / PDF" },
      { key: "view_margins", label: "Commercial Margin Analytics", isCommercial: true },
    ],
  },
  {
    key: "settings",
    name: "Settings & System Parameters",
    group: "FINANCE, REPORTS & GOVERNANCE",
    description: "Charge line item masters, GST rates, default quote validities, email alerts",
    allowedActions: [
      { key: "view", label: "View System Config" },
      { key: "edit", label: "Edit Parameters" },
    ],
  },
  {
    key: "audit_logs",
    name: "Security Audit Logs",
    group: "FINANCE, REPORTS & GOVERNANCE",
    description: "Immutable log of all user logins, role changes, permission edits, approvals",
    allowedActions: [
      { key: "view", label: "View Audit Trail" },
      { key: "export", label: "Export Audit Log" },
    ],
  },
  {
    key: "superadmin",
    name: "Super Admin Management",
    group: "FINANCE, REPORTS & GOVERNANCE",
    description: "Admin user provisioning, role assignments, full security matrix enforcement",
    allowedActions: [
      { key: "view", label: "View Admin Accounts" },
      { key: "create", label: "Create Admin Account" },
      { key: "edit", label: "Configure Permissions" },
      { key: "delete", label: "Revoke Access", isDanger: true },
    ],
  },
];

export const RBACManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [permissions, setPermissions] = useState<PermissionsMatrix>({});
  const [originalPermissions, setOriginalPermissions] = useState<PermissionsMatrix>({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"ALL" | "ADMIN" | "SUPER_ADMIN">("ALL");
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("ALL");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [statusConfirmUser, setStatusConfirmUser] = useState<any | null>(null);
  const [statusReason, setStatusReason] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
  };

  // Load all admin users from server API
  const fetchAdminUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const userRes = await supabase.auth.getUser();
      const currentEmail = userRes.data.user?.email || "admin@necl.com";
      const res = await apiFetch("/admin/users", {
        headers: { "x-admin-email": currentEmail },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        if (data.users && data.users.length > 0 && !selectedUserId) {
          // Default to first regular admin if available, else first user
          const regular = data.users.find((u: any) => u.role === "ADMIN");
          const target = regular || data.users[0];
          setSelectedUserId(target.id);
          setPermissions(target.permissions || {});
          setOriginalPermissions(target.permissions || {});
        }
      }
    } catch (err) {
      console.error("Failed to load admin users:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  // Load permissions when selected user changes
  const selectUser = useCallback(async (userId: string) => {
    if (unsavedChanges) {
      const confirmSwitch = window.confirm(
        "You have unsaved permission changes. Switching users will discard unsaved modifications. Proceed?"
      );
      if (!confirmSwitch) return;
    }

    setSelectedUserId(userId);
    setUnsavedChanges(false);
    setLoadingPerms(true);

    try {
      const userRes = await supabase.auth.getUser();
      const currentEmail = userRes.data.user?.email || "admin@necl.com";
      const res = await apiFetch(`/admin/users/${userId}/permissions`, {
        headers: { "x-admin-email": currentEmail },
      });
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions || {});
        setOriginalPermissions(data.permissions || {});
      }

      // Also fetch audit logs for this user
      const auditRes = await apiFetch("/admin/audit-logs", {
        headers: { "x-admin-email": currentEmail },
      });
      if (auditRes.ok) {
        const aData = await auditRes.json();
        const userLogs = (aData.logs || []).filter((l: any) => l.entity_id === userId);
        setAuditLogs(userLogs);
      }
    } catch (err) {
      console.error("Failed to fetch permissions for user:", err);
    } finally {
      setLoadingPerms(false);
    }
  }, [unsavedChanges]);

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  const isSelectedSuperAdmin = selectedUser?.role === "SUPER_ADMIN";

  // Toggle master module ON / OFF
  const handleToggleModule = (moduleKey: string) => {
    if (isSelectedSuperAdmin) return;

    setPermissions((prev) => {
      const current = prev[moduleKey] || { enabled: false, actions: {}, scope: "ALL" };
      const nextEnabled = !current.enabled;

      const modDef = PERMISSION_MODULE_DEFINITIONS.find((m) => m.key === moduleKey);
      const updatedActions: Record<string, boolean> = {};

      if (!nextEnabled) {
        // Turning OFF: Disable all child actions
        for (const act of modDef?.allowedActions || []) {
          updatedActions[act.key] = false;
        }
      } else {
        // Turning ON: Enable view and standard safe actions
        for (const act of modDef?.allowedActions || []) {
          if (act.key === "view_margins" || act.key === "delete" || act.key === "suspend") {
            updatedActions[act.key] = false;
          } else {
            updatedActions[act.key] = true;
          }
        }
      }

      return {
        ...prev,
        [moduleKey]: {
          ...current,
          enabled: nextEnabled,
          actions: updatedActions,
        },
      };
    });
    setUnsavedChanges(true);
  };

  // Toggle specific action ON / OFF
  const handleToggleAction = (moduleKey: string, actionKey: string) => {
    if (isSelectedSuperAdmin) return;

    setPermissions((prev) => {
      const current = prev[moduleKey] || { enabled: true, actions: {}, scope: "ALL" };
      const currentActions = { ...(current.actions || {}) };
      const nextVal = !currentActions[actionKey];

      currentActions[actionKey] = nextVal;

      // If view action is turned off, child actions must be disabled
      if (actionKey === "view" && !nextVal) {
        const modDef = PERMISSION_MODULE_DEFINITIONS.find((m) => m.key === moduleKey);
        for (const act of modDef?.allowedActions || []) {
          currentActions[act.key] = false;
        }
      }

      // If an action is turned on, ensure view and module are enabled
      let isEnabled = current.enabled;
      if (nextVal) {
        isEnabled = true;
        currentActions.view = true;
      }

      return {
        ...prev,
        [moduleKey]: {
          ...current,
          enabled: isEnabled,
          actions: currentActions,
        },
      };
    });
    setUnsavedChanges(true);
  };

  // Change data scope (ALL vs ASSIGNED)
  const handleChangeScope = (moduleKey: string, scope: "ALL" | "ASSIGNED") => {
    if (isSelectedSuperAdmin) return;
    setPermissions((prev) => {
      const current = prev[moduleKey] || { enabled: true, actions: {}, scope: "ALL" };
      return {
        ...prev,
        [moduleKey]: {
          ...current,
          scope,
        },
      };
    });
    setUnsavedChanges(true);
  };

  // Save changes to backend database
  const handleSavePermissions = async () => {
    if (!selectedUserId) return;
    if (isSelectedSuperAdmin) {
      showToast("Super Admin permissions are permanently full and cannot be altered.");
      return;
    }

    setSaving(true);
    try {
      const userRes = await supabase.auth.getUser();
      const currentEmail = userRes.data.user?.email || "admin@necl.com";
      const res = await apiFetch(`/admin/users/${selectedUserId}/permissions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": currentEmail,
        },
        body: JSON.stringify({ permissions }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to persist permissions");
      }

      const data = await res.json();
      setOriginalPermissions(data.permissions);
      setPermissions(data.permissions);
      setUnsavedChanges(false);
      showToast(`✅ Permissions persisted for ${selectedUser?.name || "Admin user"} and refreshed server-side.`);
      fetchAdminUsers();
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Discard unsaved changes
  const handleCancelChanges = () => {
    setPermissions(originalPermissions);
    setUnsavedChanges(false);
    showToast("Unsaved changes discarded.");
  };

  // Apply standard Operations preset
  const handleApplyPreset = (preset: "OPERATIONS" | "FINANCE" | "ALL_OFF") => {
    if (isSelectedSuperAdmin) return;

    const newMatrix: PermissionsMatrix = {};
    for (const m of PERMISSION_MODULE_DEFINITIONS) {
      const actions: Record<string, boolean> = {};

      if (preset === "ALL_OFF") {
        for (const a of m.allowedActions) actions[a.key] = false;
        newMatrix[m.key] = { enabled: false, actions, scope: "ALL" };
      } else if (preset === "OPERATIONS") {
        const isSuperAdminOnly = ["superadmin", "audit_logs", "settings"].includes(m.key);
        const isFinance = ["payments"].includes(m.key);
        for (const a of m.allowedActions) {
          if (a.key === "view_margins" || a.key === "delete" || a.key === "suspend") {
            actions[a.key] = false;
          } else if (isSuperAdminOnly || isFinance) {
            actions[a.key] = false;
          } else {
            actions[a.key] = true;
          }
        }
        newMatrix[m.key] = {
          enabled: !isSuperAdminOnly && !isFinance,
          actions,
          scope: "ALL",
        };
      } else if (preset === "FINANCE") {
        const isFinModule = ["payments", "reports", "pricing"].includes(m.key);
        for (const a of m.allowedActions) {
          actions[a.key] = isFinModule && ["view", "export", "view_margins"].includes(a.key);
        }
        newMatrix[m.key] = {
          enabled: isFinModule,
          actions,
          scope: "ALL",
        };
      }
    }

    setPermissions(newMatrix);
    setUnsavedChanges(true);
    showToast(`Applied ${preset} preset. Click "Save Permissions" to commit changes.`);
  };

  // Toggle user active status (suspend / restore)
  const handleConfirmStatusToggle = async () => {
    if (!statusConfirmUser) return;
    const targetStatus = !statusConfirmUser.is_active;

    try {
      const userRes = await supabase.auth.getUser();
      const currentEmail = userRes.data.user?.email || "admin@necl.com";
      const res = await apiFetch(`/admin/users/${statusConfirmUser.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": currentEmail,
        },
        body: JSON.stringify({
          is_active: targetStatus,
          reason: statusReason || "Super Admin administrative action",
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Failed to update status");
      }

      showToast(`User ${statusConfirmUser.name} ${targetStatus ? "activated / restored" : "suspended / deactivated"}.`);
      setStatusConfirmUser(null);
      setStatusReason("");
      fetchAdminUsers();
    } catch (e: any) {
      showToast(`❌ Status update failed: ${e.message}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "ALL" ? true : u.role === filterRole;
    return matchSearch && matchRole;
  });

  const moduleGroups = ["ALL", "OVERVIEW & MOBILE USERS", "SOURCING, QUOTATIONS & BOOKINGS", "EXECUTION, CLEARANCE & TRACKING", "FINANCE, REPORTS & GOVERNANCE"];

  const filteredModules = PERMISSION_MODULE_DEFINITIONS.filter((m) => {
    if (activeGroupFilter === "ALL") return true;
    return m.group === activeGroupFilter;
  });

  return (
    <div className="cli-dir-wrapper">
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* Confirmation Modal for Suspend/Restore */}
      {statusConfirmUser && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
          zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#FFF", borderRadius: "12px", width: "480px", maxWidth: "90%",
            boxShadow: "0 20px 40px rgba(0,0,0,0.25)", padding: "1.75rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              {statusConfirmUser.is_active ? (
                <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>
                  <AlertTriangle size={24} />
                </div>
              ) : (
                <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
                  <CheckCircle size={24} />
                </div>
              )}
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>
                  {statusConfirmUser.is_active ? "Suspend Administrator Account" : "Restore Administrator Account"}
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#6B7280" }}>
                  {statusConfirmUser.name} ({statusConfirmUser.email})
                </p>
              </div>
            </div>

            <p style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.5, marginBottom: "1rem" }}>
              {statusConfirmUser.is_active
                ? "Suspending this account will immediately revoke all portal and API access. Direct URL navigation and API actions will return 403 Forbidden."
                : "Restoring this account will re-enable login and reinstate their assigned module permissions."}
            </p>

            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
              Mandatory Reason / Notes:
            </label>
            <textarea
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Provide reason for this status change (recorded in immutable audit log)..."
              style={{
                width: "100%", height: "80px", padding: "0.6rem", borderRadius: "6px",
                border: "1px solid #D1D5DB", fontSize: "0.85rem", marginBottom: "1.25rem",
                fontFamily: "inherit", resize: "none"
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                onClick={() => { setStatusConfirmUser(null); setStatusReason(""); }}
                style={{
                  padding: "0.6rem 1.2rem", borderRadius: "6px", border: "1px solid #D1D5DB",
                  background: "#FFF", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusToggle}
                style={{
                  padding: "0.6rem 1.2rem", borderRadius: "6px", border: "none",
                  background: statusConfirmUser.is_active ? "#EF4444" : "#10B981",
                  color: "#FFF", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem",
                  display: "flex", alignItems: "center", gap: "0.5rem"
                }}
              >
                {statusConfirmUser.is_active ? "Confirm Suspension" : "Confirm Restoration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Super Admin</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-link">Admin Staff</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Toggle-Based Permissions Matrix</span>
      </div>

      {/* Page Header */}
      <div className="page-header-row" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Toggle-Based Permission Management</h1>
          <p className="page-subtitle">
            Configure granular module access, action permissions, internal margin visibility, and data scopes per Admin user
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {unsavedChanges && (
            <button
              onClick={handleCancelChanges}
              disabled={saving}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.65rem 1rem", borderRadius: "8px", border: "1px solid #D1D5DB",
                background: "#FFF", color: "#4B5563", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem"
              }}
            >
              <RotateCcw size={15} /><span>Cancel Changes</span>
            </button>
          )}

          <button
            onClick={handleSavePermissions}
            disabled={saving || !unsavedChanges || isSelectedSuperAdmin}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.65rem 1.4rem", borderRadius: "8px", border: "none",
              background: isSelectedSuperAdmin ? "#9CA3AF" : (unsavedChanges ? "#F45325" : "#D1D5DB"),
              color: "#FFF", cursor: (saving || !unsavedChanges || isSelectedSuperAdmin) ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: "0.9rem", boxShadow: unsavedChanges ? "0 4px 12px rgba(244,83,37,0.3)" : "none",
              transition: "all 0.2s"
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? "Persisting..." : "Save Permissions"}</span>
          </button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {unsavedChanges && (
        <div style={{
          background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "8px",
          padding: "0.75rem 1.25rem", marginBottom: "1.25rem", display: "flex",
          alignItems: "center", justifyContent: "space-between", color: "#92400E"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <AlertTriangle size={18} color="#D97706" />
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
              You have unsaved permission changes for <strong>{selectedUser?.name}</strong>. Toggle changes will not become active until saved to the database.
            </span>
          </div>
          <span style={{ fontSize: "0.8rem", background: "#FDE68A", padding: "0.2rem 0.6rem", borderRadius: "4px", fontWeight: 700 }}>
            UNSAVED
          </span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Left Column: Admin User Selector */}
        <div className="white-data-table-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Users size={16} color="#F45325" />
              <span>Admin Accounts</span>
            </h3>
            <span style={{ fontSize: "0.75rem", background: "#F3F4F6", padding: "0.2rem 0.5rem", borderRadius: "999px", fontWeight: 700, color: "#4B5563" }}>
              {filteredUsers.length} Users
            </span>
          </div>

          {/* Search box */}
          <div style={{ position: "relative", marginBottom: "0.75rem" }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "10px", color: "#9CA3AF" }} />
            <input
              type="text"
              placeholder="Search admin name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "0.5rem 0.5rem 0.5rem 2.1rem", borderRadius: "6px",
                border: "1px solid #E5E7EB", fontSize: "0.825rem", fontFamily: "inherit"
              }}
            />
          </div>

          {/* Role Filter Tabs */}
          <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem", background: "#F3F4F6", padding: "0.25rem", borderRadius: "6px" }}>
            {(["ALL", "ADMIN", "SUPER_ADMIN"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                style={{
                  flex: 1, padding: "0.35rem 0.2rem", fontSize: "0.75rem", fontWeight: 600,
                  borderRadius: "4px", border: "none", cursor: "pointer",
                  background: filterRole === r ? "#FFF" : "transparent",
                  color: filterRole === r ? "#111827" : "#6B7280",
                  boxShadow: filterRole === r ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}
              >
                {r === "ALL" ? "All" : (r === "ADMIN" ? "Regular" : "Super")}
              </button>
            ))}
          </div>

          {/* User List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "580px", overflowY: "auto" }}>
            {loadingUsers ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 0.5rem" }} />
                <span style={{ fontSize: "0.85rem" }}>Loading admin staff...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#9CA3AF", fontSize: "0.85rem" }}>
                No admin accounts found matching your query.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = u.id === selectedUserId;
                const isSuper = u.role === "SUPER_ADMIN";
                const isActive = u.is_active;

                return (
                  <div
                    key={u.id}
                    onClick={() => selectUser(u.id)}
                    style={{
                      padding: "0.75rem 0.85rem", borderRadius: "8px", cursor: "pointer",
                      border: isSelected ? "2px solid #F45325" : "1px solid #E5E7EB",
                      background: isSelected ? "rgba(244,83,37,0.04)" : (isActive ? "#FFF" : "#F9FAFB"),
                      transition: "all 0.15s", opacity: isActive ? 1 : 0.65
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <strong style={{ fontSize: "0.9rem", color: isSelected ? "#F45325" : "#111827" }}>
                        {u.name}
                      </strong>
                      <span style={{
                        fontSize: "0.65rem", padding: "0.15rem 0.45rem", borderRadius: "999px", fontWeight: 700,
                        background: isSuper ? "rgba(244,83,37,0.15)" : "#E0E7FF",
                        color: isSuper ? "#F45325" : "#3730A3"
                      }}>
                        {isSuper ? "SUPER ADMIN" : "REGULAR ADMIN"}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.775rem", color: "#6B7280", marginBottom: "0.4rem" }}>
                      {u.email}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{
                        fontSize: "0.7rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem",
                        color: isActive ? "#10B981" : "#EF4444"
                      }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isActive ? "#10B981" : "#EF4444" }} />
                        {isActive ? "Active" : "Suspended"}
                      </span>

                      {isSelected && (
                        <span style={{ fontSize: "0.7rem", color: "#F45325", fontWeight: 700 }}>
                          Configuring ›
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Permission Matrix Workspace */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {selectedUser ? (
            <>
              {/* Selected User Hero Banner */}
              <div className="white-data-table-card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    background: isSelectedSuperAdmin ? "#F45325" : "#4B5563",
                    color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "1.25rem"
                  }}>
                    {selectedUser.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>
                        {selectedUser.name}
                      </h2>
                      <span style={{
                        fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: 700,
                        background: isSelectedSuperAdmin ? "#F45325" : "#4B5563", color: "#FFF"
                      }}>
                        {isSelectedSuperAdmin ? "SUPER ADMIN" : "REGULAR ADMIN"}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#6B7280" }}>
                      {selectedUser.email} • ID: {selectedUser.id.substring(0, 8)}...
                    </p>
                  </div>
                </div>

                {/* Account Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {!isSelectedSuperAdmin && (
                    <button
                      onClick={() => setStatusConfirmUser(selectedUser)}
                      style={{
                        padding: "0.5rem 0.9rem", borderRadius: "6px", fontSize: "0.825rem", fontWeight: 600,
                        border: selectedUser.is_active ? "1px solid #FCA5A5" : "1px solid #6EE7B7",
                        background: selectedUser.is_active ? "#FEF2F2" : "#ECFDF5",
                        color: selectedUser.is_active ? "#B91C1C" : "#047857",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem"
                      }}
                    >
                      {selectedUser.is_active ? <XCircle size={15} /> : <CheckCircle size={15} />}
                      <span>{selectedUser.is_active ? "Suspend Account" : "Restore Account"}</span>
                    </button>
                  )}

                  {!isSelectedSuperAdmin && (
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button
                        onClick={() => handleApplyPreset("OPERATIONS")}
                        title="Set standard Operations permissions"
                        style={{
                          padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #D1D5DB",
                          background: "#FFF", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer"
                        }}
                      >
                        Ops Preset
                      </button>
                      <button
                        onClick={() => handleApplyPreset("FINANCE")}
                        title="Set commercial Finance permissions"
                        style={{
                          padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #D1D5DB",
                          background: "#FFF", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer"
                        }}
                      >
                        Finance Preset
                      </button>
                      <button
                        onClick={() => handleApplyPreset("ALL_OFF")}
                        title="Disable all modules and actions"
                        style={{
                          padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #FCA5A5",
                          background: "#FFF", color: "#DC2626", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer"
                        }}
                      >
                        Revoke All
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Super Admin Notice */}
              {isSelectedSuperAdmin && (
                <div style={{
                  background: "rgba(244,83,37,0.06)", border: "1px solid rgba(244,83,37,0.25)",
                  borderRadius: "8px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem"
                }}>
                  <ShieldCheck size={24} color="#F45325" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#111827" }}>
                      Super Admin Full Authority Active
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#4B5563" }}>
                      This account possesses unrestricted full administrative authority across all Admin Panel modules, action controls, user management, and commercial pricing. Regular Admin toggle configurations cannot restrict Super Admin authority.
                    </p>
                  </div>
                </div>
              )}

              {/* Module Group Filter Tabs */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {moduleGroups.map((g) => (
                  <button
                    key={g}
                    onClick={() => setActiveGroupFilter(g)}
                    style={{
                      padding: "0.45rem 0.9rem", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600,
                      border: "none", cursor: "pointer",
                      background: activeGroupFilter === g ? "#111827" : "#E5E7EB",
                      color: activeGroupFilter === g ? "#FFF" : "#374151"
                    }}
                  >
                    {g === "ALL" ? "All Modules (22)" : g}
                  </button>
                ))}
              </div>

              {/* Permissions Cards Grid */}
              {loadingPerms ? (
                <div style={{ padding: "4rem", textAlign: "center", color: "#6B7280" }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 0.75rem" }} />
                  <p>Loading permissions matrix...</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {filteredModules.map((modDef) => {
                    const modConfig = permissions[modDef.key] || {
                      enabled: isSelectedSuperAdmin,
                      actions: {},
                      scope: "ALL",
                    };
                    const isModEnabled = isSelectedSuperAdmin ? true : Boolean(modConfig.enabled);
                    const currentActions = modConfig.actions || {};
                    const isViewEnabled = isSelectedSuperAdmin ? true : Boolean(currentActions.view);

                    return (
                      <div
                        key={modDef.key}
                        style={{
                          background: "#FFF", borderRadius: "10px", border: isModEnabled ? "1px solid #E5E7EB" : "1px dashed #D1D5DB",
                          padding: "1.1rem 1.25rem", boxShadow: isModEnabled ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
                          opacity: isModEnabled ? 1 : 0.6, transition: "all 0.15s"
                        }}
                      >
                        {/* Module Card Header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: isModEnabled ? "#111827" : "#6B7280" }}>
                                {modDef.name}
                              </h3>
                              <span style={{ fontSize: "0.7rem", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                [{modDef.key}]
                              </span>
                            </div>
                            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#6B7280" }}>
                              {modDef.description}
                            </p>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            {/* Data Scope dropdown */}
                            {isModEnabled && !isSelectedSuperAdmin && (
                              <select
                                value={modConfig.scope || "ALL"}
                                onChange={(e) => handleChangeScope(modDef.key, e.target.value as any)}
                                style={{
                                  padding: "0.3rem 0.6rem", borderRadius: "6px", border: "1px solid #D1D5DB",
                                  fontSize: "0.75rem", fontWeight: 600, color: "#374151", background: "#F9FAFB"
                                }}
                              >
                                <option value="ALL">Scope: All Records</option>
                                <option value="ASSIGNED">Scope: Assigned Only</option>
                              </select>
                            )}

                            {/* Master Module Toggle */}
                            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: isSelectedSuperAdmin ? "default" : "pointer" }}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isModEnabled ? "#10B981" : "#9CA3AF" }}>
                                {isModEnabled ? "MODULE ON" : "MODULE OFF"}
                              </span>
                              <input
                                type="checkbox"
                                checked={isModEnabled}
                                disabled={isSelectedSuperAdmin}
                                onChange={() => handleToggleModule(modDef.key)}
                                style={{ width: "20px", height: "20px", cursor: isSelectedSuperAdmin ? "default" : "pointer", accentColor: "#F45325" }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Child Action Toggles Grid */}
                        <div style={{
                          borderTop: "1px solid #F3F4F6", paddingTop: "0.75rem",
                          display: "flex", flexWrap: "wrap", gap: "0.6rem"
                        }}>
                          {modDef.allowedActions.map((act) => {
                            const isActChecked = isSelectedSuperAdmin ? true : Boolean(currentActions[act.key]);
                            const isActDisabled = isSelectedSuperAdmin || !isModEnabled || (act.key !== "view" && !isViewEnabled);

                            return (
                              <label
                                key={act.key}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "0.45rem",
                                  padding: "0.35rem 0.65rem", borderRadius: "6px",
                                  background: isActChecked ? (act.isCommercial ? "#FEF3C7" : (act.isDanger ? "#FEE2E2" : "#F3F4F6")) : "#F9FAFB",
                                  border: isActChecked ? (act.isCommercial ? "1px solid #FCD34D" : (act.isDanger ? "1px solid #FCA5A5" : "1px solid #E5E7EB")) : "1px solid #F3F4F6",
                                  cursor: isActDisabled ? "not-allowed" : "pointer",
                                  opacity: isActDisabled ? 0.45 : 1, transition: "all 0.15s"
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isActChecked}
                                  disabled={isActDisabled}
                                  onChange={() => handleToggleAction(modDef.key, act.key)}
                                  style={{ width: "15px", height: "15px", cursor: isActDisabled ? "not-allowed" : "pointer", accentColor: act.isCommercial ? "#D97706" : "#F45325" }}
                                />
                                <span style={{
                                  fontSize: "0.775rem", fontWeight: 600,
                                  color: isActChecked ? (act.isCommercial ? "#92400E" : (act.isDanger ? "#991B1B" : "#111827")) : "#9CA3AF"
                                }}>
                                  {act.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Security Audit History for User */}
              <div className="white-data-table-card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <FileText size={16} color="#6B7280" />
                  <span>Recent Permission Audit Trail for {selectedUser.name}</span>
                </h3>

                {auditLogs.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#9CA3AF" }}>
                    No permission modifications logged yet for this administrator.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table-standard" style={{ fontSize: "0.8rem" }}>
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Action</th>
                          <th>Performed By</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td style={{ color: "#6B7280" }}>
                              {new Date(log.timestamp).toLocaleString("en-IN")}
                            </td>
                            <td>
                              <span style={{ fontWeight: 700, color: "#F45325" }}>{log.action}</span>
                            </td>
                            <td>{log.user_role} ({log.user_id.substring(0, 8)}...)</td>
                            <td>
                              <span style={{ background: "#D1FAE5", color: "#065F46", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: 700, fontSize: "0.7rem" }}>
                                PERSISTED
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="white-data-table-card" style={{ padding: "4rem", textAlign: "center", color: "#9CA3AF" }}>
              <Users size={48} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <h3 style={{ color: "#111827" }}>No Admin Selected</h3>
              <p>Select an administrator account from the left column to configure their granular module and action permissions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// ─── 3. Commercial Analytics ──────────────────────────────────────────────────
export const CommercialAnalytics: React.FC = () => {
  const [stats, setStats] = useState({ revenue: 0, trips: 0, outstanding: 0, margin: 0 });
  const [loading, setLoading] = useState(true);
  const [topClients, setTopClients] = useState<{ name: string; revenue: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [bookingsRes, paymentsRes] = await Promise.all([
          supabase.from("bookings").select("grand_total, booking_status").eq("booking_status", "COMPLETED"),
          supabase.from("payment_records").select("amount")
        ]);
        const totalRevenue = bookingsRes.data?.reduce((s, b) => s + (b.grand_total || 0), 0) || 0;
        const totalCollected = paymentsRes.data?.reduce((s, p) => s + (p.amount || 0), 0) || 0;
        setStats({
          revenue: totalRevenue,
          trips: bookingsRes.data?.length || 0,
          outstanding: totalRevenue - totalCollected,
          margin: totalRevenue > 0 ? Math.round(((totalRevenue * 0.18) / totalRevenue) * 100) : 18
        });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const kpis = [
    { label: "Total Revenue (Completed)", value: `₹${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: "#FEF3EE", icolor: "#F45325" },
    { label: "Total Trips Completed", value: stats.trips.toString(), icon: CheckCircle, color: "#FEF3EE", icolor: "#F45325" },
    { label: "Total Outstanding", value: `₹${stats.outstanding.toLocaleString()}`, icon: IndianRupee, color: "#FEF3EE", icolor: "#F45325" },
    { label: "Avg GST Margin %", value: `${stats.margin}%`, icon: BarChart3, color: "#FEF3EE", icolor: "#F45325" },
  ];

  return (
    <div className="cli-dir-wrapper">
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Super Admin</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Commercial Analytics</span>
      </div>

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Commercial Analytics</h1>
          <p className="page-subtitle">Revenue, margin, and performance analytics (SUPER_ADMIN only)</p>
        </div>
        <button className="btn-create-gold" style={{ background: "#FFFFFF", color: "#111111" }}>
          <Download size={16} /><span>Export</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <Loader2 size={40} color="#F45325" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          <div className="client-kpi-bar">
            {kpis.map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="kpi-stat-card">
                  <div className="kpi-stat-icon" style={{ background: k.color }}><Icon size={20} color={k.icolor} /></div>
                  <div>
                    <div className="kpi-stat-label">{k.label}</div>
                    <div className="kpi-stat-value">{k.value}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="white-data-table-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111111", marginBottom: "1rem" }}>Revenue Breakdown</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              {[
                { label: "Gross Revenue", value: stats.revenue, color: "#F45325" },
                { label: "GST Component (18%)", value: Math.round(stats.revenue * 0.18 / 1.18), color: "#F45325" },
                { label: "Net Revenue (Ex-GST)", value: Math.round(stats.revenue / 1.18), color: "#F45325" },
                { label: "Total Outstanding", value: stats.outstanding, color: "#F45325" },
              ].map(item => (
                <div key={item.label} style={{ padding: "1.25rem", background: "#FFFFFF", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.5rem" }}>{item.label}</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: item.color }}>₹{item.value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ─── 4. Audit Logs ────────────────────────────────────────────────────────────
interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes?: any;
  ip_address?: string;
  created_at: string;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("ALL");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (entityFilter !== "ALL") q = q.eq("entity_type", entityFilter);
      const { data } = await q;
      if (data) setLogs(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [entityFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const entityTypes = ["ALL", "booking", "client", "vendor", "vehicle", "driver", "payment", "trip", "exception"];

  const filtered = logs.filter(l =>
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.user_name?.toLowerCase().includes(search.toLowerCase())
  );

  const actionColor = (action: string) => {
    if (action?.includes("CREATE") || action?.includes("INSERT")) return { bg: "#D1FAE5", text: "#047857" };
    if (action?.includes("UPDATE") || action?.includes("EDIT")) return { bg: "#DBEAFE", text: "#1D4ED8" };
    if (action?.includes("DELETE") || action?.includes("REMOVE")) return { bg: "#FEE2E2", text: "#B91C1C" };
    return { bg: "#F1F5F9", text: "#475569" };
  };

  return (
    <div className="cli-dir-wrapper">
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Super Admin</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Audit Logs</span>
      </div>

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Immutable record of all system actions</p>
        </div>
        <button className="btn-create-gold" style={{ background: "#FFFFFF", color: "#111111" }} onClick={fetchLogs}>
          <RefreshCw size={16} /><span>Refresh</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="client-toolbar-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-input-icon" />
          <input className="search-input-field" type="text" placeholder="Search logs..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-tab-group" style={{ flexWrap: "wrap" }}>
          {entityTypes.map(et => (
            <button key={et} onClick={() => setEntityFilter(et)}
              className={entityFilter === et ? "filter-tab-active" : "filter-tab"}
              style={{ textTransform: "capitalize" }}>
              {et.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <Loader2 size={40} color="#F45325" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="white-data-table-card" style={{ textAlign: "center", padding: "4rem", color: "#64748B" }}>
          <FileText size={48} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
          <p>No audit log entries found</p>
        </div>
      ) : (
        <div className="white-data-table-card">
          <table className="data-table-standard">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => {
                const ac = actionColor(log.action);
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: "0.82rem", color: "#64748B", whiteSpace: "nowrap" }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, color: "#111111" }}>{log.user_name || log.user_id?.substring(0, 8)}</td>
                    <td>
                      <span className="status-badge" style={{ background: ac.bg, color: ac.text }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ textTransform: "capitalize", color: "#64748B" }}>{log.entity_type}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#94A3B8" }}>
                      {log.entity_id?.substring(0, 12)}...
                    </td>
                    <td style={{ color: "#94A3B8", fontSize: "0.82rem" }}>{log.ip_address || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ─── 5. System Parameters ─────────────────────────────────────────────────────
interface Param {
  id: string;
  key: string;
  value: string;
  description: string;
  category: string;
}

export const SystemParameters: React.FC = () => {
  const [params, setParams] = useState<Param[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [category, setCategory] = useState("ALL");

  const DEFAULTS: Param[] = [
    { id: "1", key: "GST_RATE", value: "18", description: "GST rate applied to freight invoices (%)", category: "TAX" },
    { id: "2", key: "QUOTE_VALIDITY_DAYS", value: "7", description: "Default quotation validity in days", category: "OPERATIONS" },
    { id: "3", key: "DETENTION_FREE_HOURS", value: "4", description: "Free detention hours before charges apply", category: "OPERATIONS" },
    { id: "4", key: "DETENTION_RATE_PER_HOUR", value: "500", description: "Detention charge per hour (₹)", category: "PRICING" },
    { id: "5", key: "MIN_FREIGHT_AMOUNT", value: "1000", description: "Minimum freight charge per trip (₹)", category: "PRICING" },
    { id: "6", key: "CREDIT_LIMIT_DEFAULT", value: "500000", description: "Default credit limit for new clients (₹)", category: "FINANCE" },
    { id: "7", key: "PAYMENT_DUE_DAYS", value: "30", description: "Default payment due days after invoice", category: "FINANCE" },
    { id: "8", key: "OTP_EXPIRY_MINUTES", value: "5", description: "Mobile OTP expiry duration (minutes)", category: "SYSTEM" },
    { id: "9", key: "MAX_FILE_SIZE_MB", value: "10", description: "Maximum file upload size (MB)", category: "SYSTEM" },
    { id: "10", key: "SESSION_TIMEOUT_HOURS", value: "8", description: "Admin session timeout duration (hours)", category: "SYSTEM" },
  ];

  const fetchParams = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("system_parameters").select("*").order("category");
      setParams(data && data.length > 0 ? data : DEFAULTS);
    } catch {
      setParams(DEFAULTS);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchParams(); }, [fetchParams]);

  const handleSave = async (param: Param) => {
    try {
      await supabase.from("system_parameters").upsert({ ...param, value: editValue });
      setParams(ps => ps.map(p => p.id === param.id ? { ...p, value: editValue } : p));
      setToast(`${param.key} updated successfully`);
      setEditId(null);
    } catch {
      setParams(ps => ps.map(p => p.id === param.id ? { ...p, value: editValue } : p));
      setToast(`${param.key} updated (local)`);
      setEditId(null);
    }
  };

  const categories: string[] = ["ALL", ...Array.from(new Set(params.map(p => p.category))) as string[]];
  const filtered = params.filter(p => category === "ALL" || p.category === category);

  return (
    <div className="cli-dir-wrapper">
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Super Admin</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">System Parameters</span>
      </div>

      <div className="page-header-row">
        <div>
          <h1 className="page-title">System Parameters</h1>
          <p className="page-subtitle">Manage charge types, rates, and system-wide defaults</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="filter-tab-group" style={{ marginBottom: "1.5rem" }}>
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={category === c ? "filter-tab-active" : "filter-tab"}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <Loader2 size={40} color="#F45325" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div className="white-data-table-card">
          <table className="data-table-standard">
            <thead>
              <tr>
                <th>Parameter Key</th>
                <th>Category</th>
                <th>Description</th>
                <th>Current Value</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(param => (
                <tr key={param.id}>
                  <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#F45325", fontSize: "0.85rem" }}>
                    {param.key}
                  </td>
                  <td>
                    <span className="status-badge">{param.category}</span>
                  </td>
                  <td style={{ color: "#64748B", fontSize: "0.85rem" }}>{param.description}</td>
                  <td>
                    {editId === param.id ? (
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                        style={{
                          width: "100px", padding: "0.4rem 0.6rem",
                          border: "2px solid #F45325", borderRadius: "6px", fontSize: "0.9rem"
                        }}
                      />
                    ) : (
                      <span style={{ fontWeight: 700, color: "#111111" }}>{param.value}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {editId === param.id ? (
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                        <button onClick={() => handleSave(param)}
                          style={{ padding: "0.4rem 0.8rem", background: "#F45325", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                          Save
                        </button>
                        <button onClick={() => setEditId(null)}
                          style={{ padding: "0.4rem 0.8rem", background: "#FFFFFF", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditId(param.id); setEditValue(param.value); }}
                        style={{ padding: "0.4rem 0.8rem", background: "#FFFFFF", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                        <Edit2 size={13} style={{ display: "inline", marginRight: "0.3rem" }} />Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
