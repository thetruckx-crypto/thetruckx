import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3, Download, Calendar, Filter, FileText, TrendingUp, Truck,
  IndianRupee, AlertTriangle, RefreshCw, CheckCircle, Clock, Shield,
  ArrowUpDown, Users
} from "lucide-react";
import { supabase } from "../../utils/supabase";

interface ReportDef {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
}

const REPORTS: ReportDef[] = [
  { id: "revenue",    name: "Revenue & Billing",      description: "Booking amounts, margins, and invoice breakdown",    icon: TrendingUp   },
  { id: "trips",      name: "Trip Operations",        description: "Assigned trips, delivery status, and freight rates", icon: Truck        },
  { id: "clients",    name: "Client Accounts",        description: "Registered clients, bookings count, and activity",   icon: Users        },
  { id: "vendors",    name: "Vendor Fleets",          description: "Approved transport vendors and vehicle assignments", icon: BarChart3    },
  { id: "vehicles",   name: "Vehicle Utilization",    description: "Registered vehicle inventory and active trips",      icon: Truck        },
  { id: "audit_logs", name: "System Audit Logs",      description: "Real administrative access and modification records", icon: Shield       },
];

export const ReportsModule: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<string>("revenue");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedReport === "revenue") {
        let query = supabase
          .from("client_quotes")
          .select("id, requirement_id, vendor_base_cost, admin_margin, gst_amount, total_client_amount, status, created_at")
          .order("created_at", { ascending: false });

        if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00.000Z`);
        if (toDate) query = query.lte("created_at", `${toDate}T23:59:59.999Z`);

        const { data, error } = await query;
        if (error) throw error;
        setRecords(data || []);
      } else if (selectedReport === "trips") {
        let query = supabase
          .from("trips")
          .select(`
            id,
            booking_id,
            vendor_rate,
            trip_status,
            started_at,
            completed_at,
            created_at,
            vehicles(registration_number, vehicle_type),
            drivers(full_name, mobile),
            vendor_companies(vendor_name)
          `)
          .order("created_at", { ascending: false });

        if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00.000Z`);
        if (toDate) query = query.lte("created_at", `${toDate}T23:59:59.999Z`);

        const { data, error } = await query;
        if (error) throw error;
        setRecords(data || []);
      } else if (selectedReport === "clients") {
        let query = supabase
          .from("client_companies")
          .select("id, company_name, gstin, pan, city, status, created_at")
          .order("created_at", { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        setRecords(data || []);
      } else if (selectedReport === "vendors") {
        let query = supabase
          .from("vendor_companies")
          .select("id, vendor_name, gstin, pan, status, onboarding_source, created_at")
          .order("created_at", { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        setRecords(data || []);
      } else if (selectedReport === "vehicles") {
        let query = supabase
          .from("vehicles")
          .select("id, registration_number, vehicle_type, rc_number, status, created_at, vendor_vehicle_links(vendor_companies(vendor_name))")
          .order("created_at", { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        setRecords(data || []);
      } else if (selectedReport === "audit_logs") {
        let query = supabase
          .from("audit_logs")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(100);

        if (fromDate) query = query.gte("timestamp", `${fromDate}T00:00:00.000Z`);
        if (toDate) query = query.lte("timestamp", `${toDate}T23:59:59.999Z`);

        const { data, error } = await query;
        if (error) throw error;
        setRecords(data || []);
      }
    } catch (err: any) {
      console.error("Report generation error:", err);
      showToast(`Error: ${err.message}`);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedReport, fromDate, toDate]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  const handleExportCSV = () => {
    if (records.length === 0) {
      showToast("No records available to export");
      return;
    }

    let csvContent = "";
    if (selectedReport === "revenue") {
      const headers = ["Quote ID", "Requirement ID", "Vendor Base Cost", "Admin Margin", "GST 18%", "Total Amount", "Status", "Created At"];
      const rows = records.map(r => [
        r.id,
        r.requirement_id,
        r.vendor_base_cost,
        r.admin_margin,
        r.gst_amount,
        r.total_client_amount,
        r.status,
        new Date(r.created_at).toLocaleDateString()
      ]);
      csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    } else if (selectedReport === "trips") {
      const headers = ["Trip ID", "Booking ID", "Vehicle", "Driver", "Vendor", "Rate", "Status", "Created At"];
      const rows = records.map(r => [
        `TRP-${r.id.substring(0, 8)}`,
        r.booking_id,
        `"${r.vehicles?.registration_number || r.vehicles?.vehicle_number || "Unassigned"}"`,
        `"${r.drivers?.full_name || "Unassigned"}"`,
        `"${r.vendor_companies?.vendor_name || "Vendor"}"`,
        r.vendor_rate,
        r.trip_status,
        new Date(r.created_at).toLocaleDateString()
      ]);
      csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    } else if (selectedReport === "clients") {
      const headers = ["Client ID", "Company Name", "GSTIN", "PAN", "City", "Status", "Registered On"];
      const rows = records.map(r => [
        r.id,
        `"${r.company_name}"`,
        r.gstin || "—",
        r.pan || "—",
        r.city || "—",
        r.status,
        new Date(r.created_at).toLocaleDateString()
      ]);
      csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    } else if (selectedReport === "vendors") {
      const headers = ["Vendor ID", "Vendor Name", "GSTIN", "PAN", "Status", "Onboarding Source", "Registered On"];
      const rows = records.map(r => [
        r.id,
        `"${r.vendor_name}"`,
        r.gstin || "—",
        r.pan || "—",
        r.status,
        r.onboarding_source || "PORTAL",
        new Date(r.created_at).toLocaleDateString()
      ]);
      csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    } else if (selectedReport === "vehicles") {
      const headers = ["Vehicle ID", "Registration Number", "Type", "RC Number", "Vendor", "Status", "Registered On"];
      const rows = records.map(r => {
        const vendorName = r.vendor_vehicle_links?.[0]?.vendor_companies?.vendor_name || r.vendor_companies?.vendor_name || "—";
        return [
          r.id,
          r.registration_number || r.vehicle_number || "—",
          r.vehicle_type,
          r.rc_number || "—",
          `"${vendorName}"`,
          r.status,
          new Date(r.created_at).toLocaleDateString()
        ];
      });
      csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    } else {
      const headers = ["ID", "Role", "Action", "Entity Type", "Entity ID", "IP Address", "Timestamp"];
      const rows = records.map(r => [
        r.id,
        r.user_role,
        r.action,
        r.entity_type,
        r.entity_id,
        r.ip_address || "—",
        new Date(r.timestamp).toISOString()
      ]);
      csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    }

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NECL_${selectedReport}_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Exported report records to CSV successfully.");
  };

  const totals = useMemo(() => {
    if (selectedReport === "revenue") {
      const totalAmount = records.reduce((acc, r) => acc + Number(r.total_client_amount || 0), 0);
      const totalMargin = records.reduce((acc, r) => acc + Number(r.admin_margin || 0), 0);
      return { total: records.length, metricLabel: "Total Billed", metricValue: `₹${totalAmount.toLocaleString("en-IN")}`, subMetric: `₹${totalMargin.toLocaleString("en-IN")} Margin` };
    }
    if (selectedReport === "trips") {
      const completed = records.filter(r => r.trip_status === "COMPLETED" || r.trip_status === "DELIVERED").length;
      return { total: records.length, metricLabel: "Delivered Trips", metricValue: `${completed} / ${records.length}`, subMetric: `${records.length - completed} In Transit` };
    }
    return { total: records.length, metricLabel: "Total Records", metricValue: records.length.toString(), subMetric: "Verified DB Records" };
  }, [records, selectedReport]);

  return (
    <div className="cli-dir-wrapper">
      {/* Toast */}
      {toastMessage && (
        <div className="toast-success" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
          <CheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Analytics</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Reports & Activity</span>
      </div>

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Reports & Business Intelligence</h1>
          <p className="page-subtitle">Generate, inspect, and export verified records from the database</p>
        </div>
        <button className="btn-create-orange" onClick={handleExportCSV} disabled={records.length === 0}>
          <Download size={16} />
          <span>Export to CSV</span>
        </button>
      </div>

      {/* Date range filter */}
      <div className="filters-bar-card" style={{ marginBottom: "1.5rem", padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap", width: "100%" }}>
          <div style={{ flex: 1, minWidth: "180px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 500 }}>
              <Calendar size={13} style={{ display: "inline", marginRight: "0.3rem" }} />
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="filter-text-input"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
            />
          </div>

          <div style={{ flex: 1, minWidth: "180px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#64748B", marginBottom: "0.4rem", fontWeight: 500 }}>
              <Calendar size={13} style={{ display: "inline", marginRight: "0.3rem" }} />
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="filter-text-input"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
            />
          </div>

          <button className="btn-action-primary" onClick={generateReport} disabled={loading}>
            <Filter size={15} />
            <span>{loading ? "Generating..." : "Apply Filter"}</span>
          </button>

          {(fromDate || toDate) && (
            <button
              className="btn-action-outline"
              onClick={() => { setFromDate(""); setToDate(""); }}
            >
              Reset Dates
            </button>
          )}
        </div>
      </div>

      {/* Report Types Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {REPORTS.map(r => {
          const Icon = r.icon;
          const active = selectedReport === r.id;
          return (
            <div
              key={r.id}
              onClick={() => setSelectedReport(r.id)}
              className="client-table-card"
              style={{
                cursor: "pointer",
                padding: "16px",
                border: active ? "2px solid #F05A22" : "1px solid #E2E8F0",
                transition: "all 0.15s",
                boxShadow: active ? "0 0 0 3px rgba(240, 90, 34, 0.15)" : undefined,
              }}
            >
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div style={{ padding: "0.65rem", background: active ? "#FFF5F0" : "#F8FAFC", borderRadius: "10px", flexShrink: 0 }}>
                  <Icon size={22} color={active ? "#F05A22" : "#64748B"} />
                </div>
                <div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#172B4D", margin: "0 0 0.2rem" }}>{r.name}</h3>
                  <p style={{ fontSize: "0.82rem", color: "#64748B", margin: 0, lineHeight: 1.4 }}>{r.description}</p>
                </div>
              </div>
              <button
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  background: active ? "#F05A22" : "#F8FAFC",
                  color: active ? "#FFFFFF" : "#334155",
                  border: active ? "none" : "1px solid #E2E8F0",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {active ? "Active Report" : "View Report"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Report Data Preview & Table */}
      <div className="client-table-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#172B4D", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={18} color="#F05A22" />
              <span>{REPORTS.find(r => r.id === selectedReport)?.name} Records ({records.length})</span>
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>
              {totals.metricLabel}: <strong style={{ color: "#F05A22" }}>{totals.metricValue}</strong> • {totals.subMetric}
            </p>
          </div>
          <button onClick={generateReport} className="btn-action-outline">
            <RefreshCw size={14} className={loading ? "spin-animation" : ""} />
            <span>Refresh Data</span>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}>
            <RefreshCw size={24} color="#F45325" className="spin-animation" />
            <p style={{ marginTop: 12 }}>Querying database records...</p>
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}>
            <BarChart3 size={40} color="#94A3B8" style={{ marginBottom: 10 }} />
            <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#111111" }}>No database records found</p>
            <p style={{ margin: 0, fontSize: 13 }}>No records matched the selected report and date filter.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="client-table" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  {selectedReport === "revenue" && (
                    <>
                      <th>Quote ID</th>
                      <th>Requirement</th>
                      <th>Vendor Base Cost</th>
                      <th>Admin Margin</th>
                      <th>GST (18%)</th>
                      <th>Total Client Amount</th>
                      <th>Status</th>
                      <th>Created</th>
                    </>
                  )}
                  {selectedReport === "trips" && (
                    <>
                      <th>Trip Reference</th>
                      <th>Vehicle</th>
                      <th>Driver</th>
                      <th>Vendor Partner</th>
                      <th>Freight Rate</th>
                      <th>Status</th>
                      <th>Created</th>
                    </>
                  )}
                  {selectedReport === "clients" && (
                    <>
                      <th>Company Name</th>
                      <th>GSTIN</th>
                      <th>PAN</th>
                      <th>City</th>
                      <th>Status</th>
                      <th>Created</th>
                    </>
                  )}
                  {selectedReport === "vendors" && (
                    <>
                      <th>Vendor Name</th>
                      <th>GSTIN</th>
                      <th>PAN</th>
                      <th>Status</th>
                      <th>Onboarding</th>
                      <th>Created</th>
                    </>
                  )}
                  {selectedReport === "vehicles" && (
                    <>
                      <th>Registration Number</th>
                      <th>Vehicle Type</th>
                      <th>RC Number</th>
                      <th>Vendor Partner</th>
                      <th>Status</th>
                      <th>Created</th>
                    </>
                  )}
                  {selectedReport === "audit_logs" && (
                    <>
                      <th>User Role</th>
                      <th>Action</th>
                      <th>Entity Type</th>
                      <th>Entity ID</th>
                      <th>IP Address</th>
                      <th>Timestamp</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id || i} className="client-row">
                    {selectedReport === "revenue" && (
                      <>
                        <td style={{ fontWeight: 600 }}>{r.id.substring(0, 8)}...</td>
                        <td>{r.requirement_id}</td>
                        <td>₹{Number(r.vendor_base_cost).toLocaleString("en-IN")}</td>
                        <td>₹{Number(r.admin_margin).toLocaleString("en-IN")}</td>
                        <td>₹{Number(r.gst_amount).toLocaleString("en-IN")}</td>
                        <td style={{ fontWeight: 700, color: "#F45325" }}>₹{Number(r.total_client_amount).toLocaleString("en-IN")}</td>
                        <td><span className="status-badge" style={{ background: "#FEF3EE", color: "#F45325" }}>{r.status}</span></td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      </>
                    )}
                    {selectedReport === "trips" && (
                      <>
                        <td style={{ fontWeight: 700 }}>TRP-{r.id.substring(0, 8)}</td>
                        <td><strong>{r.vehicles?.registration_number || r.vehicles?.vehicle_number || "Unassigned"}</strong></td>
                        <td>{r.drivers?.full_name || "Unassigned"}</td>
                        <td>{r.vendor_companies?.vendor_name || "Vendor"}</td>
                        <td>₹{Number(r.vendor_rate || 0).toLocaleString("en-IN")}</td>
                        <td><span className="status-badge" style={{ background: "#FEF3EE", color: "#F45325" }}>{r.trip_status}</span></td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      </>
                    )}
                    {selectedReport === "clients" && (
                      <>
                        <td style={{ fontWeight: 700 }}>{r.company_name}</td>
                        <td>{r.gstin || "—"}</td>
                        <td>{r.pan || "—"}</td>
                        <td>{r.city || "—"}</td>
                        <td><span className="status-badge" style={{ background: "#FEF3EE", color: "#F45325" }}>{r.status}</span></td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      </>
                    )}
                    {selectedReport === "vendors" && (
                      <>
                        <td style={{ fontWeight: 700 }}>{r.vendor_name}</td>
                        <td>{r.gstin || "—"}</td>
                        <td>{r.pan || "—"}</td>
                        <td><span className="status-badge" style={{ background: "#FEF3EE", color: "#F45325" }}>{r.status}</span></td>
                        <td>{r.onboarding_source || "PORTAL"}</td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      </>
                    )}
                    {selectedReport === "vehicles" && (
                      <>
                        <td style={{ fontWeight: 700 }}>{r.registration_number || r.vehicle_number}</td>
                        <td>{r.vehicle_type}</td>
                        <td>{r.rc_number || "—"}</td>
                        <td>{r.vendor_vehicle_links?.[0]?.vendor_companies?.vendor_name || r.vendor_companies?.vendor_name || "—"}</td>
                        <td><span className="status-badge" style={{ background: "#FEF3EE", color: "#F45325" }}>{r.status}</span></td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      </>
                    )}
                    {selectedReport === "audit_logs" && (
                      <>
                        <td style={{ fontWeight: 700 }}>{r.user_role}</td>
                        <td><code>{r.action}</code></td>
                        <td>{r.entity_type}</td>
                        <td>{r.entity_id ? r.entity_id.substring(0, 8) : "—"}</td>
                        <td>{r.ip_address || "—"}</td>
                        <td>{new Date(r.timestamp).toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
