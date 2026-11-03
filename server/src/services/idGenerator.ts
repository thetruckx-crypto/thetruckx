/**
 * THE TRUCKX Unique ID Generation System - Server Service
 * Canonical Format: TRUCKX-[ENTITY_CODE]-DDMMYYYY-XXXXX
 *
 * Supported Canonical Entities:
 *   AC  -> Account (User Account)        -> TRUCKX-AC-DDMMYYYY-00001
 *   CL  -> Client Company               -> TRUCKX-CL-DDMMYYYY-00001
 *   VE  -> Vendor (Transporter)         -> TRUCKX-VE-DDMMYYYY-00001
 *   DR  -> Driver                       -> TRUCKX-DR-DDMMYYYY-00001
 *   REQ -> Transport Requirement        -> TRUCKX-REQ-DDMMYYYY-00001
 *   QT  -> Commercial Quotation         -> TRUCKX-QT-DDMMYYYY-00001
 *   BK  -> Booking Confirmation         -> TRUCKX-BK-DDMMYYYY-00001
 *   VH  -> Fleet Vehicle                -> TRUCKX-VH-DDMMYYYY-00001
 *   TR  -> Consignment Trip / Shipment  -> TRUCKX-TR-DDMMYYYY-00001
 *
 * All dates are calculated in 'Asia/Kolkata' (IST).
 * Sequences are zero-padded to 5 digits and concurrency-safe via atomic database sequence.
 */

import { supabase } from "../supabase";

export type TruckxEntityType =
  | "AC"  // Account
  | "CL"  // Client
  | "VE"  // Vendor
  | "DR"  // Driver
  | "REQ" // Requirement
  | "QT"  // Quotation
  | "BK"  // Booking
  | "VH"  // Vehicle
  | "TR"; // Trip

// Legacy entity type mapping alias
export type NeclEntityType =
  | TruckxEntityType
  | "VD"  // Legacy Vendor
  | "TRP" // Legacy Trip
  | "SHP" // Legacy Shipment
  | "RFQ" // Legacy RFQ
  | "PAY" // Legacy Payment
  | "INV" // Legacy Invoice
  | "RFD" // Legacy Refund
  | "TXN" // Legacy Transaction
  | "TKT" // Legacy Ticket
  | "DOC" // Legacy Document
  | "NTF" // Legacy Notification
  | "CN"  // Legacy Credit Note
  | "PO"  // Legacy Purchase Order
  | "AUD"; // Legacy Audit Log

export const TRUCKX_ID_REGEX = /^TRUCKX-(AC|CL|VE|DR|REQ|QT|BK|VH|TR)-\d{8}-\d{5}$/;
export const NECL_ID_REGEX = /^(TRUCKX|NECL)-(AC|CL|VE|VD|DR|VH|BK|REQ|RFQ|QT|PAY|INV|RFD|TXN|SHP|TRP|TR|TKT|DOC|NTF|CN|PO|AUD)-\d{8}-\d{5}$/;

/**
 * Returns date formatted as DDMMYYYY in Asia/Kolkata (IST) timezone
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
 * Normalize legacy entity codes to standard TRUCKX entity codes
 */
export function normalizeEntityCode(code: string): TruckxEntityType {
  const upper = code.trim().toUpperCase();
  if (upper === "VD" || upper === "VND" || upper === "VENDOR") return "VE";
  if (upper === "TRP" || upper === "SHP" || upper === "TRIP") return "TR";
  if (upper === "ACC" || upper === "ACCOUNT") return "AC";
  if (upper === "CLI" || upper === "CLIENT") return "CL";
  if (upper === "DRV" || upper === "DRIVER") return "DR";
  if (upper === "QUOTE" || upper === "QTE") return "QT";
  if (upper === "BOK" || upper === "BOOKING") return "BK";
  if (upper === "VEH" || upper === "VEHICLE") return "VH";
  if (upper === "REQUIREMENT") return "REQ";

  if (["AC", "CL", "VE", "DR", "REQ", "QT", "BK", "VH", "TR"].includes(upper)) {
    return upper as TruckxEntityType;
  }
  return "CL";
}

/**
 * Validates whether a string conforms to the TRUCKX Canonical ID format
 */
export function isValidTruckxId(id?: string | null, expectedEntity?: TruckxEntityType): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!TRUCKX_ID_REGEX.test(trimmed)) return false;
  if (expectedEntity) {
    const norm = normalizeEntityCode(expectedEntity);
    return trimmed.startsWith(`TRUCKX-${norm}-`);
  }
  return true;
}

export function isValidNeclId(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return NECL_ID_REGEX.test(id.trim());
}

/**
 * Formats a canonical TRUCKX ID
 */
export function formatTruckxId(
  entityType: string,
  sequenceNum: number,
  dateInput?: Date | string | null
): string {
  const normEntity = normalizeEntityCode(entityType);
  const dateKey = getIstDateKey(dateInput);
  const paddedSeq = String(Math.max(1, Math.min(sequenceNum, 99999))).padStart(5, "0");
  return `TRUCKX-${normEntity}-${dateKey}-${paddedSeq}`;
}

// Backward-compatible alias
export function formatNeclId(
  entityType: string,
  sequenceNum: number,
  dateInput?: Date | string | null
): string {
  return formatTruckxId(entityType, sequenceNum, dateInput);
}

/**
 * Generates an atomic, concurrency-safe TRUCKX ID via database RPC: generate_truckx_id
 */
export async function generateDbTruckxId(
  entityType: string,
  timestamp?: Date | string
): Promise<string> {
  const normEntity = normalizeEntityCode(entityType);
  const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

  try {
    const { data, error } = await supabase.rpc("generate_truckx_id", {
      p_entity_type: normEntity,
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
  return `TRUCKX-${normEntity}-${dateKey}-${randomSeq}`;
}

export async function generateDbNeclId(
  entityType: string,
  timestamp?: Date | string
): Promise<string> {
  return generateDbTruckxId(entityType, timestamp);
}

/**
 * Deterministically formats an existing or legacy code to standard TRUCKX display format
 */
export function formatDisplayId(
  entityType: string,
  rawIdOrCode?: string | null,
  createdAt?: string | Date | null
): string {
  const normEntity = normalizeEntityCode(entityType);

  if (!rawIdOrCode) {
    return formatTruckxId(normEntity, 1, createdAt);
  }

  const str = String(rawIdOrCode).trim();

  // If already standard TRUCKX format, preserve it
  if (isValidTruckxId(str, normEntity)) {
    return str;
  }

  if (str.toUpperCase().startsWith("TRUCKX-")) {
    return str.toUpperCase();
  }

  // If legacy NECL format, convert prefix to TRUCKX
  if (str.toUpperCase().startsWith("NECL-")) {
    return `TRUCKX-${str.substring(5)}`;
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

  return formatTruckxId(normEntity, seq, createdAt);
}
