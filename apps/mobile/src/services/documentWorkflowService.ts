import { supabase, ensureMobileSession } from '../supabase';

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

export interface DualWeighbillSummary {
  dualStatus: DualConfirmationStatus;
  statusLabel: string;
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
  resolutionAuditTrail?: any[];
}

export const documentWorkflowService = {
  // ─── 1. Parse Metadata Safely ─────────────────────────────────────────────
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

  // ─── 2. Map Supabase Document Row to WorkflowDocumentItem ─────────────────
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

  // ─── 3. Fetch All Documents for Booking / Trip ───────────────────────────
  async getBookingDocuments(bookingId: string, tripId?: string): Promise<WorkflowDocumentItem[]> {
    try {
      await ensureMobileSession();
      const ids = [bookingId];
      if (tripId && tripId !== bookingId) {
        ids.push(tripId);
      }

      let query = supabase
        .from('documents')
        .select('*')
        .in('reference_id', ids)
        .order('created_at', { ascending: true });

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map((r: any) => this.mapDocumentRow(r));
    } catch {
      return [];
    }
  },

  // ─── 4. Client Loading Documents ──────────────────────────────────────────
  async getClientLoadingDocuments(bookingId: string, tripId?: string): Promise<{
    invoice?: WorkflowDocumentItem;
    weighbill?: WorkflowDocumentItem;
    materialDocs: WorkflowDocumentItem[];
    allDocs: WorkflowDocumentItem[];
  }> {
    const docs = await this.getBookingDocuments(bookingId, tripId);
    const clientDocs = docs.filter(
      (d) => d.uploaderRole === 'CLIENT' || d.category === 'CLIENT_TRANSIT'
    );

    const invoice = clientDocs.find((d) => d.documentType === 'TAX_INVOICE');
    const weighbill = clientDocs.find((d) => d.documentType === 'LOADING_WEIGHBILL');
    const materialDocs = clientDocs.filter((d) => d.documentType === 'MATERIAL_DOC');

    return { invoice, weighbill, materialDocs, allDocs: clientDocs };
  },

  // ─── 5. Upload Client Loading Document ───────────────────────────────────
  async uploadClientLoadingDocument(input: {
    bookingId: string;
    tripId?: string;
    clientId: string;
    clientName?: string;
    documentType: 'TAX_INVOICE' | 'LOADING_WEIGHBILL' | 'MATERIAL_DOC';
    fileName: string;
    fileUrl: string;
    fileSize?: string;
    recordedWeightMt?: number;
    isConfirmed?: boolean;
  }): Promise<{ success: boolean; documentId?: string; message: string }> {
    try {
      await ensureMobileSession();

      const metadata = {
        uploaderRole: 'CLIENT',
        uploaderId: input.clientId,
        uploaderName: input.clientName || 'Client Consignor',
        recordedWeightMt: input.recordedWeightMt,
        confirmedAt: new Date().toISOString(),
        isConfirmed: input.isConfirmed ?? true,
      };

      const docCode =
        input.documentType === 'LOADING_WEIGHBILL' && input.recordedWeightMt
          ? `WEIGHT:${input.recordedWeightMt.toFixed(2)}MT`
          : `CLI-${input.documentType}-${Date.now().toString().slice(-4)}`;

      // Check if document already exists for replacement
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('reference_id', input.bookingId)
        .eq('document_type', input.documentType)
        .eq('upload_responsibility', 'CLIENT')
        .maybeSingle();

      let docId = '';

      if (existing?.id) {
        // Update / Replace existing document
        const { data: updated, error: uErr } = await supabase
          .from('documents')
          .update({
            file_url: input.fileUrl,
            file_name: input.fileName,
            file_size: input.fileSize || '850 KB',
            document_code: docCode,
            verification_status: 'PENDING',
            rejection_reason: null,
            rejection_notes: JSON.stringify(metadata),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (uErr) throw uErr;
        docId = updated?.id || existing.id;
      } else {
        // Insert new document record
        const { data: inserted, error: iErr } = await supabase
          .from('documents')
          .insert([
            {
              category: 'CLIENT_TRANSIT',
              document_type: input.documentType,
              reference_id: input.bookingId,
              file_url: input.fileUrl,
              file_name: input.fileName,
              file_size: input.fileSize || '850 KB',
              mime_type: 'application/pdf',
              upload_responsibility: 'CLIENT',
              uploaded_by: input.clientId,
              document_code: docCode,
              verification_status: 'PENDING',
              rejection_notes: JSON.stringify(metadata),
            },
          ])
          .select('id')
          .single();

        if (iErr) throw iErr;
        docId = inserted?.id || `doc-${Date.now()}`;
      }

      // If this is a loading weighbill, recalculate dual confirmation status
      if (input.documentType === 'LOADING_WEIGHBILL') {
        await this.evaluateAndUpdateDualStatus(input.bookingId, input.tripId);
      }

      return {
        success: true,
        documentId: docId,
        message: `${input.documentType === 'TAX_INVOICE' ? 'Invoice' : input.documentType === 'LOADING_WEIGHBILL' ? 'Weighbridge Bill' : 'Material Document'} uploaded successfully.`,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Upload failed' };
    }
  },

  // ─── 6. Driver Loading Weighbill Upload & Weight Confirmation ──────────────
  async uploadDriverLoadingWeighbill(input: {
    tripId: string;
    bookingId: string;
    driverId: string;
    driverName?: string;
    fileName: string;
    fileUrl: string;
    grossWeightMt: number;
    tareWeightMt: number;
    recordedWeightMt?: number;
    isConfirmed: boolean;
  }): Promise<{ success: boolean; documentId?: string; message: string }> {
    try {
      await ensureMobileSession();

      const netWeight =
        input.recordedWeightMt ?? Math.max(0, input.grossWeightMt - input.tareWeightMt);

      const metadata = {
        uploaderRole: 'DRIVER',
        uploaderId: input.driverId,
        uploaderName: input.driverName || 'Assigned Driver',
        grossWeightMt: input.grossWeightMt,
        tareWeightMt: input.tareWeightMt,
        recordedWeightMt: netWeight,
        confirmedAt: new Date().toISOString(),
        isConfirmed: input.isConfirmed,
      };

      const docCode = `WEIGHT:${netWeight.toFixed(2)}MT`;

      // Check existing driver weighbill for trip
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('reference_id', input.tripId)
        .eq('document_type', 'LOADING_WEIGHBILL')
        .maybeSingle();

      let docId = '';

      if (existing?.id) {
        const { data: updated, error: uErr } = await supabase
          .from('documents')
          .update({
            file_url: input.fileUrl,
            file_name: input.fileName,
            upload_responsibility: 'DRIVER',
            uploaded_by: input.driverId,
            document_code: docCode,
            verification_status: 'PENDING',
            rejection_reason: null,
            rejection_notes: JSON.stringify(metadata),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (uErr) throw uErr;
        docId = updated?.id || existing.id;
      } else {
        const { data: inserted, error: iErr } = await supabase
          .from('documents')
          .insert([
            {
              category: 'TRIP',
              document_type: 'LOADING_WEIGHBILL',
              reference_id: input.tripId,
              file_url: input.fileUrl,
              file_name: input.fileName,
              upload_responsibility: 'DRIVER',
              uploaded_by: input.driverId,
              document_code: docCode,
              verification_status: 'PENDING',
              rejection_notes: JSON.stringify(metadata),
            },
          ])
          .select('id')
          .single();

        if (iErr) throw iErr;
        docId = inserted?.id || `doc-${Date.now()}`;
      }

      // Record in weighments table
      try {
        await supabase.from('weighments').insert([
          {
            trip_id: input.tripId,
            stage: 'LOADING',
            gross_weight_mt: input.grossWeightMt,
            tare_weight_mt: input.tareWeightMt,
            net_weight_mt: netWeight,
            slip_document_url: input.fileUrl,
            status: 'RECORDED',
          },
        ]);
      } catch { }

      // Recalculate dual confirmation status
      await this.evaluateAndUpdateDualStatus(input.bookingId, input.tripId);

      return {
        success: true,
        documentId: docId,
        message: 'Driver loading weighbill and weight confirmed successfully.',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Driver weighbill upload failed' };
    }
  },

  // ─── 7. Vendor Upload on Behalf of Driver ─────────────────────────────────
  async vendorUploadOnBehalfOfDriver(input: {
    bookingId: string;
    tripId: string;
    vendorId: string;
    vendorName?: string;
    driverId: string;
    driverName?: string;
    fileName: string;
    fileUrl: string;
    grossWeightMt?: number;
    tareWeightMt?: number;
    recordedWeightMt?: number;
  }): Promise<{ success: boolean; documentId?: string; message: string }> {
    try {
      await ensureMobileSession();

      // Authorization guard: verify this trip belongs to this vendor
      const { data: tripRow, error: tErr } = await supabase
        .from('trips')
        .select('id, vendor_id, driver_id')
        .eq('id', input.tripId)
        .maybeSingle();

      if (tErr || !tripRow) {
        throw new Error('Associated trip record not found.');
      }

      if (tripRow.vendor_id && tripRow.vendor_id !== input.vendorId) {
        throw new Error('Unauthorized: You can only upload documents for trips assigned to your fleet.');
      }

      const netWeight =
        input.recordedWeightMt ??
        (input.grossWeightMt && input.tareWeightMt
          ? Math.max(0, input.grossWeightMt - input.tareWeightMt)
          : undefined);

      const metadata = {
        uploaderRole: 'VENDOR_ON_BEHALF_OF_DRIVER',
        vendorId: input.vendorId,
        vendorName: input.vendorName || 'Transport Partner',
        onBehalfOfDriverId: input.driverId,
        targetDriverName: input.driverName || 'Assigned Driver',
        grossWeightMt: input.grossWeightMt,
        tareWeightMt: input.tareWeightMt,
        recordedWeightMt: netWeight,
        vendorUploadedAt: new Date().toISOString(),
        driverConfirmed: false, // Driver independent confirmation remains PENDING!
        isConfirmed: false,
        label: 'Uploaded by Vendor on Behalf of Driver',
      };

      const docCode = netWeight ? `WEIGHT:${netWeight.toFixed(2)}MT` : 'VENDOR_ON_BEHALF';

      // Insert or update document
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('reference_id', input.tripId)
        .eq('document_type', 'LOADING_WEIGHBILL')
        .maybeSingle();

      let docId = '';

      if (existing?.id) {
        const { data: updated, error: uErr } = await supabase
          .from('documents')
          .update({
            file_url: input.fileUrl,
            file_name: input.fileName,
            upload_responsibility: 'VENDOR_ON_BEHALF_OF_DRIVER',
            uploaded_by: input.vendorId,
            document_code: docCode,
            verification_status: 'PENDING',
            rejection_notes: JSON.stringify(metadata),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (uErr) throw uErr;
        docId = updated?.id || existing.id;
      } else {
        const { data: inserted, error: iErr } = await supabase
          .from('documents')
          .insert([
            {
              category: 'TRIP',
              document_type: 'LOADING_WEIGHBILL',
              reference_id: input.tripId,
              file_url: input.fileUrl,
              file_name: input.fileName,
              upload_responsibility: 'VENDOR_ON_BEHALF_OF_DRIVER',
              uploaded_by: input.vendorId,
              document_code: docCode,
              verification_status: 'PENDING',
              rejection_notes: JSON.stringify(metadata),
            },
          ])
          .select('id')
          .single();

        if (iErr) throw iErr;
        docId = inserted?.id || `doc-${Date.now()}`;
      }

      // Record in weighments table with PENDING_DRIVER_CONFIRMATION
      if (input.grossWeightMt && input.tareWeightMt) {
        try {
          await supabase.from('weighments').insert([
            {
              trip_id: input.tripId,
              stage: 'LOADING',
              gross_weight_mt: input.grossWeightMt,
              tare_weight_mt: input.tareWeightMt,
              net_weight_mt: netWeight || 0,
              slip_document_url: input.fileUrl,
              status: 'PENDING_DRIVER_CONFIRMATION',
            },
          ]);
        } catch { }
      }

      // Recalculate dual status
      await this.evaluateAndUpdateDualStatus(input.bookingId, input.tripId);

      return {
        success: true,
        documentId: docId,
        message:
          'Document uploaded on behalf of driver. Notice: Driver independent confirmation is still pending.',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Vendor document upload failed' };
    }
  },

  // ─── 8. Driver Independently Confirms Weight ──────────────────────────────
  async driverIndependentlyConfirmWeight(input: {
    tripId: string;
    bookingId: string;
    driverId: string;
    driverName?: string;
    recordedWeightMt: number;
    grossWeightMt?: number;
    tareWeightMt?: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      await ensureMobileSession();

      const { data: doc, error: dErr } = await supabase
        .from('documents')
        .select('*')
        .eq('reference_id', input.tripId)
        .eq('document_type', 'LOADING_WEIGHBILL')
        .maybeSingle();

      if (dErr || !doc) {
        throw new Error('No weighbill document found for this trip.');
      }

      const existingMeta = this.parseNotes(doc.rejection_notes);
      const updatedMeta = {
        ...existingMeta,
        driverConfirmed: true,
        driverConfirmedAt: new Date().toISOString(),
        driverConfirmedBy: input.driverId,
        driverConfirmedName: input.driverName || 'Driver',
        recordedWeightMt: input.recordedWeightMt,
        isConfirmed: true,
      };

      const docCode = `WEIGHT:${input.recordedWeightMt.toFixed(2)}MT`;

      await supabase
        .from('documents')
        .update({
          document_code: docCode,
          rejection_notes: JSON.stringify(updatedMeta),
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      // Update weighment status
      try {
        await supabase
          .from('weighments')
          .update({
            status: 'RECORDED',
            net_weight_mt: input.recordedWeightMt,
          })
          .eq('trip_id', input.tripId)
          .eq('stage', 'LOADING');
      } catch { }

      // Recalculate dual confirmation status
      await this.evaluateAndUpdateDualStatus(input.bookingId, input.tripId);

      return {
        success: true,
        message: `Loading weight of ${input.recordedWeightMt.toFixed(2)} MT confirmed independently.`,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Driver confirmation failed' };
    }
  },

  // ─── 9. Dual Weighbill Comparison & Status Recalculation ───────────────────
  async evaluateAndUpdateDualStatus(
    bookingId: string,
    tripId?: string
  ): Promise<DualWeighbillSummary> {
    const docs = await this.getBookingDocuments(bookingId, tripId);

    // Client weighbill
    const clientWeighbill = docs.find(
      (d) => d.documentType === 'LOADING_WEIGHBILL' && d.uploaderRole === 'CLIENT'
    );

    // Driver/Vendor weighbill
    const driverWeighbill = docs.find(
      (d) =>
        d.documentType === 'LOADING_WEIGHBILL' &&
        (d.uploaderRole === 'DRIVER' || d.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER')
    );

    const clientWeight = clientWeighbill?.recordedWeightMt;
    const clientConfirmed = !!(clientWeighbill && clientWeighbill.isConfirmed && clientWeight);

    const driverWeight = driverWeighbill?.recordedWeightMt;
    const isVendorOnBehalf = driverWeighbill?.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER';
    const driverConfirmed = !!(
      driverWeighbill &&
      driverWeighbill.isConfirmed &&
      driverWeight &&
      (!isVendorOnBehalf || driverWeighbill.metadata?.driverConfirmed)
    );

    let dualStatus: DualConfirmationStatus = 'PENDING_CONFIRMATION';
    let statusLabel = 'Pending Confirmation';
    let isMatching = false;
    let weightDelta = 0;

    if (isVendorOnBehalf && !driverConfirmed) {
      dualStatus = 'PENDING_DRIVER_CONFIRMATION';
      statusLabel = 'Pending Driver Weight Confirmation';
    } else if (clientConfirmed && driverConfirmed && clientWeight && driverWeight) {
      weightDelta = Math.abs(clientWeight - driverWeight);
      // Tolerance: within 0.05 MT (50 kg) is treated as matching
      if (weightDelta <= 0.05) {
        dualStatus = 'CONFIRMED_BY_BOTH';
        statusLabel = 'Confirmed by Both Parties';
        isMatching = true;
      } else {
        dualStatus = 'WEIGHT_MISMATCH';
        statusLabel = `Weight Mismatch (${weightDelta.toFixed(2)} MT difference)`;
        isMatching = false;
      }
    } else if (clientConfirmed && !driverConfirmed) {
      dualStatus = 'PENDING_CONFIRMATION';
      statusLabel = 'Pending Driver Confirmation';
    } else if (!clientConfirmed && driverConfirmed) {
      dualStatus = 'PENDING_CONFIRMATION';
      statusLabel = 'Pending Client Confirmation';
    }

    // Synchronize verification_status across documents
    const docIdsToUpdate: string[] = [];
    if (clientWeighbill?.id) docIdsToUpdate.push(clientWeighbill.id);
    if (driverWeighbill?.id) docIdsToUpdate.push(driverWeighbill.id);

    if (docIdsToUpdate.length > 0) {
      try {
        await supabase
          .from('documents')
          .update({
            verification_status: dualStatus,
            updated_at: new Date().toISOString(),
          })
          .in('id', docIdsToUpdate);
      } catch { }
    }

    return {
      dualStatus,
      statusLabel,
      clientDoc: clientWeighbill,
      driverDoc: driverWeighbill,
      clientWeightMt: clientWeight,
      driverWeightMt: driverWeight,
      weightDeltaMt: weightDelta,
      isMatching,
      clientConfirmed,
      driverConfirmed,
      uploadedByVendorOnBehalf: isVendorOnBehalf,
      clientConfirmedAt: clientWeighbill?.confirmedAt,
      driverConfirmedAt: driverWeighbill?.confirmedAt,
      resolutionAuditTrail: driverWeighbill?.metadata?.auditTrail || [],
    };
  },

  // ─── 10. Unloading Stage POD Upload ───────────────────────────────────────
  async uploadUnloadingPod(input: {
    tripId: string;
    bookingId: string;
    driverId: string;
    fileName: string;
    fileUrl: string;
    receiverName: string;
    receiverPhone?: string;
    remarks?: string;
    consigneeStampVerified?: boolean;
  }): Promise<{ success: boolean; documentId?: string; message: string }> {
    try {
      await ensureMobileSession();

      const metadata = {
        uploaderRole: 'DRIVER',
        uploaderId: input.driverId,
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        remarks: input.remarks,
        consigneeStampVerified: input.consigneeStampVerified ?? true,
        uploadedAt: new Date().toISOString(),
      };

      const { data: inserted, error: iErr } = await supabase
        .from('documents')
        .insert([
          {
            category: 'TRIP',
            document_type: 'POD_LR',
            reference_id: input.tripId,
            file_url: input.fileUrl,
            file_name: input.fileName,
            file_size: '1.2 MB',
            mime_type: 'application/pdf',
            upload_responsibility: 'DRIVER',
            uploaded_by: input.driverId,
            verification_status: 'PENDING',
            consignee_stamp_verified: input.consigneeStampVerified ?? false,
            rejection_notes: JSON.stringify(metadata),
          },
        ])
        .select('id')
        .single();

      if (iErr) throw iErr;

      // Update trip status to DELIVERED
      await supabase
        .from('trips')
        .update({
          trip_status: 'DELIVERED',
          completed_at: new Date().toISOString(),
        })
        .eq('id', input.tripId);

      // Update booking status
      await supabase
        .from('bookings')
        .update({
          booking_status: 'DELIVERED',
        })
        .eq('id', input.bookingId);

      return {
        success: true,
        documentId: inserted?.id,
        message: 'Signed POD uploaded successfully! Trip submitted for consignee clearance.',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'POD upload failed' };
    }
  },

  // ─── 11. Check If Driver Can Complete Delivery (Requires POD) ─────────────
  async checkCanCompleteDelivery(tripId: string): Promise<{
    canComplete: boolean;
    podDoc?: WorkflowDocumentItem;
    message?: string;
  }> {
    try {
      await ensureMobileSession();

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('reference_id', tripId)
        .in('document_type', ['POD_LR', 'SIGNED_ACKNOWLEDGEMENT', 'PROOF_OF_DELIVERY'])
        .maybeSingle();

      if (!error && data) {
        return {
          canComplete: true,
          podDoc: this.mapDocumentRow(data),
        };
      }

      return {
        canComplete: false,
        message: 'Delivery completion requires capturing and uploading the counter-signed, stamped POD.',
      };
    } catch {
      return { canComplete: false, message: 'Could not verify POD document.' };
    }
  },
};
