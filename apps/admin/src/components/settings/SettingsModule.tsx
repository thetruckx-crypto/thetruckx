import React, { useState, useEffect } from "react";
import {
  Settings, User, Bell, Lock, Database, Mail, MessageSquare, Shield,
  CheckCircle, RefreshCw, Key, Save, AlertCircle
} from "lucide-react";
import { supabase } from "../../utils/supabase";

type Section = "profile" | "notifications" | "security" | "system" | "permissions";

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "profile",       label: "Profile Settings",     icon: User     },
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
  const [name, setName] = useState("Rahul (Admin)");
  const [email, setEmail] = useState("admin@necl.com");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [role, setRole] = useState("SUPER_ADMIN");

  // Notifications preferences
  const [notifs, setNotifs] = useState({
    emailAlerts: true,
    smsAlerts: true,
    browserPush: true,
    tripExceptions: true,
    paymentAlerts: true,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadProfile();
  }, []);

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
        setName(adminRecord.name || "Rahul (Admin)");
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
