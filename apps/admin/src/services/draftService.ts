/**
 * Admin Registration Draft Service
 * Handles database-backed persistence of incomplete Add Client and Add Vendor registrations.
 */

import { apiFetch } from '../utils/api';

export interface AdminRegistrationDraft {
  id: string;
  entityType: 'CLIENT' | 'VENDOR';
  entity_type?: 'CLIENT' | 'VENDOR';
  title: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
  stepProgress?: number | string;
  step_progress?: number | string;
  completionPercentage?: number;
  completion_percentage?: number;
  formData?: any;
  form_data?: any;
  documentRefs?: any;
  document_refs?: any;
  vehicleDetails?: any[];
  vehicle_details?: any[];
  operatingLanes?: any[];
  operating_lanes?: any[];
  selectedServices?: any[];
  selected_services?: any[];
  createdBy?: string;
  created_by?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

function normalizeDraft(d: any): AdminRegistrationDraft {
  if (!d) return d;
  const entityType = d.entityType || d.entity_type || 'CLIENT';
  const step = d.stepProgress ?? d.step_progress ?? 'In Progress';
  const pct = d.completionPercentage ?? d.completion_percentage ?? 20;
  const form = d.formData ?? d.form_data ?? {};
  const docRefs = d.documentRefs ?? d.document_refs ?? [];
  const vehicles = d.vehicleDetails ?? d.vehicle_details ?? [];
  const lanes = d.operatingLanes ?? d.operating_lanes ?? [];
  const services = d.selectedServices ?? d.selected_services ?? [];
  const crAt = d.createdAt || d.created_at || new Date().toISOString();
  const upAt = d.updatedAt || d.updated_at || new Date().toISOString();

  return {
    ...d,
    id: d.id,
    entityType,
    entity_type: entityType,
    title: d.title || 'Untitled Registration Draft',
    status: d.status || 'DRAFT',
    stepProgress: step,
    step_progress: step,
    completionPercentage: pct,
    completion_percentage: pct,
    formData: form,
    form_data: form,
    documentRefs: docRefs,
    document_refs: docRefs,
    vehicleDetails: vehicles,
    vehicle_details: vehicles,
    operatingLanes: lanes,
    operating_lanes: lanes,
    selectedServices: services,
    selected_services: services,
    createdBy: d.createdBy || d.created_by || 'Admin Desk',
    created_by: d.created_by || d.createdBy || 'Admin Desk',
    createdAt: crAt,
    created_at: crAt,
    updatedAt: upAt,
    updated_at: upAt,
  };
}

export const draftService = {
  /**
   * Fetch all active drafts, optionally filtered by entity type (CLIENT | VENDOR)
   */
  async getDrafts(entityType?: 'CLIENT' | 'VENDOR'): Promise<AdminRegistrationDraft[]> {
    try {
      const url = entityType ? `/admin/drafts?entityType=${entityType}` : '/admin/drafts';
      const res = await apiFetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch drafts: ${res.statusText}`);
      }
      const data = await res.json();
      const list = Array.isArray(data.drafts) ? data.drafts : [];
      return list.map(normalizeDraft);
    } catch (err) {
      console.warn('[DraftService] getDrafts error:', err);
      // Fallback to local storage if network or server error
      const localKey = entityType ? `necl_admin_drafts_${entityType}` : 'necl_admin_drafts_all';
      try {
        const cached = localStorage.getItem(localKey);
        const parsed = cached ? JSON.parse(cached) : [];
        return Array.isArray(parsed) ? parsed.map(normalizeDraft) : [];
      } catch {
        return [];
      }
    }
  },

  /**
   * Fetch single draft by ID
   */
  async getDraftById(id: string): Promise<AdminRegistrationDraft | null> {
    try {
      const res = await apiFetch(`/admin/drafts/${id}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed to fetch draft ${id}: ${res.statusText}`);
      }
      const data = await res.json();
      return data.draft ? normalizeDraft(data.draft) : null;
    } catch (err) {
      console.warn('[DraftService] getDraftById error:', err);
      return null;
    }
  },

  /**
   * Save or update draft in database
   */
  async saveDraft(params: {
    id?: string;
    entityType: 'CLIENT' | 'VENDOR';
    title?: string;
    stepProgress?: number | string;
    completionPercentage?: number;
    formData: any;
    documentRefs?: any;
    vehicleDetails?: any[];
    operatingLanes?: any[];
    selectedServices?: any[];
  }): Promise<AdminRegistrationDraft & { success: boolean; draft: AdminRegistrationDraft }> {
    const res = await apiFetch('/admin/drafts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to save draft');
    }

    const normalized = normalizeDraft(data.draft || data);
    try {
      const localKey = `necl_admin_active_draft_${params.entityType}`;
      localStorage.setItem(localKey, JSON.stringify(normalized));
    } catch {}

    return Object.assign(normalized, { success: true, draft: normalized });
  },

  /**
   * Delete draft permanently
   */
  async deleteDraft(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await apiFetch(`/admin/drafts/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to delete draft');
      }
      return { success: true };
    } catch (err: any) {
      console.error('[DraftService] deleteDraft error:', err);
      return { success: false, error: err.message || 'Could not delete draft.' };
    }
  },

  /**
   * Mark draft completed and remove after successful final submission
   */
  async completeDraft(id: string): Promise<void> {
    try {
      await apiFetch(`/admin/drafts/${id}/complete`, {
        method: 'POST',
      });
    } catch (err) {
      console.warn('[DraftService] completeDraft notice:', err);
    }
  },

  /**
   * Local instant recovery helpers (preserves state during page refresh / tab switch)
   */
  saveLocalDraftBackup(entityType: 'CLIENT' | 'VENDOR', data: any): void {
    try {
      sessionStorage.setItem(`necl_admin_form_backup_${entityType}`, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch {}
  },

  getLocalDraftBackup(entityType: 'CLIENT' | 'VENDOR'): any | null {
    try {
      const item = sessionStorage.getItem(`necl_admin_form_backup_${entityType}`);
      if (!item) return null;
      const parsed = JSON.parse(item);
      // Valid for 24 hours
      if (Date.now() - parsed.timestamp < 86400000) {
        return parsed.data;
      }
      sessionStorage.removeItem(`necl_admin_form_backup_${entityType}`);
      return null;
    } catch {
      return null;
    }
  },

  clearLocalDraftBackup(entityType: 'CLIENT' | 'VENDOR'): void {
    try {
      sessionStorage.removeItem(`necl_admin_form_backup_${entityType}`);
    } catch {}
  },

  setLocalBackup(entityType: 'CLIENT' | 'VENDOR', data: any): void {
    this.saveLocalDraftBackup(entityType, data);
  },

  getLocalBackup(entityType: 'CLIENT' | 'VENDOR'): any | null {
    return this.getLocalDraftBackup(entityType);
  },

  clearLocalBackup(entityType: 'CLIENT' | 'VENDOR'): void {
    this.clearLocalDraftBackup(entityType);
  },
};

