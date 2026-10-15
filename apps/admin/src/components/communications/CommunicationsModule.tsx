import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Search, Send, Paperclip, RefreshCw,
  Loader2, User, Truck, Building2, Circle
} from "lucide-react";
import { supabase } from "../../utils/supabase";

type ThreadType = "CLIENT" | "VENDOR" | "DRIVER";

interface Thread {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_type: ThreadType;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: "ADMIN" | "CLIENT" | "VENDOR" | "DRIVER";
  content: string;
  created_at: string;
  read_at?: string;
}

const TAB_ICONS: Record<ThreadType, React.ReactNode> = {
  CLIENT: <User size={15} />,
  VENDOR: <Building2 size={15} />,
  DRIVER: <Truck size={15} />,
};

export const CommunicationsModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ThreadType>("CLIENT");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_threads")
        .select(`
          id,
          thread_type,
          booking_id,
          requirement_id,
          client_id,
          vendor_id,
          driver_id,
          created_at,
          client_companies(company_name),
          vendor_companies(vendor_name),
          drivers(full_name)
        `)
        .eq("thread_type", activeTab)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched: Thread[] = (data || []).map((t: any) => {
        const participantName =
          t.client_companies?.company_name ||
          t.vendor_companies?.vendor_name ||
          t.drivers?.full_name ||
          (t.thread_type === "CLIENT" ? "Client Enterprise" : t.thread_type === "VENDOR" ? "Fleet Vendor" : "Fleet Driver");
        return {
          id: t.id,
          participant_id: t.client_id || t.vendor_id || t.driver_id || t.id,
          participant_name: participantName,
          participant_type: t.thread_type as ThreadType,
          last_message: "",
          last_message_at: t.created_at,
          unread_count: 0
        };
      });
      setThreads(enriched);
    } catch (err) {
      console.warn("Notice loading chat threads:", err);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchThreads();
    setSelectedThread(null);
    setMessages([]);
  }, [fetchThreads]);

  // Supabase real-time subscription on messages
  useEffect(() => {
    if (!selectedThread) return;
    const channel = supabase
      .channel(`thread-${selectedThread.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${selectedThread.id}` },
        (payload) => {
          const m = payload.new as any;
          setMessages(prev => [...prev, {
            id: m.id,
            thread_id: m.thread_id,
            sender_id: m.sender_user_id,
            sender_name: m.sender_role === "ADMIN" ? "Admin" : selectedThread.participant_name,
            sender_type: m.sender_role,
            content: m.message_text,
            created_at: m.created_at,
          }]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedThread]);

  const fetchMessages = async (thread: Thread) => {
    setSelectedThread(thread);
    setMsgLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          thread_id: m.thread_id,
          sender_id: m.sender_user_id,
          sender_name: m.sender_role === "ADMIN" ? "Admin" : thread.participant_name,
          sender_type: m.sender_role,
          content: m.message_text,
          created_at: m.created_at,
        })));
      }
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedThread || !newMsg.trim()) return;
    const content = newMsg.trim();
    setNewMsg("");
    setSending(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { data: inserted, error: insertErr } = await supabase
        .from("chat_messages")
        .insert({
          thread_id: selectedThread.id,
          sender_user_id: user?.id || "admin",
          sender_role: "ADMIN",
          message_text: content,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      if (inserted) {
        setMessages(prev => [...prev, {
          id: inserted.id,
          thread_id: inserted.thread_id,
          sender_id: inserted.sender_user_id,
          sender_name: "Admin",
          sender_type: "ADMIN",
          content: inserted.message_text,
          created_at: inserted.created_at,
        }]);
      }
    } catch (e: any) {
      console.error("Failed to send message:", e);
      // Fallback local update
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        thread_id: selectedThread.id,
        sender_id: "admin",
        sender_name: "Admin",
        sender_type: "ADMIN",
        content,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const filtered = threads.filter(t =>
    t.participant_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = threads.reduce((s, t) => s + (t.unread_count || 0), 0);

  return (
    <div className="cli-dir-wrapper" style={{ padding: 0, height: "calc(100vh - 84px)", minHeight: "560px", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "1.5rem 2rem 0", flexShrink: 0 }}>
        <div className="page-breadcrumb">
          <span className="breadcrumb-link">Operations</span>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-current">Communications</span>
        </div>
        <div className="page-header-row" style={{ marginBottom: "1rem" }}>
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <MessageSquare size={26} color="#F05A22" />
              Communications Hub
              {totalUnread > 0 && (
                <span style={{ background: "#F05A22", color: "#fff", fontSize: "0.8rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px" }}>
                  {totalUnread}
                </span>
              )}
            </h1>
            <p className="page-subtitle">Real-time messaging with clients, vendors, and drivers</p>
          </div>
          <button className="btn-action-outline" onClick={fetchThreads}>
            <RefreshCw size={15} /><span>Refresh</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="filter-tab-group" style={{ marginBottom: 0 }}>
          {(["CLIENT", "VENDOR", "DRIVER"] as ThreadType[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "filter-tab-active" : "filter-tab"}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              {TAB_ICONS[tab]}
              {tab === "CLIENT" ? "Clients" : tab === "VENDOR" ? "Vendors" : "Drivers"}
            </button>
          ))}
        </div>
      </div>

      {/* Chat layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", margin: "0 2rem 1.5rem", gap: "1rem", marginTop: "1rem" }}>

        {/* Thread list */}
        <div style={{
          width: "320px", flexShrink: 0, background: "#fff",
          borderRadius: "14px", border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
          display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
          {/* Search */}
          <div style={{ padding: "1rem", borderBottom: "1px solid #E2E8F0" }}>
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" />
              <input className="search-input-field" type="text" placeholder="Search conversations..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Thread rows */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <Loader2 size={28} color="#F05A22" style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#94A3B8" }}>
                <MessageSquare size={36} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
                <p style={{ fontSize: "0.85rem" }}>No conversations yet</p>
              </div>
            ) : (
              filtered.map(thread => (
                <div
                  key={thread.id}
                  onClick={() => fetchMessages(thread)}
                  style={{
                    padding: "1rem",
                    cursor: "pointer",
                    background: selectedThread?.id === thread.id ? "#FFF5F0" : "transparent",
                    borderBottom: "1px solid #F1F5F9",
                    borderLeft: selectedThread?.id === thread.id ? "3px solid #F05A22" : "3px solid transparent",
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.35rem" }}>
                    <span style={{ fontWeight: 600, color: "#111111", fontSize: "0.9rem" }}>
                      {thread.participant_name}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      {thread.unread_count > 0 && (
                        <span style={{ background: "#F05A22", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: "10px" }}>
                          {thread.unread_count}
                        </span>
                      )}
                      <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                        {thread.last_message_at ? new Date(thread.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                    {thread.last_message || "No messages yet"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message pane */}
        <div style={{
          flex: 1, background: "#fff", borderRadius: "14px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
          display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
          {!selectedThread ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
              <MessageSquare size={56} style={{ opacity: 0.2, marginBottom: "1rem" }} />
              <p style={{ fontSize: "1rem", fontWeight: 600 }}>Select a conversation</p>
              <p style={{ fontSize: "0.85rem" }}>Choose a thread from the left to start messaging</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ width: "36px", height: "36px", background: "#FFF5F0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {TAB_ICONS[selectedThread.participant_type]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#111111", fontSize: "0.95rem" }}>{selectedThread.participant_name}</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748B", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Circle size={8} fill="#10B981" color="#10B981" />Online
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", background: "#F8FAFC" }}>
                {msgLoading ? (
                  <div style={{ textAlign: "center", paddingTop: "2rem" }}>
                    <Loader2 size={28} color="#F05A22" style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#94A3B8", paddingTop: "2rem", fontSize: "0.9rem" }}>
                    No messages yet — start the conversation below.
                  </div>
                ) : (
                  messages.map(msg => {
                    const isAdmin = msg.sender_type === "ADMIN";
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: isAdmin ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "65%",
                          padding: "0.75rem 1rem",
                          borderRadius: isAdmin ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          background: isAdmin ? "#F05A22" : "#FFFFFF",
                          color: isAdmin ? "#fff" : "#172B4D",
                          border: isAdmin ? "none" : "1px solid #E2E8F0",
                          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
                          fontSize: "0.9rem",
                          lineHeight: "1.5"
                        }}>
                          <p style={{ margin: 0 }}>{msg.content}</p>
                          <div style={{ fontSize: "0.72rem", marginTop: "0.35rem", opacity: 0.75, textAlign: "right" }}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #E2E8F0", display: "flex", gap: "0.75rem", alignItems: "end", background: "#FFFFFF" }}>
                <textarea
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  style={{
                    flex: 1, padding: "0.75rem", border: "1px solid #CBD5E1",
                    borderRadius: "10px", fontSize: "0.9rem", resize: "none",
                    outline: "none", fontFamily: "inherit"
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !newMsg.trim()}
                  style={{
                    padding: "0.75rem 1.25rem",
                    background: newMsg.trim() ? "#F05A22" : "#F1F5F9",
                    color: newMsg.trim() ? "#fff" : "#94A3B8",
                    border: "none",
                    borderRadius: "10px",
                    cursor: newMsg.trim() ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700,
                    transition: "all 0.15s ease"
                  }}
                >
                  <Send size={16} />
                  <span>Send</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
