import { supabase } from '../utils/supabase';
import { optimizeFileForUpload } from '../utils/fileCompressor';

// ============================================================================
// TYPES
// ============================================================================

export interface Vehicle {
  id: string;
  registration_number: string;
  vehicle_type: string;
  body_type: string | null;
  make: string | null;
  model: string | null;
  year_of_manufacture: number | null;
  rated_capacity_mt: number;
  minimum_capacity_mt: number;
  rc_number: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  verification_status: 'PENDING_DOCS' | 'APPROVED' | 'BLOCKED' | 'REJECTED';
  gps_installed: boolean;
  eligible_for_operations: boolean;
  
  // Document verification statuses
  rc_verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  insurance_verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  fitness_verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  permit_verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  
  // Document expiry dates
  rc_expiry_date: string | null;
  insurance_expiry_date: string | null;
  fitness_expiry_date: string | null;
  permit_expiry_date: string | null;
  
  insurance_policy_number: string | null;
  
  // Verification metadata
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  
  created_at: string;
  updated_at: string | null;
}

export interface VendorVehicleLink {
  id: string;
  vendor_id: string;
  vehicle_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  tie_up_proof_url: string | null;
  approved_by: string | null;
  requested_at: string;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface VehicleDocument {
  id: string;
  category: string;
  document_type: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT' | 'TIE_UP_AUTHORIZATION';
  reference_id: string;
  file_url: string;
  validity_expiry_date: string | null;
  verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason: string | null;
  uploaded_by: string;
  verified_by: string | null;
  created_at: string;
}

export interface VehicleFilters {
  search?: string;
  vehicleType?: string;
  capacityRange?: { min?: number; max?: number };
  expiryWarning?: 'ALL' | 'EXPIRING_SOON' | 'EXPIRED';
  verificationStatus?: 'PENDING_DOCS' | 'APPROVED' | 'BLOCKED' | 'REJECTED';
  documentStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface VehicleListResponse {
  vehicles: Vehicle[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface VehicleStats {
  totalVehicles: number;
  verifiedVehicles: number;
  pendingVerification: number;
  rejectedVehicles: number;
  verifiedPercentage: number;
  pendingPercentage: number;
}

// ============================================================================
// VEHICLE CRUD OPERATIONS
// ============================================================================

/**
 * Get all vehicles with filters and pagination
 */
export async function getVehicles(
  filters: VehicleFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: 10 }
): Promise<VehicleListResponse> {
  try {
    let query = supabase
      .from('vehicles')
      .select('*', { count: 'exact' });

    // Apply search filter
    if (filters.search) {
      query = query.or(`registration_number.ilike.%${filters.search}%,make.ilike.%${filters.search}%,model.ilike.%${filters.search}%`);
    }

    // Apply vehicle type filter
    if (filters.vehicleType) {
      query = query.eq('vehicle_type', filters.vehicleType);
    }

    // Apply capacity filter
    if (filters.capacityRange) {
      if (filters.capacityRange.min !== undefined) {
        query = query.gte('rated_capacity_mt', filters.capacityRange.min);
      }
      if (filters.capacityRange.max !== undefined) {
        query = query.lte('rated_capacity_mt', filters.capacityRange.max);
      }
    }

    // Apply verification status filter
    if (filters.verificationStatus) {
      query = query.eq('verification_status', filters.verificationStatus);
    }

    // Apply document status filter
    if (filters.documentStatus) {
      query = query.or(
        `rc_verification_status.eq.${filters.documentStatus},insurance_verification_status.eq.${filters.documentStatus},fitness_verification_status.eq.${filters.documentStatus},permit_verification_status.eq.${filters.documentStatus}`
      );
    }

    // Apply expiry warning filter
    if (filters.expiryWarning && filters.expiryWarning !== 'ALL') {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (filters.expiryWarning === 'EXPIRED') {
        query = query.or(
          `rc_expiry_date.lt.${today},insurance_expiry_date.lt.${today},fitness_expiry_date.lt.${today},permit_expiry_date.lt.${today}`
        );
      } else if (filters.expiryWarning === 'EXPIRING_SOON') {
        query = query.or(
          `rc_expiry_date.gte.${today},rc_expiry_date.lte.${thirtyDaysLater},insurance_expiry_date.gte.${today},insurance_expiry_date.lte.${thirtyDaysLater},fitness_expiry_date.gte.${today},fitness_expiry_date.lte.${thirtyDaysLater},permit_expiry_date.gte.${today},permit_expiry_date.lte.${thirtyDaysLater}`
        );
      }
    }

    // Apply sorting
    const sortBy = pagination.sortBy || 'created_at';
    const sortOrder = pagination.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    const total = count || 0;
    const totalPages = Math.ceil(total / pagination.pageSize);

    return {
      vehicles: data || [],
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages,
    };
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    throw error;
  }
}

/**
 * Get vehicle by ID
 */
export async function getVehicleById(vehicleId: string): Promise<Vehicle | null> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    throw error;
  }
}

/**
 * Get vehicle by registration number
 */
export async function getVehicleByRegistration(registrationNumber: string): Promise<Vehicle | null> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('registration_number', registrationNumber)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  } catch (error) {
    console.error('Error fetching vehicle by registration:', error);
    throw error;
  }
}

