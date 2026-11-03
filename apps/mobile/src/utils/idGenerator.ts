/**
 * THE TRUCKX Unique ID Generation System - Mobile App
 * Canonical Format: TRUCKX-[ENTITY_CODE]-DDMMYYYY-XXXXX
 *
 * Entity Codes:
 *   AC   -> Account (User Account)        -> TRUCKX-AC-DDMMYYYY-00001
 *   CL   -> Client Company               -> TRUCKX-CL-DDMMYYYY-00001
 *   VE   -> Vendor (Transporter)         -> TRUCKX-VE-DDMMYYYY-00001
 *   DR   -> Driver                       -> TRUCKX-DR-DDMMYYYY-00001
 *   REQ  -> Transport Requirement        -> TRUCKX-REQ-DDMMYYYY-00001
 *   QT   -> Commercial Quotation         -> TRUCKX-QT-DDMMYYYY-00001
 *   BK   -> Booking Confirmation         -> TRUCKX-BK-DDMMYYYY-00001
 *   VH   -> Fleet Vehicle                -> TRUCKX-VH-DDMMYYYY-00001
 *   TR   -> Consignment Trip / Shipment  -> TRUCKX-TR-DDMMYYYY-00001
 *
 * All dates are calculated in 'Asia/Kolkata' (IST).
 * Sequences are zero-padded to 5 digits.
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

export type NeclEntityType =
  | TruckxEntityType
  | "VD"
  | "TRP"
  | "SHP"
  | "RFQ"
  | "PAY"
  | "INV"
  | "RFD"
  | "TXN"
  | "TKT"
  | "DOC"
  | "NTF"
  | "CN"
  | "PO"
  | "AUD";

export const ENTITY_PREFIX_LABELS: Record<string, string> = {
  AC: "Account",
  CL: "Client",
  VE: "Vendor",
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
  TR: "Trip",
  TKT: "Support Ticket",
  DOC: "Document",
  NTF: "Notification",
  CN: "Credit Note",
  PO: "Purchase Order",
  AUD: "Audit Log"
};

/**
 * Normalizes entity code to standard TRUCKX code
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

export const TRUCKX_ID_REGEX = /^TRUCKX-(AC|CL|VE|DR|REQ|QT|BK|VH|TR)-\d{8}-\d{5}$/;
export const NECL_ID_REGEX = /^(TRUCKX|NECL)-(AC|CL|VE|VD|DR|VH|BK|REQ|RFQ|QT|PAY|INV|RFD|TXN|SHP|TRP|TR|TKT|DOC|NTF|CN|PO|AUD)-\d{8}-\d{5}$/;

/**
 * Validates whether a string conforms to the TRUCKX Canonical ID format
 */
export function isValidTruckxId(id?: string | null, expectedEntity?: string): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!TRUCKX_ID_REGEX.test(trimmed)) return false;
  if (expectedEntity) {
    const norm = normalizeEntityCode(expectedEntity);
    return trimmed.startsWith(`TRUCKX-${norm}-`);
  }
  return true;
}

export function isValidNeclId(id?: string | null, expectedEntity?: string): boolean {
  if (!id || typeof id !== "string") return false;
  if (!NECL_ID_REGEX.test(id.trim())) return false;
  if (expectedEntity) {
    const norm = normalizeEntityCode(expectedEntity);
    const parts = id.trim().split("-");
    const parsedNorm = normalizeEntityCode(parts[1]);
    return parsedNorm === norm;
  }
  return true;
}

/**
 * Formats a canonical TRUCKX ID
 */
export function formatTruckxId(
  entityType: string,
  sequenceNum: number,
  dateInput?: Date | string | null
): string {
  const norm = normalizeEntityCode(entityType);
  const dateKey = getIstDateKey(dateInput);
  const paddedSeq = String(Math.max(1, Math.min(sequenceNum, 99999))).padStart(5, "0");
  return `TRUCKX-${norm}-${dateKey}-${paddedSeq}`;
}

export function formatNeclId(
  entityType: string,
  sequenceNum: number,
  dateInput?: Date | string | null
): string {
  const norm = normalizeEntityCode(entityType);
  const dateKey = getIstDateKey(dateInput);
  const paddedSeq = String(Math.max(1, Math.min(sequenceNum, 99999))).padStart(5, "0");
  return `NECL-${entityType}-${dateKey}-${paddedSeq}`;
}

/**
 * Converts legacy codes or IDs into a canonical TRUCKX ID for consistent mobile UI display
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

  // If already in standard TRUCKX format, return as is
  if (isValidTruckxId(str, normEntity)) {
    return str;
  }

  if (str.toUpperCase().startsWith("TRUCKX-")) {
    return str.toUpperCase();
  }

  if (str.toUpperCase().startsWith("NECL-")) {
    return str.toUpperCase();
  }

  // Preserve existing requirement IDs (e.g., REQ-YYYYMMDD-XXXX or REQ-*)
  if (normEntity === "REQ" && str.toUpperCase().startsWith("REQ-")) {
    return str;
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

/**
 * Generates an atomic TRUCKX ID via Supabase database RPC: generate_truckx_id.
 */
export async function generateDbTruckxId(
  entityType: string,
  timestamp?: Date | string
): Promise<string> {
  const norm = normalizeEntityCode(entityType);
  const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

  try {
    const { data, error } = await supabase.rpc("generate_truckx_id", {
      p_entity_type: norm,
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
  return `TRUCKX-${norm}-${dateKey}-${randomSeq}`;
}

export async function generateDbNeclId(
  entityType: string,
  timestamp?: Date | string
): Promise<string> {
  return generateDbTruckxId(entityType, timestamp);
}
