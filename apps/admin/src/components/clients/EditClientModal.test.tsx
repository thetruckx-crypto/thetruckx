import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { pincodeService } from "../../services/pincodeService";

describe("Edit Client Functionality - NECL Admin Panel", () => {
  const profileCode = fs.readFileSync(
    path.join(__dirname, "ClientProfile.tsx"),
    "utf-8"
  );
  const modalCode = fs.readFileSync(
    path.join(__dirname, "EditClientModal.tsx"),
    "utf-8"
  );
  const cssCode = fs.readFileSync(
    path.join(__dirname, "../../index.css"),
    "utf-8"
  );

  describe("1. Root Cause Resolution & Panel Removal", () => {
    it("should remove the unintended 'Client details are live from database.' message from the Edit Client button handler", () => {
      expect(profileCode).not.toContain('setToastMsg("Client details are live from database.")');
    });

    it("should wire the Edit Client button directly to opening the EDIT_CLIENT modal", () => {
      expect(profileCode).toContain('setActiveModal("EDIT_CLIENT")');
      expect(profileCode).toContain('id="btn-edit-client"');
    });

    it("should fix the oversized dark-blue toast notification rule so toasts appear non-obtrusively at bottom-right", () => {
      // Must not have the top: 24px with dark blue (#172B4D) background for toast-success
      expect(cssCode).not.toMatch(/\.toast-success[^{]*\{[^}]*background:\s*#172B4D/);
      // Must have bottom-right placement for success notifications
      expect(cssCode).toContain(".toast-success,");
    });
  });

  describe("2. Proper Edit Client Drawer / Modal Structure", () => {
    it("should render EditClientModal when activeModal is EDIT_CLIENT", () => {
      expect(profileCode).toContain('activeModal === "EDIT_CLIENT"');
      expect(profileCode).toContain('<EditClientModal');
    });

    it("should define dedicated responsive drawer/modal styles in index.css", () => {
      expect(cssCode).toContain(".edit-client-backdrop");
      expect(cssCode).toContain(".edit-client-drawer-card");
      expect(cssCode).toContain(".edit-client-header");
      expect(cssCode).toContain(".edit-client-body");
      expect(cssCode).toContain(".edit-client-footer");
      expect(cssCode).toContain(".btn-edit-client-save");
      expect(cssCode).toContain(".btn-edit-client-cancel");
    });

    it("should provide a visible close button and listen for Escape key to close", () => {
      expect(modalCode).toContain('id="btn-close-edit-client-modal"');
      expect(modalCode).toContain('aria-label="Close edit client modal"');
      expect(modalCode).toContain('e.key === "Escape"');
    });
  });

  describe("3. Data Population & Supported Fields", () => {
    it("should load existing client organization data into form fields", () => {
      expect(modalCode).toContain("client.company_name");
      expect(modalCode).toContain("client.business_type");
      expect(modalCode).toContain("client.industry_type");
      expect(modalCode).toContain("client.gstin");
      expect(modalCode).toContain("client.pan");
    });

    it("should load existing primary contact person details", () => {
      expect(modalCode).toContain("primaryContact?.full_name");
      expect(modalCode).toContain("primaryContact?.designation");
      expect(modalCode).toContain("primaryContact?.email");
      expect(modalCode).toContain("primaryContact?.mobile");
    });

    it("should parse and load registered address components (line 1, line 2, city, state, pincode)", () => {
      expect(modalCode).toContain("parseAddressParts");
      expect(modalCode).toContain("client.registered_address");
      expect(modalCode).toContain("client.pincode");
      expect(modalCode).toContain("client.city");
      expect(modalCode).toContain("client.state");
    });

    it("should include company PAN and support auto-derivation from valid GSTIN", () => {
      expect(modalCode).toContain("handleGstinChange");
      expect(modalCode).toContain("cleanGst.substring(2, 12)");
      expect(modalCode).toContain("/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/");
    });
  });

  describe("4. Live PIN Code Lookup & Auto-Detection", () => {
    it("should integrate with pincodeService to auto-populate City and State upon entering a 6-digit PIN", () => {
      expect(modalCode).toContain("pincodeService.lookupPincode");
      expect(modalCode).toContain("handlePincodeChange");
    });

    it("should display a loading indicator and status badge for PIN code resolution", () => {
      expect(modalCode).toContain("isPincodeLoading");
      expect(modalCode).toContain("pincodeStatus");
      expect(modalCode).toContain("pincode-status-badge");
    });

    it("should verify pincodeService resolves logistics hubs correctly", async () => {
      const guwahatiRes = await pincodeService.lookupPincode("781001");
      expect(guwahatiRes.success).toBe(true);
      expect(["Guwahati", "Kamrup", "Kamrup Metropolitan"]).toContain(guwahatiRes.data?.city);
      expect(guwahatiRes.data?.state).toBe("Assam");

      const vizagRes = await pincodeService.lookupPincode("530001");
      expect(vizagRes.success).toBe(true);
      expect(vizagRes.data?.city).toBe("Visakhapatnam");
      expect(vizagRes.data?.state).toBe("Andhra Pradesh");
    }, 15000);

    it("should allow manual editing of City and State when fallback is needed", () => {
      expect(modalCode).toContain('id="edit-city"');
      expect(modalCode).toContain('id="edit-state"');
      expect(modalCode).toContain("ALL_INDIAN_STATES");
    });
  });

  describe("5. Validation & Database Persistence", () => {
    it("should validate all mandatory fields before submitting", () => {
      expect(modalCode).toContain("validateForm");
      expect(modalCode).toContain("Company legal name is required");
      expect(modalCode).toContain("Primary contact person name is required");
      expect(modalCode).toContain("Official email address is required");
      expect(modalCode).toContain("Primary mobile number is required");
      expect(modalCode).toContain("Registered address line 1 is required");
      expect(modalCode).toContain("PIN code must be exactly 6 digits");
    });

    it("should update client_companies table and client_users table in Supabase", () => {
      expect(modalCode).toContain('.from("client_companies")');
      expect(modalCode).toContain('.update({');
      expect(modalCode).toContain('.eq("id", client.id)');
      expect(modalCode).toContain('.from("client_users")');
    });

    it("should strictly preserve immutable client metadata (client_code, status, created_at)", () => {
      // The update payload for client_companies must NOT overwrite status or client_code
      expect(modalCode).not.toContain("status: formData.status");
      expect(modalCode).not.toContain("client_code: formData.client_code");
      expect(modalCode).not.toContain("created_at: formData.created_at");
      // Must display integrity safeguard note
      expect(modalCode).toContain("Account Status & Identification Integrity");
    });

    it("should invoke onSaved and refresh client details without full page reload", () => {
      expect(profileCode).toContain("await loadClientDetailsFromDB(true)");
      expect(profileCode).toContain('setToastMsg("Client details updated successfully!")');
    });
  });
});
