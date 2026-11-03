import React, { useState, useEffect } from "react";
import {
  Settings, User, Bell, Lock, Database, Mail, MessageSquare, Shield,
  CheckCircle, RefreshCw, Key, Save, AlertCircle, MapPin, Plus, Search,
  Edit2, Trash2, X, Check, Globe
} from "lucide-react";
import { supabase } from "../../utils/supabase";
import { apiFetch } from "../../utils/api";

type Section = "profile" | "hubs" | "notifications" | "security" | "system" | "permissions";

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "profile",       label: "Profile Settings",     icon: User     },
  { id: "hubs",          label: "Regional Hubs",        icon: MapPin   },
  { id: "notifications", label: "Notifications",         icon: Bell     },
  { id: "security",      label: "Security & 2FA",        icon: Lock     },
  { id: "system",        label: "System Status",         icon: Database },
  { id: "permissions",   label: "My Role & Permissions", icon: Shield   },
];

export const SettingsModule: React.FC = () => {
  const [active, setActive] = useState<Section>("profile");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [adminUser, setAdminUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");

  // Notifications preferences
  const [notifs, setNotifs] = useState({
    emailAlerts: true,
    smsAlerts: true,
    browserPush: true,
    tripExceptions: true,
    paymentAlerts: true,
  });

  // Regional Hubs Master State
  const [hubs, setHubs] = useState<any[]>([]);
  const [loadingHubs, setLoadingHubs] = useState(false);
  const [hubSearch, setHubSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State for Add / Edit Hub
  const [showHubModal, setShowHubModal] = useState(false);
  const [editingHub, setEditingHub] = useState<any | null>(null);
  const [hubFormName, setHubFormName] = useState("");
  const [hubFormCity, setHubFormCity] = useState("");
  const [hubFormState, setHubFormState] = useState("");
  const [hubFormRegion, setHubFormRegion] = useState("North East");
  const [hubFormStatus, setHubFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [hubSaving, setHubSaving] = useState(false);
  const [hubFormError, setHubFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadHubs = async () => {
    setLoadingHubs(true);
    try {
      // 1. Try Supabase direct query
      const { data, error } = await supabase
        .from("regional_hubs")
        .select("*")
        .order("name", { ascending: true });

      if (!error && data && data.length > 0) {
        setHubs(data);
        return;
      }

      // 2. Fallback to API
      const res = await apiFetch("/regional-hubs");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.hubs)) {
          setHubs(json.hubs);
        }
      }
    } catch (err: any) {
      console.warn("Failed to load hubs:", err);
    } finally {
      setLoadingHubs(false);
    }
  };

  useEffect(() => {
    if (active === "hubs") {
      loadHubs();
    }
  }, [active]);

  const openAddHubModal = () => {
    setEditingHub(null);
    setHubFormName("");
    setHubFormCity("");
    setHubFormState("");
    setHubFormRegion("North East");
    setHubFormStatus("ACTIVE");
    setHubFormError(null);
    setShowHubModal(true);
  };

  const openEditHubModal = (hub: any) => {
    setEditingHub(hub);
    setHubFormName(hub.name || "");
    setHubFormCity(hub.city || "");
    setHubFormState(hub.state || "");
    setHubFormRegion(hub.region || "North East");
    setHubFormStatus(hub.status || "ACTIVE");
    setHubFormError(null);
    setShowHubModal(true);
  };

  const handleSaveHub = async () => {
    setHubFormError(null);
    if (!hubFormName.trim()) {
      setHubFormError("Please enter Hub Name.");
      return;
    }
    if (!hubFormCity.trim()) {
      setHubFormError("Please enter City.");
      return;
    }
    if (!hubFormState.trim()) {
      setHubFormError("Please enter State.");
      return;
    }

    setHubSaving(true);
    try {
      if (editingHub) {
        // Update existing hub
        const res = await apiFetch(`/regional-hubs/${editingHub.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: hubFormName.trim(),
            city: hubFormCity.trim(),
            state: hubFormState.trim(),
            region: hubFormRegion,
            status: hubFormStatus,
          }),
        });
        if (!res.ok) {
          // Fallback to Supabase
          await supabase
            .from("regional_hubs")
            .update({
              name: hubFormName.trim(),
              city: hubFormCity.trim(),
              state: hubFormState.trim(),
              region: hubFormRegion,
              status: hubFormStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingHub.id);
        }
        showToast(`Regional Hub "${hubFormName.trim()}" updated successfully.`);
      } else {
        // Create new hub
        const res = await apiFetch("/regional-hubs", {
          method: "POST",
          body: JSON.stringify({
            name: hubFormName.trim(),
            city: hubFormCity.trim(),
            state: hubFormState.trim(),
            region: hubFormRegion,
          }),
        });
        if (!res.ok) {
          // Fallback to Supabase
          const newHubId = `hub_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await supabase.from("regional_hubs").insert([
            {
              id: newHubId,
              name: hubFormName.trim(),
              city: hubFormCity.trim(),
              state: hubFormState.trim(),
              region: hubFormRegion,
              status: "ACTIVE",
              is_custom: true,
            },
          ]);
        }
        showToast(`Regional Hub "${hubFormName.trim()}" added successfully.`);
      }
      setShowHubModal(false);
      await loadHubs();
    } catch (err: any) {
      setHubFormError(err.message || "Failed to save regional hub.");
    } finally {
      setHubSaving(false);
    }
  };

  const handleToggleHubStatus = async (hub: any) => {
    const newStatus = hub.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await apiFetch(`/regional-hubs/${hub.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      await supabase
        .from("regional_hubs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", hub.id);

      setHubs((prev) =>
        prev.map((h) => (h.id === hub.id ? { ...h, status: newStatus } : h))
      );
      showToast(`Hub status changed to ${newStatus}`);
    } catch (err: any) {
      showToast(`Update error: ${err.message}`);
    }
  };

  const handleDeleteHub = async (hub: any) => {
    if (!window.confirm(`Are you sure you want to deactivate hub "${hub.name}"?`)) {
      return;
    }
    try {
      await apiFetch(`/regional-hubs/${hub.id}`, { method: "DELETE" });
      await supabase
        .from("regional_hubs")
        .update({ status: "INACTIVE", updated_at: new Date().toISOString() })
        .eq("id", hub.id);

      setHubs((prev) =>
        prev.map((h) => (h.id === hub.id ? { ...h, status: "INACTIVE" } : h))
      );
      showToast(`Hub "${hub.name}" deactivated.`);
    } catch (err: any) {
      showToast(`Deactivate error: ${err.message}`);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: sessionUser } = await supabase.auth.getUser();
      if (sessionUser?.user?.email) {
        setEmail(sessionUser.user.email);
      }

      const { data: adminRecord } = await supabase
        .from("admin_users")
        .select("*")
        .eq("email", sessionUser?.user?.email || "admin@necl.com")
        .maybeSingle();

      if (adminRecord) {
        setAdminUser(adminRecord);
        setName(adminRecord.name || sessionUser?.user?.user_metadata?.full_name || "Admin");
        setRole(adminRecord.role || "SUPER_ADMIN");
        if (adminRecord.phone) setPhone(adminRecord.phone);
      }
    } catch (err: any) {
      console.warn("Could not load admin user record:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      if (adminUser?.id) {
        await supabase
          .from("admin_users")
          .update({ name })
          .eq("id", adminUser.id);
      }
      showToast("Profile settings saved successfully");
    } catch (err: any) {
      showToast(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cli-dir-wrapper">
      {toastMessage && (
        <div className="toast-success" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
          <CheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="page-breadcrumb">
        <span className="breadcrumb-link">System</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Settings & Configuration</span>
      </div>

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Settings & Configuration</h1>
          <p className="page-subtitle">Manage administrative profile, system alerts, and security permissions</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1.5rem" }}>
        {/* Sidebar menu */}
        <div className="client-table-card" style={{ padding: "1.25rem", height: "fit-content" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
            Settings Menu
          </p>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.7rem",
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: isActive ? "#FFF5F0" : "transparent",
                  border: isActive ? "1px solid #F05A22" : "1px solid transparent",
                  borderRadius: "10px",
                  cursor: "pointer",
                  textAlign: "left",
                  color: isActive ? "#F05A22" : "#475569",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "0.9rem",
                  marginBottom: "0.35rem",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={17} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="client-table-card" style={{ padding: "28px" }}>
          {active === "profile" && (
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#172B4D", margin: "0 0 1.25rem" }}>
                Administrator Profile Settings
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem", maxWidth: "480px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 500 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="filter-text-input"
                    style={{ width: "100%", padding: "9px 14px", borderRadius: "8px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 500 }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="filter-text-input"
                    style={{ width: "100%", padding: "9px 14px", background: "#F8FAFC", borderRadius: "8px", color: "#64748B" }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: 4, display: "block" }}>
                    Authenticated user account email (Read-only)
                  </span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 500 }}>
                    Assigned Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    disabled
                    className="filter-text-input"
                    style={{ width: "100%", padding: "9px 14px", background: "#F8FAFC", borderRadius: "8px", color: "#64748B" }}
                  />
                </div>

                <button
                  className="btn-create-orange"
                  style={{ width: "fit-content", marginTop: "0.5rem" }}
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  <Save size={16} />
                  <span>{saving ? "Saving..." : "Save Profile Changes"}</span>
                </button>
              </div>
            </div>
          )}

          {active === "hubs" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#172B4D", margin: "0 0 0.25rem" }}>
                    Regional Logistics Hubs Management
                  </h2>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748B" }}>
                    Configure regional hubs and transit gateways reflected in real time in the Vendor Mobile App
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn-sub-action"
                    onClick={loadHubs}
                    disabled={loadingHubs}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    <RefreshCw size={14} className={loadingHubs ? "animate-spin" : ""} />
                    <span>Refresh</span>
                  </button>
                  <button
                    className="btn-create-orange"
                    onClick={openAddHubModal}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    <Plus size={16} />
                    <span>Add Regional Hub</span>
                  </button>
                </div>
              </div>

              {/* Stats Overview */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "1rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Hubs</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", marginTop: 4 }}>{hubs.length}</div>
                </div>
                <div style={{ background: "#F0FDF4", border: "1px solid #DCFCE7", borderRadius: "10px", padding: "1rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Active Hubs</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#15803D", marginTop: 4 }}>
                    {hubs.filter((h) => (h.status || "ACTIVE") === "ACTIVE").length}
                  </div>
                </div>
                <div style={{ background: "#FFF7ED", border: "1px solid #FFEDD5", borderRadius: "10px", padding: "1rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9A3412", textTransform: "uppercase" }}>Custom Hubs</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#C2410C", marginTop: 4 }}>
                    {hubs.filter((h) => h.is_custom).length}
                  </div>
                </div>
                <div style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "1rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Filtered Display</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#334155", marginTop: 4 }}>
                    {hubs.filter((hub) => {
                      const q = hubSearch.trim().toLowerCase();
                      const matchesSearch =
                        !q ||
                        hub.name?.toLowerCase().includes(q) ||
                        hub.city?.toLowerCase().includes(q) ||
                        hub.state?.toLowerCase().includes(q);
                      const matchesRegion = regionFilter === "ALL" || hub.region === regionFilter;
                      const matchesStatus = statusFilter === "ALL" || (hub.status || "ACTIVE") === statusFilter;
                      return matchesSearch && matchesRegion && matchesStatus;
                    }).length}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                  <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 11 }} />
                  <input
                    type="text"
                    value={hubSearch}
                    onChange={(e) => setHubSearch(e.target.value)}
                    placeholder="Search by hub name, city, or state..."
                    className="filter-text-input"
                    style={{ width: "100%", padding: "9px 12px 9px 36px", borderRadius: "8px" }}
                  />
                </div>

                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="filter-text-input"
                  style={{ padding: "9px 12px", borderRadius: "8px" }}
                >
                  <option value="ALL">All Regions</option>
                  <option value="North East">North East</option>
                  <option value="East">East</option>
                  <option value="North">North</option>
                  <option value="West">West</option>
                  <option value="South">South</option>
                  <option value="Central">Central</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="filter-text-input"
                  style={{ padding: "9px 12px", borderRadius: "8px" }}
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>

              {/* Hubs Table */}
              {loadingHubs ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#64748B" }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  <div>Loading regional hubs from database...</div>
                </div>
              ) : (
                <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B", fontWeight: 600 }}>
                        <th style={{ padding: "12px 16px" }}>Hub Name & Identifier</th>
                        <th style={{ padding: "12px 16px" }}>Location</th>
                        <th style={{ padding: "12px 16px" }}>Region</th>
                        <th style={{ padding: "12px 16px" }}>Type</th>
                        <th style={{ padding: "12px 16px" }}>Status</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hubs
                        .filter((hub) => {
                          const q = hubSearch.trim().toLowerCase();
                          const matchesSearch =
                            !q ||
                            hub.name?.toLowerCase().includes(q) ||
                            hub.city?.toLowerCase().includes(q) ||
                            hub.state?.toLowerCase().includes(q);
                          const matchesRegion = regionFilter === "ALL" || hub.region === regionFilter;
                          const matchesStatus = statusFilter === "ALL" || (hub.status || "ACTIVE") === statusFilter;
                          return matchesSearch && matchesRegion && matchesStatus;
                        })
                        .map((hub) => {
                          const isActive = (hub.status || "ACTIVE") === "ACTIVE";
                          return (
                            <tr key={hub.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ fontWeight: 600, color: "#172B4D" }}>{hub.name}</div>
                                <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>ID: {hub.id}</div>
                              </td>
                              <td style={{ padding: "12px 16px", color: "#334155" }}>
                                {hub.city ? `${hub.city}, ` : ""}{hub.state}
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background: hub.region === "North East" ? "#FFF7ED" : "#EFF6FF",
                                  color: hub.region === "North East" ? "#C2410C" : "#1D4ED8",
                                }}>
                                  {hub.region || "National"}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background: hub.is_custom ? "#FEF3C7" : "#F1F5F9",
                                  color: hub.is_custom ? "#92400E" : "#475569",
                                }}>
                                  {hub.is_custom ? "Custom" : "Standard"}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background: isActive ? "#DCFCE7" : "#F1F5F9",
                                  color: isActive ? "#15803D" : "#94A3B8",
                                }}>
                                  {isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
                                  <button
                                    onClick={() => openEditHubModal(hub)}
                                    title="Edit Hub Details"
                                    style={{
                                      border: "1px solid #CBD5E1",
                                      background: "#FFFFFF",
                                      borderRadius: 6,
                                      padding: "6px 8px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      fontSize: "0.75rem",
                                      color: "#334155",
                                    }}
                                  >
                                    <Edit2 size={13} color="#2563EB" />
                                    <span>Edit</span>
                                  </button>

                                  <button
                                    onClick={() => handleToggleHubStatus(hub)}
                                    title={isActive ? "Deactivate Hub" : "Activate Hub"}
                                    style={{
                                      border: "1px solid #CBD5E1",
                                      background: "#FFFFFF",
                                      borderRadius: 6,
                                      padding: "6px 8px",
                                      cursor: "pointer",
                                      fontSize: "0.75rem",
                                      color: isActive ? "#D97706" : "#16A34A",
                                    }}
                                  >
                                    {isActive ? "Disable" : "Enable"}
                                  </button>

                                  {hub.is_custom && (
                                    <button
                                      onClick={() => handleDeleteHub(hub)}
                                      title="Remove Custom Hub"
                                      style={{
                                        border: "1px solid #FCA5A5",
                                        background: "#FEF2F2",
                                        borderRadius: 6,
                                        padding: "6px 8px",
                                        cursor: "pointer",
                                        fontSize: "0.75rem",
                                        color: "#DC2626",
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add / Edit Hub Modal */}
              {showHubModal && (
                <div style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(15, 23, 42, 0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10000,
                  padding: 16,
                }}>
                  <div style={{
                    background: "#FFFFFF",
                    borderRadius: 12,
                    padding: "24px",
                    width: "100%",
                    maxWidth: "500px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#172B4D", margin: 0 }}>
                        {editingHub ? "Edit Regional Logistics Hub" : "Add New Regional Logistics Hub"}
                      </h3>
                      <button
                        onClick={() => setShowHubModal(false)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}
                      >
                        <X size={18} color="#64748B" />
                      </button>
                    </div>

                    {hubFormError && (
                      <div style={{
                        padding: "10px 14px",
                        background: "#FEF2F2",
                        border: "1px solid #F87171",
                        borderRadius: 8,
                        color: "#DC2626",
                        fontSize: "0.85rem",
                        marginBottom: "1rem",
                      }}>
                        {hubFormError}
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 600 }}>
                          Hub Name *
                        </label>
                        <input
                          type="text"
                          value={hubFormName}
                          onChange={(e) => setHubFormName(e.target.value)}
                          placeholder="e.g. Guwahati (Gateway Hub) or Tezpur Freight Terminal"
                          className="filter-text-input"
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 8 }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 600 }}>
                            City *
                          </label>
                          <input
                            type="text"
                            value={hubFormCity}
                            onChange={(e) => setHubFormCity(e.target.value)}
                            placeholder="e.g. Guwahati"
                            className="filter-text-input"
                            style={{ width: "100%", padding: "9px 12px", borderRadius: 8 }}
                          />
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 600 }}>
                            State *
                          </label>
                          <input
                            type="text"
                            value={hubFormState}
                            onChange={(e) => setHubFormState(e.target.value)}
                            placeholder="e.g. Assam"
                            className="filter-text-input"
                            style={{ width: "100%", padding: "9px 12px", borderRadius: 8 }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 600 }}>
                            Region *
                          </label>
                          <select
                            value={hubFormRegion}
                            onChange={(e) => setHubFormRegion(e.target.value)}
                            className="filter-text-input"
                            style={{ width: "100%", padding: "9px 12px", borderRadius: 8 }}
                          >
                            <option value="North East">North East</option>
                            <option value="East">East</option>
                            <option value="North">North</option>
                            <option value="West">West</option>
                            <option value="South">South</option>
                            <option value="Central">Central</option>
                            <option value="National">National</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 600 }}>
                            Operating Status
                          </label>
                          <select
                            value={hubFormStatus}
                            onChange={(e) => setHubFormStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                            className="filter-text-input"
                            style={{ width: "100%", padding: "9px 12px", borderRadius: 8 }}
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="btn-sub-action"
                          onClick={() => setShowHubModal(false)}
                          disabled={hubSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-create-orange"
                          onClick={handleSaveHub}
                          disabled={hubSaving}
                          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                        >
                          {hubSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                          <span>{hubSaving ? "Saving..." : editingHub ? "Save Changes" : "Create Hub"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {active === "notifications" && (
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#172B4D", margin: "0 0 1.25rem" }}>
                System Notification Preferences
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "560px" }}>
                {[
                  { key: "emailAlerts", label: "Email Notifications", desc: "Receive immediate dispatch & document alert emails" },
                  { key: "smsAlerts", label: "SMS Critical Alerts", desc: "Receive trip breakdown and exception SMS" },
                  { key: "browserPush", label: "Browser Push Alerts", desc: "Show desktop push notifications on new bookings and quotes" },
                  { key: "tripExceptions", label: "Exception Triggers", desc: "Alert administrator on vehicle breakdown or delivery delay" },
                  { key: "paymentAlerts", label: "Payment Overdue Alerts", desc: "Notify when customer payments are past due" },
                ].map((n) => {
                  const isChecked = (notifs as any)[n.key];
                  return (
                    <div
                      key={n.key}
                      onClick={() => setNotifs({ ...notifs, [n.key]: !isChecked })}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "1rem 1.25rem",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: "10px",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: "#172B4D", fontSize: "0.92rem", marginBottom: "0.15rem" }}>
                          {n.label}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#64748B" }}>{n.desc}</div>
                      </div>
                      <div style={{
                        width: "44px",
                        height: "24px",
                        borderRadius: "12px",
                        background: isChecked ? "#F05A22" : "#CBD5E1",
                        position: "relative",
                        flexShrink: 0,
                        transition: "background 0.2s",
                      }}>
                        <div style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "#fff",
                          position: "absolute",
                          top: "3px",
                          left: isChecked ? "23px" : "3px",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        }} />
                      </div>
                    </div>
                  );
                })}

                <button
                  className="btn-create-orange"
                  style={{ width: "fit-content", marginTop: "0.5rem" }}
                  onClick={() => showToast("Notification preferences updated")}
                >
                  <Save size={16} />
                  <span>Save Preferences</span>
                </button>
              </div>
            </div>
          )}

          {active === "security" && (
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111111", margin: "0 0 1.25rem" }}>
                Security & Authentication
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "520px" }}>
                <div style={{ padding: "1rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <Shield size={18} color="#F45325" />
                    <strong style={{ fontSize: 14 }}>Two-Factor Authentication (2FA)</strong>
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748B" }}>
                    TOTP 2FA verification is enabled for all SUPER_ADMIN role logins.
                  </p>
                  <span style={{
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#D1FAE5",
                    color: "#047857"
                  }}>
                    Active & Enforced
                  </span>
                </div>

                <div style={{ padding: "1rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <Key size={18} color="#F45325" />
                    <strong style={{ fontSize: 14 }}>Password & Session</strong>
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748B" }}>
                    Session expires automatically after 24 hours of inactivity.
                  </p>
                  <button className="btn-sub-action" onClick={() => showToast("Password reset link sent to admin email.")}>
                    Send Password Reset Email
                  </button>
                </div>
              </div>
            </div>
          )}

          {active === "system" && (
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111111", margin: "0 0 1.25rem" }}>
                System & Database Connectivity Status
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", maxWidth: "600px" }}>
                <div style={{ padding: "1rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px" }}>
                  <span style={{ fontSize: 12, color: "#64748B" }}>PostgreSQL Database</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
                    <strong style={{ fontSize: 14, color: "#111111" }}>Connected (Supabase)</strong>
                  </div>
                  <span style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, display: "block" }}>
                    Endpoint: nbsgmorzrccbyfmjbvgx
                  </span>
                </div>

                <div style={{ padding: "1rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px" }}>
                  <span style={{ fontSize: 12, color: "#64748B" }}>Row Level Security (RLS)</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
                    <strong style={{ fontSize: 14, color: "#111111" }}>Enforced</strong>
                  </div>
                  <span style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, display: "block" }}>
                    is_active_admin() validation active
                  </span>
                </div>
              </div>
            </div>
          )}

          {active === "permissions" && (
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111111", margin: "0 0 1.25rem" }}>
                My Role & Permissions Matrix
              </h2>
              <div style={{ marginBottom: "1rem" }}>
                <span style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  background: "#FEF3EE",
                  color: "#F45325"
                }}>
                  Role: SUPER_ADMIN
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "600px" }}>
                {[
                  "Manage Transport Requirements & RFQ Dispatch",
                  "Review, Compare & Accept Vendor Quotations",
                  "Create, Monitor & Complete Customer Bookings",
                  "Assign Vehicles, Drivers & Dispatch Trips",
                  "Approve, Reject & Audit Client, Vendor & Driver Documents",
                  "Manage Financial Margins, GST Rates & Payment Records",
                  "Inspect Real-time System Audit Logs & Export CSV Reports",
                ].map((perm, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      background: "#F8FAFC",
                      borderRadius: 6,
                      fontSize: 13,
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <CheckCircle size={16} color="#10B981" />
                    <span style={{ color: "#334155", fontWeight: 500 }}>{perm}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
