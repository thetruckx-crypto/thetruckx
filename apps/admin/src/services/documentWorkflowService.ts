import { supabase, ensureAdminSession } from '../utils/supabase';

export type LoadingDocumentType =
  | 'TAX_INVOICE'
  | 'LOADING_WEIGHBILL'
  | 'MATERIAL_DOC'
  | 'POD_LR'
  | 'SIGNED_ACKNOWLEDGEMENT'
  | 'WAYBILL';

export type UploaderRole =
  | 'CLIENT'
  | 'DRIVER'
  | 'VENDOR_ON_BEHALF_OF_DRIVER'
  | 'ADMIN';

export type DualConfirmationStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED_BY_BOTH'
  | 'WEIGHT_MISMATCH'
  | 'PENDING_DRIVER_CONFIRMATION';

export type VerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'CONFIRMED_BY_BOTH'
  | 'WEIGHT_MISMATCH'
  | 'PENDING_CONFIRMATION'
  | 'PENDING_DRIVER_CONFIRMATION';

export interface WorkflowDocumentItem {
  id: string;
  category: string;
  documentType: LoadingDocumentType;
  referenceId: string;
  fileUrl: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  verificationStatus: VerificationStatus;
  rejectionReason?: string;
  consigneeStampVerified?: boolean;
  uploadedBy: string;
  uploaderRole: UploaderRole;
  uploaderName?: string;
  targetDriverId?: string;
  targetDriverName?: string;
  recordedWeightMt?: number;
  confirmedAt?: string;
  isConfirmed: boolean;
  createdAt: string;
  metadata?: any;
}

export interface DualWeighbillComparison {
  dualStatus: DualConfirmationStatus;
  statusBadge: { bg: string; text: string; label: string };
  clientDoc?: WorkflowDocumentItem | null;
  driverDoc?: WorkflowDocumentItem | null;
  clientWeightMt?: number;
  driverWeightMt?: number;
  weightDeltaMt: number;
  isMatching: boolean;
  clientConfirmed: boolean;
  driverConfirmed: boolean;
  uploadedByVendorOnBehalf: boolean;
  clientConfirmedAt?: string;
  driverConfirmedAt?: string;
  auditTrail: any[];
}

export interface CategorizedBookingDocuments {
  clientLoadingDocs: WorkflowDocumentItem[];
  driverLoadingDocs: WorkflowDocumentItem[];
  vendorUploadedDriverDocs: WorkflowDocumentItem[];
  unloadingDocs: WorkflowDocumentItem[];
  dualComparison: DualWeighbillComparison;
  totalCount: number;
}

