import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Instant Client Approval and Dashboard Reflection Integration', () => {
  const adminProfilePath = path.resolve(__dirname, 'ClientProfile.tsx');
  const adminDirectoryPath = path.resolve(__dirname, 'ClientDirectory.tsx');
  const mobileServicePath = path.resolve(
    __dirname,
    '../../../../mobile/src/services/clientService.ts'
  );
  const mobileConfirmPath = path.resolve(
    __dirname,
    '../../../../mobile/src/screens/client/onboarding/ClientRegistrationConfirmationScreen.tsx'
  );
  const mobileStatusPath = path.resolve(
    __dirname,
    '../../../../mobile/src/screens/auth/registration/RegistrationStatusScreen.tsx'
  );
  const mobileAppPath = path.resolve(__dirname, '../../../../mobile/App.tsx');

  const adminProfileCode = fs.readFileSync(adminProfilePath, 'utf-8');
  const adminDirectoryCode = fs.readFileSync(adminDirectoryPath, 'utf-8');
  const mobileServiceCode = fs.readFileSync(mobileServicePath, 'utf-8');
  const mobileConfirmCode = fs.readFileSync(mobileConfirmPath, 'utf-8');
  const mobileStatusCode = fs.readFileSync(mobileStatusPath, 'utf-8');
  const mobileAppCode = fs.readFileSync(mobileAppPath, 'utf-8');

  describe('1. Admin Panel Instant Database Update & Realtime Broadcast', () => {
    it('ClientProfile approves via parallel Supabase RPC and direct table updates without blocking on API', () => {
      expect(adminProfileCode).toContain('const rpcPromise = supabase.rpc("admin_review_client_registration"');
      expect(adminProfileCode).toContain('const companyUpdatePromise = supabase');
      expect(adminProfileCode).toContain('const userUpdatePromise = supabase');
      expect(adminProfileCode).toContain('Promise.all([');
      expect(adminProfileCode).toContain('client-approvals-realtime');
      expect(adminProfileCode).toContain("event: \"CLIENT_APPROVED\"");
    });

    it('ClientDirectory approves with parallel direct updates and broadcast', () => {
      expect(adminDirectoryCode).toContain('const rpcPromise = supabase.rpc("admin_review_client_registration"');
      expect(adminDirectoryCode).toContain('client-approvals-realtime');
      expect(adminDirectoryCode).toContain("event: \"CLIENT_APPROVED\"");
    });
  });

  describe('2. Mobile Client Service Latency Optimization', () => {
    it('prioritizes direct Supabase RPC before slower backend fetch to prevent hanging on abort timeouts', () => {
      const rpcIdx = mobileServiceCode.indexOf("supabase.rpc('check_client_account_status'");
      const apiIdx = mobileServiceCode.indexOf('getBackendApiUrl()}/client/status/');
      expect(rpcIdx).toBeGreaterThan(-1);
      expect(apiIdx).toBeGreaterThan(-1);
      expect(rpcIdx).toBeLessThan(apiIdx);
    });

    it('prevents caching stale pending status while trusting approved accounts', () => {
      expect(mobileServiceCode).toContain("cached.data.status === 'APPROVED'");
      expect(mobileServiceCode).toContain('Date.now() - cached.timestamp < 300');
    });
  });

  describe('3. Mobile Confirmation & Status Screens Realtime Reactivity', () => {
    it('ClientRegistrationConfirmationScreen subscribes to broadcast and passes res to onGoToDashboard', () => {
      expect(mobileConfirmCode).toContain('client-approvals-realtime');
      expect(mobileConfirmCode).toContain("event: 'CLIENT_APPROVED'");
      expect(mobileConfirmCode).toContain('onGoToDashboard(res)');
      expect(mobileConfirmCode).toContain('setInterval(');
      expect(mobileConfirmCode).toContain('1000');
    });

    it('RegistrationStatusScreen navigates immediately on approved status without waiting for documents', () => {
      expect(mobileStatusCode).toContain('client-approvals-realtime');
      expect(mobileStatusCode).toContain("event: 'CLIENT_APPROVED'");
      expect(mobileStatusCode).toContain('onApprovedContinue(res)');
      expect(mobileStatusCode).toContain('1000');
    });
  });

  describe('4. Mobile App Routing & Guard Optimization', () => {
    it('App.tsx utilizes pre-fetched approved data in onGoToDashboard and onApprovedContinue', () => {
      expect(mobileAppCode).toContain('onGoToDashboard={async (approvedData?: any) => {');
      expect(mobileAppCode).toContain('onApprovedContinue={async (approvedData?: any) => {');
      expect(mobileAppCode).toContain('global-client-approval-');
      expect(mobileAppCode).toContain("event: 'CLIENT_APPROVED'");
    });

    it('Client Dashboard Guard does not block verified approved sessions', () => {
      expect(mobileAppCode).toContain("session?.accountStatus === 'APPROVED' && session?.isRegistrationComplete");
      expect(mobileAppCode).toContain('clientService.getClientAccountStatus(checkPhone, true)');
    });
  });
});
