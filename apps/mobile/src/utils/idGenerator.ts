/**
 * NECL Unique ID Generation System - Mobile App
 * Format: NECL-[ENTITY_CODE]-DDMMYYYY-XXXXX
 *
 * All dates are calculated in 'Asia/Kolkata' (IST).
 * Sequences are zero-padded to 5 digits.
 */

import { supabase } from "../supabase";

export type NeclEntityType =
  | "CL"  // Clients
  | "VD"  // Vendors
  | "DR"  // Drivers
  | "VH"  // Vehicles
  | "BK"  // Bookings
  | "REQ" // Requirements
  | "RFQ" // RFQs
  | "QT"  // Quotes
  | "PAY" // Payments
  | "INV" // Invoices
  | "RFD" // Refunds
  | "TXN" // Transactions
  | "SHP" // Shipments
  | "TRP" // Trips
  | "TKT" // Support Tickets
  | "DOC" // Documents
  | "NTF" // Notifications
  | "CN"  // Credit Notes
  | "PO"  // Purchase Orders
  | "AUD"; // Audit Logs

export const ENTITY_PREFIX_LABELS: Record<NeclEntityType, string> = {
  CL: "Client",
  VD: "Vendor",
  DR: "Driver",
  VH: "Vehicle",
  BK: "Booking",
  REQ: "Requirement",
  RFQ: "RFQ",
  QT: "Quote",
  PAY: "Payment",
  INV: "Invoice",
  RFD: "Refund",
  TXN: "Transaction",
  SHP: "Shipment",
  TRP: "Trip",
  TKT: "Support Ticket",
  DOC: "Document",
  NTF: "Notification",
  CN: "Credit Note",
  PO: "Purchase Order",
  AUD: "Audit Log"
};

/**
 * Returns date formatted as DDMMYYYY in Asia/Kolkata timezone
 */
export function getIstDateKey(dateInput?: Date | string | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return getIstDateKey(new Date());
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const parts = formatter.formatToParts(d);
  const day = parts.find(p => p.type === "day")?.value || "01";
  const month = parts.find(p => p.type === "month")?.value || "01";
  const year = parts.find(p => p.type === "year")?.value || "2026";

  return `${day}${month}${year}`;
}

/**
 * Formats a canonical NECL Unique ID
 */
export function formatNeclId(
  entityType: NeclEntityType,
  sequenceNum: number,
  dateInput?: Date | string | null
): string {
  const dateKey = getIstDateKey(dateInput);
  const paddedSeq = String(Math.max(1, Math.min(sequenceNum, 99999))).padStart(5, "0");
  return `NECL-${entityType}-${dateKey}-${paddedSeq}`;
}

export const NECL_ID_REGEX = /^NECL-(CL|VD|DR|VH|BK|REQ|RFQ|QT|PAY|INV|RFD|TXN|SHP|TRP|TKT|DOC|NTF|CN|PO|AUD)-\d{8}-\d{5}$/;

export function isValidNeclId(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return NECL_ID_REGEX.test(id.trim());
}

/**
 * Converts legacy codes or IDs into a canonical NECL ID for consistent mobile UI display
 */
export function formatDisplayId(
  entityType: NeclEntityType,
  rawIdOrCode?: string | null,
  createdAt?: string | Date | null
): string {
  if (!rawIdOrCode) {
    return formatNeclId(entityType, 1, createdAt);
  }

  const str = String(rawIdOrCode).trim();

  if (isValidNeclId(str)) {
    return str;
  }

  if (str.toUpperCase().startsWith("NECL-")) {
    return str.toUpperCase();
  }

  let seq = 1;
  const numMatch = str.match(/\d+/g);
  if (numMatch && numMatch.length > 0) {
    const combined = numMatch.join("");
    seq = parseInt(combined.slice(-5), 10) || 1;
  } else {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    seq = (Math.abs(hash) % 90000) + 10000;
  }

  return formatNeclId(entityType, seq, createdAt);
}

/**
 * Generates an atomic NECL ID via Supabase database RPC: generate_necl_id.
 */
export async function generateDbNeclId(
  entityType: NeclEntityType,
  timestamp?: Date | string
): Promise<string> {
  const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

  try {
    const { data, error } = await supabase.rpc("generate_necl_id", {
      p_entity_type: entityType,
      p_timestamp: ts
    });

    if (!error && data && typeof data === "string") {
      return data;
    }
  } catch {
    // Fall back to timestamp calculation below
  }

  const dateKey = getIstDateKey(ts);
  const randomSeq = Math.floor(10000 + Math.random() * 89999);
  return `NECL-${entityType}-${dateKey}-${randomSeq}`;
}