export const documentWorkflowService = {
  parseNotes(notesStr?: string | null): any {
    if (!notesStr) return {};
    try {
      if (notesStr.startsWith('{') || notesStr.startsWith('[')) {
        return JSON.parse(notesStr);
      }
    } catch {
      // not JSON
    }
    return { text: notesStr };
  },

  mapDocumentRow(row: any): WorkflowDocumentItem {
    const meta = this.parseNotes(row.rejection_notes);
    let uploaderRole: UploaderRole = 'CLIENT';

    if (row.upload_responsibility === 'DRIVER' || meta.uploaderRole === 'DRIVER') {
      uploaderRole = 'DRIVER';
    } else if (
      row.upload_responsibility === 'VENDOR_ON_BEHALF_OF_DRIVER' ||
      meta.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER' ||
      meta.vendorUploadedOnBehalf
    ) {
      uploaderRole = 'VENDOR_ON_BEHALF_OF_DRIVER';
    } else if (row.upload_responsibility === 'ADMIN' || meta.uploaderRole === 'ADMIN') {
      uploaderRole = 'ADMIN';
    }

    const recordedWeight =
      typeof meta.recordedWeightMt === 'number'
        ? meta.recordedWeightMt
        : row.document_code && row.document_code.startsWith('WEIGHT:')
        ? parseFloat(row.document_code.replace('WEIGHT:', '').replace('MT', ''))
        : undefined;

    const isDriverPending =
      row.verification_status === 'PENDING' &&
      (row.upload_responsibility === 'VENDOR_ON_BEHALF_OF_DRIVER' || meta?.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER' || meta?.vendorUploadedOnBehalf) &&
      !meta?.driverConfirmed;

    return {
      id: row.id,
      category: row.category || 'CLIENT_TRANSIT',
      documentType: row.document_type as LoadingDocumentType,
      referenceId: row.reference_id,
      fileUrl: row.file_url,
      fileName: row.file_name || `${row.document_type || 'DOCUMENT'}.pdf`,
      fileSize: row.file_size || '850 KB',
      mimeType: row.mime_type || 'application/pdf',
      verificationStatus: isDriverPending ? 'PENDING_DRIVER_CONFIRMATION' : ((row.verification_status as VerificationStatus) || 'PENDING'),
      rejectionReason: row.rejection_reason || undefined,
      consigneeStampVerified: !!row.consignee_stamp_verified,
      uploadedBy: row.uploaded_by || '',
      uploaderRole,
      uploaderName: meta.uploaderName,
      targetDriverId: meta.targetDriverId || meta.onBehalfOfDriverId,
      targetDriverName: meta.targetDriverName,
      recordedWeightMt: recordedWeight,
      confirmedAt: meta.confirmedAt || row.created_at,
      isConfirmed: meta.isConfirmed ?? (uploaderRole !== 'VENDOR_ON_BEHALF_OF_DRIVER'),
      createdAt: row.created_at,
      metadata: meta,
    };
  },

  async getBookingDocuments(bookingId: string, tripId?: string): Promise<WorkflowDocumentItem[]> {
    try {
      await ensureAdminSession();
      const ids = [bookingId];
      if (tripId && tripId !== bookingId) {
        ids.push(tripId);
      } else {
        // Find trips associated with booking
        const { data: trips } = await supabase
          .from('trips')
          .select('id')
          .eq('booking_id', bookingId);
        if (trips && trips.length > 0) {
          trips.forEach((t) => ids.push(t.id));
        }
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .in('reference_id', ids)
        .order('created_at', { ascending: true });

      if (error || !data) return [];
      return data.map((r: any) => this.mapDocumentRow(r));
    } catch {
      return [];
    }
  },

  async getCategorizedBookingDocuments(
    bookingId: string,
    tripId?: string
  ): Promise<CategorizedBookingDocuments> {
    const docs = await this.getBookingDocuments(bookingId, tripId);

    const clientLoadingDocs: WorkflowDocumentItem[] = [];
    const driverLoadingDocs: WorkflowDocumentItem[] = [];
    const vendorUploadedDriverDocs: WorkflowDocumentItem[] = [];
    const unloadingDocs: WorkflowDocumentItem[] = [];

    docs.forEach((doc) => {
      const type = doc.documentType;
      const role = doc.uploaderRole;

      if (type === 'POD_LR' || type === 'SIGNED_ACKNOWLEDGEMENT' || (type as any) === 'PROOF_OF_DELIVERY') {
        unloadingDocs.push(doc);
      } else if (role === 'VENDOR_ON_BEHALF_OF_DRIVER') {
        vendorUploadedDriverDocs.push(doc);
      } else if (role === 'DRIVER') {
        driverLoadingDocs.push(doc);
      } else {
        clientLoadingDocs.push(doc);
      }
    });

    // Compute Dual Weighbill Comparison
    const clientWeighbill = clientLoadingDocs.find((d) => d.documentType === 'LOADING_WEIGHBILL');
    const driverOrVendorWeighbill =
      driverLoadingDocs.find((d) => d.documentType === 'LOADING_WEIGHBILL') ||
      vendorUploadedDriverDocs.find((d) => d.documentType === 'LOADING_WEIGHBILL');

    const clientWeight = clientWeighbill?.recordedWeightMt;
    const clientConfirmed = !!(clientWeighbill && clientWeighbill.isConfirmed && clientWeight);

    const driverWeight = driverOrVendorWeighbill?.recordedWeightMt;
    const isVendorOnBehalf =
      driverOrVendorWeighbill?.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER';
    const driverConfirmed = !!(
      driverOrVendorWeighbill &&
      driverOrVendorWeighbill.isConfirmed &&
      driverWeight &&
      (!isVendorOnBehalf || driverOrVendorWeighbill.metadata?.driverConfirmed)
    );

    let dualStatus: DualConfirmationStatus = 'PENDING_CONFIRMATION';
    let statusBadge = { bg: '#FEF3C7', text: '#B45309', label: 'Pending Confirmation' };
    let isMatching = false;
    let weightDelta = 0;

    if (isVendorOnBehalf && !driverConfirmed) {
      dualStatus = 'PENDING_DRIVER_CONFIRMATION';
      statusBadge = {
        bg: '#FED7AA',
        text: '#C2410C',
        label: 'Uploaded by Vendor — Pending Driver Confirmation',
      };
    } else if (clientConfirmed && driverConfirmed && clientWeight && driverWeight) {
      weightDelta = Math.abs(clientWeight - driverWeight);
      if (weightDelta <= 0.05) {
        dualStatus = 'CONFIRMED_BY_BOTH';
        statusBadge = { bg: '#DCFCE7', text: '#15803D', label: 'Confirmed by Both Parties' };
        isMatching = true;
      } else {
        dualStatus = 'WEIGHT_MISMATCH';
        statusBadge = {
          bg: '#FEE2E2',
          text: '#B91C1C',
          label: `Weight Mismatch (Δ ${weightDelta.toFixed(2)} MT)`,
        };
        isMatching = false;
      }
    } else if (clientConfirmed && !driverConfirmed) {
      dualStatus = 'PENDING_CONFIRMATION';
      statusBadge = { bg: '#FEF3C7', text: '#B45309', label: 'Pending Driver Confirmation' };
    } else if (!clientConfirmed && driverConfirmed) {
      dualStatus = 'PENDING_CONFIRMATION';
      statusBadge = { bg: '#FEF3C7', text: '#B45309', label: 'Pending Client Confirmation' };
    }

    const dualComparison: DualWeighbillComparison = {
      dualStatus,
      statusBadge,
      clientDoc: clientWeighbill || null,
      driverDoc: driverOrVendorWeighbill || null,
      clientWeightMt: clientWeight,
      driverWeightMt: driverWeight,
      weightDeltaMt: weightDelta,
      isMatching,
      clientConfirmed,
      driverConfirmed,
      uploadedByVendorOnBehalf: isVendorOnBehalf,
      clientConfirmedAt: clientWeighbill?.confirmedAt,
      driverConfirmedAt: driverOrVendorWeighbill?.confirmedAt,
      auditTrail: driverOrVendorWeighbill?.metadata?.auditTrail || [],
    };

    return {
      clientLoadingDocs,
      driverLoadingDocs,
      vendorUploadedDriverDocs,
      unloadingDocs,
      dualComparison,
      totalCount: docs.length,
    };
  },

  async adminVerifyDocument(
    docId: string,
    adminId: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await ensureAdminSession();

      const { data: prevDoc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', docId)
        .single();

      const { error } = await supabase
        .from('documents')
        .update({
          verification_status: 'VERIFIED',
          verified_by: adminId,
          verified_at: new Date().toISOString(),
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', docId);

      if (error) throw error;

      // Audit Log
      try {
        await supabase.from('audit_logs').insert([
          {
            user_id: adminId,
            user_role: 'ADMIN',
            action: 'DOCUMENT_VERIFIED',
            entity_type: 'DOCUMENT',
            entity_id: docId,
            payload_before: prevDoc,
            payload_after: { verification_status: 'VERIFIED', verified_by: adminId, notes },
          },
        ]);
      } catch { }

      return { success: true, message: 'Document verified and approved successfully.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Verification failed.' };
    }
  },

  async adminRejectDocument(
    docId: string,
    adminId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await ensureAdminSession();

      const { data: prevDoc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', docId)
        .single();

      const { error } = await supabase
        .from('documents')
        .update({
          verification_status: 'REJECTED',
          rejection_reason: reason,
          verified_by: adminId,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', docId);

      if (error) throw error;

      // Audit Log
      try {
        await supabase.from('audit_logs').insert([
          {
            user_id: adminId,
            user_role: 'ADMIN',
            action: 'DOCUMENT_REJECTED',
            entity_type: 'DOCUMENT',
            entity_id: docId,
            payload_before: prevDoc,
            payload_after: { verification_status: 'REJECTED', rejection_reason: reason },
          },
        ]);
      } catch { }

      return { success: true, message: `Document rejected: ${reason}. Notification queued for re-upload.` };
    } catch (e: any) {
      return { success: false, message: e.message || 'Rejection update failed.' };
    }
  },

  async adminResolveDiscrepancy(input: {
    bookingId: string;
    tripId?: string;
    adminId: string;
    adminName: string;
    action: 'RESOLVE_MATCH' | 'ACCEPT_CLIENT_WEIGHT' | 'ACCEPT_DRIVER_WEIGHT' | 'REJECT_AND_REQUEST_REUPLOAD';
    resolvedWeightMt?: number;
    reason: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      await ensureAdminSession();

      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .or(`reference_id.eq.${input.bookingId},reference_id.eq.${input.tripId || input.bookingId}`)
        .eq('document_type', 'LOADING_WEIGHBILL');

      const auditEntry = {
        action: input.action,
        resolvedBy: input.adminName || 'TRUCKS Admin',
        resolvedById: input.adminId,
        resolvedWeightMt: input.resolvedWeightMt,
        reason: input.reason,
        timestamp: new Date().toISOString(),
      };

      if (docs && docs.length > 0) {
        for (const doc of docs) {
          const currentMeta = this.parseNotes(doc.rejection_notes);
          const history = currentMeta.auditTrail || [];
          history.push(auditEntry);

          const newStatus =
            input.action === 'REJECT_AND_REQUEST_REUPLOAD' ? 'REJECTED' : 'CONFIRMED_BY_BOTH';

          await supabase
            .from('documents')
            .update({
              verification_status: newStatus,
              document_code: input.resolvedWeightMt ? `WEIGHT:${input.resolvedWeightMt.toFixed(2)}MT` : doc.document_code,
              rejection_notes: JSON.stringify({
                ...currentMeta,
                auditTrail: history,
                resolvedWeightMt: input.resolvedWeightMt,
                resolutionNote: input.reason,
              }),
              verified_by: input.adminId,
              verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', doc.id);
        }
      }

      // Record in audit_logs
      try {
        await supabase.from('audit_logs').insert([
          {
            user_id: input.adminId,
            user_role: 'ADMIN',
            action: 'WEIGHBILL_DISCREPANCY_RESOLVED',
            entity_type: 'BOOKING_WEIGHBILL',
            entity_id: input.bookingId,
            payload_before: { docsCount: docs?.length },
            payload_after: auditEntry,
          },
        ]);
      } catch { }

      return {
        success: true,
        message: `Discrepancy resolved via ${input.action}. Audit trail recorded.`,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Resolution failed.' };
    }
  },
};