/**
 * Create new vehicle
 */
export async function createVehicle(vehicle: Partial<Vehicle>): Promise<Vehicle> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .insert([vehicle])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating vehicle:', error);
    throw error;
  }
}

/**
 * Update vehicle
 */
export async function updateVehicle(vehicleId: string, updates: Partial<Vehicle>): Promise<Vehicle> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', vehicleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating vehicle:', error);
    throw error;
  }
}

/**
 * Delete vehicle
 */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicleId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    throw error;
  }
}

// ============================================================================
// VEHICLE STATISTICS
// ============================================================================

/**
 * Get vehicle statistics
 */
export async function getVehicleStats(): Promise<VehicleStats> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('verification_status');

    if (error) throw error;

    const total = data?.length || 0;
    const verified = data?.filter((v: any) => v.verification_status === 'APPROVED').length || 0;
    const pending = data?.filter((v: any) => v.verification_status === 'PENDING_DOCS').length || 0;
    const rejected = data?.filter((v: any) => v.verification_status === 'REJECTED').length || 0;

    return {
      totalVehicles: total,
      verifiedVehicles: verified,
      pendingVerification: pending,
      rejectedVehicles: rejected,
      verifiedPercentage: total > 0 ? Math.round((verified / total) * 100) : 0,
      pendingPercentage: total > 0 ? Math.round((pending / total) * 100) : 0,
    };
  } catch (error) {
    console.error('Error fetching vehicle stats:', error);
    throw error;
  }
}

/**
 * Get count of linked transporters for a vehicle
 */
export async function getVehicleTransporterCount(vehicleId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('vendor_vehicle_links')
      .select('*', { count: 'exact', head: true })
      .eq('vehicle_id', vehicleId)
      .eq('status', 'APPROVED');

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error counting vehicle transporters:', error);
    return 0;
  }
}

// ============================================================================
// VEHICLE DOCUMENTS
// ============================================================================

/**
 * Get vehicle documents
 */
export async function getVehicleDocuments(vehicleId: string): Promise<VehicleDocument[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('category', 'VEHICLE')
      .eq('reference_id', vehicleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vehicle documents:', error);
    throw error;
  }
}

/**
 * Get specific vehicle document by type
 */
export async function getVehicleDocumentByType(
  vehicleId: string,
  documentType: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT'
): Promise<VehicleDocument | null> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('category', 'VEHICLE')
      .eq('reference_id', vehicleId)
      .eq('document_type', documentType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching vehicle document by type:', error);
    throw error;
  }
}

/**
 * Upload vehicle document
 */
