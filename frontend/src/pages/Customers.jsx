import { useState, useEffect, useCallback } from "react";
import { usersAPI, ticketsAPI } from "../api/services";
import { useToast } from "../context/ToastContext";
import { Search, Users, Mail, RefreshCw, X, CheckCircle, Clock } from "lucide-react";
import { SkeletonTableRow } from "../components/SkeletonCard";

export default function Customers() {
  const toast = useToast();

  const [customers, setCustomers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerTickets, setCustomerTickets] = useState([]);
  const [loadingDrawer, setLoadingDrawer] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, ticketsRes] = await Promise.all([
        usersAPI.list(),
        ticketsAPI.list({ limit: 100 })
      ]);

      const users = usersRes.data || [];
      const allTickets = ticketsRes.data.tickets || ticketsRes.data || [];
      setTickets(allTickets);

      // Filter role = customer and attach ticket count + real created_at date
      const filtered = users
        .filter(u => u.role === "customer")
        .map((u) => {
          const uTickets = allTickets.filter(t => t.user_id === u.id);
          return {
            ...u,
            ticketsCount: uTickets.length,
            joinedAt: formatDate(u.created_at)
          };
        });

      setCustomers(filtered);
    } catch {
      toast.error("Failed to load customer list");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setLoadingDrawer(true);
    try {
      const custTickets = tickets.filter(t => t.user_id === cust.id);
      setCustomerTickets(custTickets);
    } catch {
      setCustomerTickets([]);
    } finally {
      setLoadingDrawer(false);
    }
  };

  const filtered = customers.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px", minHeight: "100%", background: "#F8FAFC", position: "relative" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px", display: "flex", alignItems: "center", gap: "10px" }}>
            <Users size={26} color="#6366F1" /> Customers
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748B" }}>
            View customer directories, ticket history, and account details.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ position: "relative", width: "260px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customers..."
              style={{
                width: "100%", padding: "9px 12px 9px 36px", fontSize: "13.5px",
                border: "1.5px solid #E2E8F0", borderRadius: "10px", outline: "none",
                background: "#fff", color: "#0F172A"
              }}
            />
          </div>

          <button
            onClick={loadData}
            style={{
              padding: "9px 14px", border: "1.5px solid #E2E8F0", borderRadius: "10px", background: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main layout container */}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", position: "relative" }}>

        {/* Table of customers */}
        <div style={{ flex: 1, background: "#fff", borderRadius: "14px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(15,23,42,0.03)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>Name</th>
                <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>Tickets Opened</th>
                <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map(i => <SkeletonTableRow key={i} cols={3} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: "48px 20px", textAlign: "center", color: "#94A3B8" }}>
                    No customer accounts found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    style={{
                      borderBottom: "1px solid #F1F5F9", cursor: "pointer", transition: "background 0.15s",
                      background: selectedCustomer?.id === c.id ? "#F1F5F9" : "transparent"
                    }}
                    onMouseEnter={e => { if (selectedCustomer?.id !== c.id) e.currentTarget.style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { if (selectedCustomer?.id !== c.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                          width: "32px", height: "32px", borderRadius: "50%",
                          background: `hsl(${(c.name || "U").charCodeAt(0) * 17}, 60%, 65%)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontWeight: "800", fontSize: "13px"
                        }}>
                          {(c.name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: "14.5px", fontWeight: "700", color: "#0F172A" }}>{c.name}</div>
                          <div style={{ fontSize: "12px", color: "#64748B", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Mail size={11} /> {c.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "16px 20px", fontSize: "13.5px", fontWeight: "700", color: "#0F172A" }}>
                      {c.ticketsCount}
                    </td>

                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#64748B" }}>
                      {c.joinedAt}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Customer Drawer Panel */}
        {selectedCustomer && (
          <div style={{
            width: "380px", background: "#fff", borderRadius: "14px", border: "1px solid #E2E8F0",
            boxShadow: "0 10px 25px -5px rgba(15,23,42,0.08)", padding: "24px", display: "flex",
            flexDirection: "column", gap: "20px", position: "sticky", top: "24px"
          }}>
            {/* Header / Close */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "50%",
                  background: `hsl(${(selectedCustomer.name || "U").charCodeAt(0) * 17}, 60%, 65%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: "800", fontSize: "18px"
                }}>
                  {(selectedCustomer.name || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F172A" }}>{selectedCustomer.name}</h3>
                  <span style={{ fontSize: "12.5px", color: "#64748B" }}>{selectedCustomer.email}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile properties */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#F8FAFC", padding: "14px", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ color: "#64748B" }}>Member Since</span>
                <span style={{ fontWeight: "600", color: "#334155" }}>{selectedCustomer.joinedAt}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ color: "#64748B" }}>Total Tickets</span>
                <span style={{ fontWeight: "700", color: "#0F172A" }}>{selectedCustomer.ticketsCount}</span>
              </div>
            </div>

            {/* Previous Tickets Section */}
            <div>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "800", color: "#64748B", textTransform: "uppercase" }}>
                Previous Tickets ({customerTickets.length})
              </h4>

              {loadingDrawer ? (
                <div style={{ fontSize: "13px", color: "#64748B" }}>Loading tickets...</div>
              ) : customerTickets.length === 0 ? (
                <div style={{ fontSize: "12.8px", color: "#94A3B8", fontStyle: "italic" }}>
                  No historical tickets found for this account.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                  {customerTickets.map(t => (
                    <a
                      key={t.id}
                      href={`/tickets/${t.id}`}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: "8px",
                        textDecoration: "none", transition: "all 0.15s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#6366F1"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "#E2E8F0"}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: "10px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.title}
                        </div>
                        <span style={{ fontSize: "11px", color: "#94A3B8" }}>Ticket #{t.id}</span>
                      </div>
                      <span style={{
                        fontSize: "10.5px", fontWeight: "700", padding: "2px 6.5px", borderRadius: "4px",
                        background: t.status === "resolved" ? "#ECFDF5" : "#FFFBEB",
                        color: t.status === "resolved" ? "#10B981" : "#F59E0B"
                      }}>{t.status}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Interactions list */}
            <div>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "800", color: "#64748B", textTransform: "uppercase" }}>
                Recent Interactions
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "10px", fontSize: "12.5px" }}>
                  <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: "#334155" }}>Profile verified</strong>
                    <div style={{ color: "#94A3B8", fontSize: "11px" }}>Auto security whitelist • 2 weeks ago</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", fontSize: "12.5px" }}>
                  <Clock size={14} color="#6366F1" style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: "#334155" }}>Logged onto portal</strong>
                    <div style={{ color: "#94A3B8", fontSize: "11px" }}>IP verified: 198.162.1.204 • Yesterday</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
