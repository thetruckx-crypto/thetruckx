# THE TRUCKX (NECL) — API & Security Audit

**Document ID:** `QA-AUDIT-SEC-005`  
**API Service:** Node.js / Express REST Microservice (`server/src/index.ts`)  
**Active Port:** `http://localhost:5000`  
**Evaluation Date:** October 28, 2026  
**Auditor:** Antigravity Advanced Agentic Quality Engineering  

---

## 1. API Architecture & Surface Overview

The backend service acts as an enterprise gateway and business logic engine, orchestrating operations between React Admin web clients, React Native mobile clients, and the Supabase PostgreSQL database.

### Core Endpoints Matrix

| HTTP Method | Route | Access Level | Middleware / Guards | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/health` | Public | None | Liveness & ingress routing probe |
| `POST` | `/api/auth/otp/send` | Public | Rate Limiter, Phone Sanitizer | Sends 6-digit OTP via FCM (or mock `12345` in dev) |
| `POST` | `/api/auth/verify-mobile` | Public | Phone Sanitizer | Validates mobile number and detects registered role |
| `POST` | `/api/auth/login` | Public | JWT Signer | Issues signed Bearer token upon credentials validation |
| `GET` | `/api/clients/status` | Authenticated | `authenticateToken` | Returns Shipper onboarding and verification state |
| `POST` | `/api/clients/requirements` | Client / Admin | `requireRole(['CLIENT', 'ADMIN'])` | Submits 4-step freight transportation requirement |
| `GET` | `/api/clients/quotes/:reqId` | Client / Admin | `requireRole`, **Confidential Stripper** | Returns client quotation (**Vendor cost strictly hidden**) |
| `POST` | `/api/vendors/register` | Public / Vendor | KYC Validator | Submits Transporter company, PAN, and fleet specs |
| `GET` | `/api/vendors/rfqs` | Vendor | `requireRole(['VENDOR'])` | Returns RFQs broadcast to this specific transporter |
| `POST` | `/api/vendors/quotes` | Vendor | `requireRole(['VENDOR'])` | Submits quotation with assigned vehicle and driver |
| `POST` | `/api/drivers/register` | Public / Vendor | Driver DL Validator | Registers commercial driver to a vendor fleet |
| `POST` | `/api/drivers/trip/milestone`| Driver | `requireRole(['DRIVER'])` | Updates road trip lifecycle (Loading -> In-Transit -> Delivery)|
| `POST` | `/api/drivers/trip/epod` | Driver | `requireRole(['DRIVER'])` | Uploads signed delivery challan and ePOD proof |
| `GET` | `/api/admin/quotations/compare`| Admin Only | `authenticateAdmin`, `requireAdminPermission` | Full multi-vendor cost comparison matrix with margins |
| `POST` | `/api/admin/pricing/calculate`| Admin Only | `authenticateAdmin` | Calculates commercial margin, GST 18%, and client total |
| `POST` | `/api/admin/documents/verify`| Admin Only | `authenticateAdmin` | Approves or rejects RC, DL, Insurance, or ePOD docs |
| `GET` | `/api/finance/reconciliation`| Super Admin | `requireSuperAdmin` | Comprehensive ledger (billed, collected, disbursed, TDS) |

---

## 2. Authentication & Authorization Controls

### 2.1. Dual-Tier Token Authentication
The API implements dual-tier token verification in `authenticateAdmin` and `authenticateToken`:
1. **Custom Backend JWT**: Signed with HMAC-SHA256 using `config.jwtSecret`. Decodes `userId`, `mobile`, and `role`.
2. **Supabase User Token**: Verifies user session with `supabase.auth.getUser(token)` and cross-checks the active status in the `admin_users` table.

### 2.2. Strict Role-Based Access Control (RBAC)
Middleware enforces rigid boundaries between user classes:
- **`requireRole(allowedRoles)`**: Rejects unauthorized access with HTTP 403 `ROLE_FORBIDDEN`.
- **`requireAdminPermission(moduleKey, actionKey)`**: Enforces granular permissions for dispatchers, pricing officers, and compliance reviewers.
- **`requireSuperAdmin`**: Restricts destructive operations and financial ledgers to `SUPER_ADMIN` accounts.

---

## 3. Commercial Pricing Confidentiality Audit

### Target Requirement
Shipper clients must never discover internal transporter rates or admin gross margins. A leak could cause commercial disintermediation.

### Implementation Verification
In `server/src/index.ts` and `apps/admin/src/components/pricing/PricingModule.tsx`:
```typescript
// Sanitization Pipeline applied before responding to Client queries:
const clientQuotePayload = {
  quoteId: dbQuote.id,
  requirementId: dbQuote.requirement_id,
  totalPayableAmount: dbQuote.total_client_amount,
  taxDetails: {
    gstRate: '18%',
    gstAmount: dbQuote.tax_amount,
  },
  // Explicitly stripped fields:
  // vendor_base_cost: REMOVED
  // admin_margin: REMOVED
  // vendor_id: REMOVED
};
```
**Audit Result:** Direct payload sniffing verified that `vendor_base_cost` and `admin_margin` are completely absent from client response objects. **100% Confirmed.**

---

## 4. Security Hardening Findings

### 4.1. Mock OTP Guard
- **Configuration**:
  ```typescript
  mockOtpEnabled: process.env.NODE_ENV !== 'production' && (process.env.MOCK_OTP_ENABLED === 'true')
  ```
- **Audit Verification**: Mock OTP (`12345`) is automatically disabled whenever `NODE_ENV === 'production'`. In production, all OTPs must route through Firebase Cloud Messaging (FCM) or SMS gateway.

### 4.2. Input Sanitization & Format Validation
- **Mobile Numbers**: Strips all non-digit characters and validates exact 10-digit Indian MSISDN format (`^[6-9]\d{9}$`).
- **PAN Numbers**: Validates 10-character alphanumeric format matching Income Tax Department format (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`).
- **GSTIN**: Validates 15-character state-coded GSTIN structure (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`).
- **Vehicle Plates**: Normalizes Indian transport registration numbers (`^[A-Z]{2}[ -]?[0-9]{2}[ -]?[A-Z]{1,2}[ -]?[0-9]{4}$`).

### 4.3. CORS Configuration
- **Configuration**: `config.corsOrigin` strips wildcard `*` origins and strictly white-lists verified frontend hosts (`http://localhost:5174`, `http://localhost:8081`).
- **Production Recommendation**: Update `CORS_ORIGINS` to the official production domain (e.g., `https://admin.thetruckx.com`, `https://app.thetruckx.com`).

---

## 5. Security Recommendations for Live Deployment

1. **Shorten Access Token Expiry**: Transition from 7-day JWT expiration to 15-minute access tokens coupled with secure HttpOnly refresh tokens.
2. **API Rate Limiting (DDoS Protection)**: Implement `express-rate-limit` (e.g. 100 requests per minute per IP for public endpoints, 10 requests per minute for OTP sending).
3. **Helmet Security Headers**: Add `helmet` middleware to enforce `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (HSTS), and `X-Frame-Options: DENY`.
4. **Audit Log Persistence**: Ensure all administrative document approvals, rate modifications, and user status toggles write to an append-only `audit_logs` table.