export async function uploadVehicleDocument(
  vehicleId: string,
  documentType: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT',
  file: File,
  metadata: {
    validityExpiryDate?: string;
    uploadedBy: string;
    rcNumber?: string;
    policyNumber?: string;
  }
): Promise<VehicleDocument> {
  try {
    // Upload file to storage with automatic image compression
    const uploadReadyFile = await optimizeFileForUpload(file);
    const fileExt = uploadReadyFile.name.split('.').pop();
    const fileName = `${vehicleId}_${documentType}_${Date.now()}.${fileExt}`;
    const filePath = `vehicles/${vehicleId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, uploadReadyFile);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    // Create document record
    const { data, error } = await supabase
      .from('documents')
      .insert([{
        category: 'VEHICLE',
        document_type: documentType,
        reference_id: vehicleId,
        file_url: urlData.publicUrl,
        validity_expiry_date: metadata.validityExpiryDate || null,
        verification_status: 'PENDING',
        uploaded_by: metadata.uploadedBy,
      }])
      .select()
      .single();

    if (error) throw error;

    // Update vehicle with document metadata
    const updateData: any = {};
    
    if (documentType === 'RC' && metadata.rcNumber) {
      updateData.rc_number = metadata.rcNumber;
      updateData.rc_expiry_date = metadata.validityExpiryDate;
    } else if (documentType === 'INSURANCE') {
      updateData.insurance_expiry_date = metadata.validityExpiryDate;
      if (metadata.policyNumber) {
        updateData.insurance_policy_number = metadata.policyNumber;
      }
    } else if (documentType === 'FITNESS') {
      updateData.fitness_expiry_date = metadata.validityExpiryDate;
    } else if (documentType === 'PERMIT') {
      updateData.permit_expiry_date = metadata.validityExpiryDate;
    }

    if (Object.keys(updateData).length > 0) {
      await updateVehicle(vehicleId, updateData);
    }

    return data;
  } catch (error) {
    console.error('Error uploading vehicle document:', error);
    throw error;
  }
}

/**
 * Approve vehicle document
 */
export async function approveVehicleDocument(
  documentId: string,
  vehicleId: string,
  documentType: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT',
  verifiedBy: string
): Promise<void> {
  try {
    // Update document status
    const { error: docError } = await supabase
      .from('documents')
      .update({
        verification_status: 'APPROVED',
        verified_by: verifiedBy,
      })
      .eq('id', documentId);

    if (docError) throw docError;

    // Update vehicle verification status
    const statusField = `${documentType.toLowerCase()}_verification_status`;
    const { error: vehicleError } = await supabase
      .from('vehicles')
      .update({ [statusField]: 'APPROVED' })
      .eq('id', vehicleId);

    if (vehicleError) throw vehicleError;
  } catch (error) {
    console.error('Error approving vehicle document:', error);
    throw error;
  }
}

/**
 * Reject vehicle document
 */
export async function rejectVehicleDocument(
  documentId: string,
  vehicleId: string,
  documentType: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT',
  rejectionReason: string,
  verifiedBy: string
): Promise<void> {
  try {
    // Update document status
    const { error: docError } = await supabase
      .from('documents')
      .update({
        verification_status: 'REJECTED',
        rejection_reason: rejectionReason,
        verified_by: verifiedBy,
      })
      .eq('id', documentId);

    if (docError) throw docError;

    // Update vehicle verification status
    const statusField = `${documentType.toLowerCase()}_verification_status`;
    const { error: vehicleError } = await supabase
      .from('vehicles')
      .update({ [statusField]: 'REJECTED' })
      .eq('id', vehicleId);

    if (vehicleError) throw vehicleError;
  } catch (error) {
    console.error('Error rejecting vehicle document:', error);
    throw error;
  }
}

// ============================================================================
// VEHICLE VERIFICATION
// ============================================================================

/**
 * Update vehicle minimum capacity
 */
export async function updateVehicleMinimumCapacity(
  vehicleId: string,
  minimumCapacityMt: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('vehicles')
      .update({ minimum_capacity_mt: minimumCapacityMt })
      .eq('id', vehicleId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating vehicle minimum capacity:', error);
    throw error;
  }
}

/**
 * Approve vehicle (all documents verified)
 */
export async function approveVehicle(vehicleId: string, verifiedBy: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('vehicles')
      .update({
        verification_status: 'APPROVED',
        eligible_for_operations: true,
        verified_by: verifiedBy,
        verified_at: new Date().toISOString(),
      })
      .eq('id', vehicleId);

    if (error) throw error;
  } catch (error) {
    console.error('Error approving vehicle:', error);
    throw error;
  }
}

/**
 * Reject vehicle
 */
export async function rejectVehicle(
  vehicleId: string,
  rejectionReason: string,
  verifiedBy: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('vehicles')
      .update({
        verification_status: 'REJECTED',
        eligible_for_operations: false,
        rejection_reason: rejectionReason,
        verified_by: verifiedBy,
        verified_at: new Date().toISOString(),
      })
      .eq('id', vehicleId);

    if (error) throw error;
  } catch (error) {
    console.error('Error rejecting vehicle:', error);
    throw error;
  }
}

/**
 * Block vehicle
 */
export async function blockVehicle(vehicleId: string, reason: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('vehicles')
      .update({
        verification_status: 'BLOCKED',
        eligible_for_operations: false,
        rejection_reason: reason,
      })
      .eq('id', vehicleId);

    if (error) throw error;
  } catch (error) {
    console.error('Error blocking vehicle:', error);
    throw error;
  }
}

// ============================================================================
// VENDOR-VEHICLE TIE-UP OPERATIONS
// ============================================================================

/**
 * Get vendor-vehicle tie-up requests
 */
export async function getVendorVehicleTieupRequests(
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
): Promise<any[]> {
  try {
    let query = supabase
      .from('vendor_vehicle_links')
      .select(`
        *,
        vendor:vendor_companies(id, vendor_name, pan, status),
        vehicle:vehicles(*)
      `)
      .order('requested_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vendor-vehicle tie-up requests:', error);
    throw error;
  }
}

/**
 * Get tie-up request by ID
 */
export async function getTieupRequestById(tieupId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_vehicle_links')
      .select(`
        *,
        vendor:vendor_companies(id, vendor_name, pan, gstin, address, status, approved_by, approved_at),
        vehicle:vehicles(*)
      `)
      .eq('id', tieupId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching tie-up request:', error);
    throw error;
  }
}

/**
 * Get vehicle tie-ups (approved links)
 */
export async function getVehicleTieups(vehicleId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('vendor_vehicle_links')
      .select(`
        *,
        vendor:vendor_companies(id, vendor_name, status)
      `)
      .eq('vehicle_id', vehicleId)
      .eq('status', 'APPROVED')
      .order('approved_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vehicle tie-ups:', error);
    throw error;
  }
}

/**
 * Create vendor-vehicle tie-up request
 */
export async function createVendorVehicleTieup(
  vendorId: string,
  vehicleId: string,
  tieUpProofUrl?: string
): Promise<VendorVehicleLink> {
  try {
    const { data, error } = await supabase
      .from('vendor_vehicle_links')
      .insert([{
        vendor_id: vendorId,
        vehicle_id: vehicleId,
        status: 'PENDING',
        tie_up_proof_url: tieUpProofUrl || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating vendor-vehicle tie-up:', error);
    throw error;
  }
}

/**
 * Approve vendor-vehicle tie-up
 */
export async function approveVendorVehicleTieup(
  tieupId: string,
  approvedBy: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('vendor_vehicle_links')
      .update({
        status: 'APPROVED',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', tieupId);

    if (error) throw error;
  } catch (error) {
    console.error('Error approving vendor-vehicle tie-up:', error);
    throw error;
  }
}

/**
 * Reject vendor-vehicle tie-up
 */
export async function rejectVendorVehicleTieup(
  tieupId: string,
  rejectionReason: string,
  rejectedBy: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('vendor_vehicle_links')
      .update({
        status: 'REJECTED',
        rejection_reason: rejectionReason,
        rejected_by: rejectedBy,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', tieupId);

    if (error) throw error;
  } catch (error) {
    console.error('Error rejecting vendor-vehicle tie-up:', error);
    throw error;
  }
}

/**
 * Get tie-up authorization document
 */
export async function getTieupAuthorizationDocument(tieupId: string): Promise<VehicleDocument | null> {
  try {
    const { data: tieup } = await supabase
      .from('vendor_vehicle_links')
      .select('vehicle_id')
      .eq('id', tieupId)
      .single();

    if (!tieup) return null;

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('category', 'VEHICLE')
      .eq('reference_id', tieup.vehicle_id)
      .eq('document_type', 'TIE_UP_AUTHORIZATION')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching tie-up authorization document:', error);
    return null;
  }
}

/**
 * Get tie-up statistics
 */
export async function getTieupStats(): Promise<{
  pendingApproval: number;
  approvedTieups: number;
  rejectedTieups: number;
  totalTieups: number;
}> {
  try {
    const { data, error } = await supabase
      .from('vendor_vehicle_links')
      .select('status');

    if (error) throw error;

    const total = data?.length || 0;
    const pending = data?.filter((t: any) => t.status === 'PENDING').length || 0;
    const approved = data?.filter((t: any) => t.status === 'APPROVED').length || 0;
    const rejected = data?.filter((t: any) => t.status === 'REJECTED').length || 0;

    return {
      pendingApproval: pending,
      approvedTieups: approved,
      rejectedTieups: rejected,
      totalTieups: total,
    };
  } catch (error) {
    console.error('Error fetching tie-up stats:', error);
    throw error;
  }
}
