import { MobileRole, ScreenId, AppNotificationItem } from '../types';

// ============================================================================
// 1. Client App Notification Keys (27 Items)
// ============================================================================
export type ClientNotificationType =
  | 'CLIENT_REGISTRATION_SUCCESSFUL'
  | 'CLIENT_PROFILE_VERIFICATION_COMPLETED'
  | 'CLIENT_REQUIREMENT_SUBMITTED_SUCCESSFULLY'
  | 'CLIENT_REQUIREMENT_UNDER_REVIEW'
  | 'CLIENT_REQUIREMENT_APPROVED'
  | 'CLIENT_REQUIREMENT_REJECTED'
  | 'CLIENT_QUOTATION_RECEIVED'
  | 'CLIENT_QUOTATION_UPDATED'
  | 'CLIENT_QUOTATION_EXPIRING_SOON'
  | 'CLIENT_QUOTATION_ACCEPTED'
  | 'CLIENT_QUOTATION_REJECTED'
  | 'CLIENT_BOOKING_CONFIRMED'
  | 'CLIENT_BOOKING_UPDATED'
  | 'CLIENT_BOOKING_CANCELLED'
  | 'CLIENT_VEHICLE_ASSIGNED'
  | 'CLIENT_DRIVER_ASSIGNED'
  | 'CLIENT_VEHICLE_DISPATCHED'
  | 'CLIENT_LOADING_STARTED'
  | 'CLIENT_LOADING_COMPLETED'
  | 'CLIENT_TRIP_STARTED'
  | 'CLIENT_TRIP_DELAYED'
  | 'CLIENT_VEHICLE_REACHED_DESTINATION'
  | 'CLIENT_UNLOADING_STARTED'
  | 'CLIENT_UNLOADING_COMPLETED'
  | 'CLIENT_PAYMENT_DUE'
  | 'CLIENT_PAYMENT_RECEIVED'
  | 'CLIENT_BOOKING_COMPLETED';

// ============================================================================
// 2. Vendor App Notification Keys (34 Items)
// ============================================================================
export type VendorNotificationType =
  | 'VENDOR_REGISTRATION_SUCCESSFUL'
  | 'VENDOR_VERIFICATION_PENDING'
  | 'VENDOR_APPROVED'
  | 'VENDOR_REJECTED'
  | 'VENDOR_ADDITIONAL_DOCUMENTS_REQUIRED'
  | 'VENDOR_ACCOUNT_ACCESS_ENABLED'
  | 'VENDOR_NEW_TRANSPORT_REQUIREMENT_RECEIVED'
  | 'VENDOR_REQUIREMENT_DEADLINE_APPROACHING'
  | 'VENDOR_REQUIREMENT_WITHDRAWN'
  | 'VENDOR_REQUIREMENT_CLOSED'
  | 'VENDOR_QUOTATION_SUBMITTED_SUCCESSFULLY'
  | 'VENDOR_QUOTATION_ACCEPTED'
  | 'VENDOR_QUOTATION_REJECTED'
  | 'VENDOR_QUOTATION_REVISION_REQUESTED'
  | 'VENDOR_BOOKING_CONFIRMED'
  | 'VENDOR_VEHICLE_DETAILS_REQUIRED'
  | 'VENDOR_DRIVER_DETAILS_REQUIRED'
  | 'VENDOR_VEHICLE_ASSIGNED'
  | 'VENDOR_DRIVER_ASSIGNED'
  | 'VENDOR_VEHICLE_DRIVER_DETAILS_REJECTED'
  | 'VENDOR_LOADING_SCHEDULE_UPDATED'
  | 'VENDOR_TRIP_STARTED'
  | 'VENDOR_TRIP_DELAYED'
  | 'VENDOR_UNLOADING_COMPLETED'
  | 'VENDOR_WEIGHT_BILL_UPLOAD_REQUIRED'
  | 'VENDOR_POD_UPLOAD_REQUIRED'
  | 'VENDOR_SIGNED_LR_UPLOAD_REQUIRED'
  | 'VENDOR_DOCUMENT_VERIFICATION_COMPLETED'
  | 'VENDOR_DOCUMENT_REJECTED'
  | 'VENDOR_TRIP_CLOSURE_PENDING'
  | 'VENDOR_TRIP_CLOSED'
  | 'VENDOR_PAYMENT_STATUS_UPDATED'
  | 'VENDOR_PAYMENT_RECEIVED'
  | 'VENDOR_PAYMENT_OVERDUE';

// ============================================================================
// 3. Driver App Notification Keys (33 Items)
// ============================================================================
export type DriverNotificationType =
  | 'DRIVER_REGISTRATION_SUCCESSFUL'
  | 'DRIVER_VERIFICATION_PENDING'
  | 'DRIVER_APPROVED'
  | 'DRIVER_REJECTED'
  | 'DRIVER_ADDITIONAL_DOCUMENTS_REQUIRED'
  | 'DRIVER_ACCOUNT_ACCESS_ENABLED'
  | 'DRIVER_NEW_TRIP_ASSIGNMENT'
  | 'DRIVER_TRIP_ASSIGNMENT_UPDATED'
  | 'DRIVER_TRIP_ASSIGNMENT_CANCELLED'
  | 'DRIVER_VEHICLE_ASSIGNED'
  | 'DRIVER_LOADING_LOCATION_UPDATED'
  | 'DRIVER_LOADING_SCHEDULE_REMINDER'
  | 'DRIVER_ARRIVAL_AT_LOADING_LOCATION'
  | 'DRIVER_LOADING_STARTED'
  | 'DRIVER_LOADING_COMPLETED'
  | 'DRIVER_REQUIRED_DOCUMENTS_PENDING'
  | 'DRIVER_PRE_TRIP_VERIFICATION_REMINDER'
  | 'DRIVER_TRIP_STARTED_SUCCESSFULLY'
  | 'DRIVER_ROUTE_UPDATED'
  | 'DRIVER_DESTINATION_UPDATED'
  | 'DRIVER_TRIP_DELAYED'
  | 'DRIVER_EMERGENCY_INCIDENT_ALERT'
  | 'DRIVER_REACHED_DESTINATION'
  | 'DRIVER_UNLOADING_STARTED'
  | 'DRIVER_UNLOADING_COMPLETED'
  | 'DRIVER_WEIGHT_BILL_UPLOAD_REMINDER'
  | 'DRIVER_POD_UPLOAD_REMINDER'
  | 'DRIVER_SIGNED_LR_UPLOAD_REMINDER'
  | 'DRIVER_DOCUMENT_UPLOADED_SUCCESSFULLY'
  | 'DRIVER_DOCUMENT_REJECTED'
  | 'DRIVER_DOCUMENT_VERIFIED'
  | 'DRIVER_TRIP_COMPLETED'
  | 'DRIVER_TRIP_CLOSED';

export type NotificationEventType =
  | ClientNotificationType
  | VendorNotificationType
  | DriverNotificationType;

export interface NotificationTemplate {
  type: NotificationEventType;
  role: MobileRole;
  name: string;
  title: string;
  subtitle: string;
  content: string;
  category: 'shipment' | 'booking' | 'system' | 'driver' | 'account' | 'quotation' | 'requirement' | 'payment' | 'document';
  actionScreen?: ScreenId;
  isImportant?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT NOTIFICATION TEMPLATES (27)
// ─────────────────────────────────────────────────────────────────────────────
export const CLIENT_NOTIFICATIONS: Record<ClientNotificationType, NotificationTemplate> = {
  CLIENT_REGISTRATION_SUCCESSFUL: {
    type: 'CLIENT_REGISTRATION_SUCCESSFUL',
    role: 'CLIENT',
    name: 'Registration Successful',
    title: 'Registration Successful 🎉',
    subtitle: 'Welcome to THE TRUCKX! Your client profile is active.',
    content: 'Your shipper account has been successfully created. You can now post transport requirements, receive bids, and manage freight operations.',
    category: 'system',
    actionScreen: 'CLIENT_DASHBOARD',
  },
  CLIENT_PROFILE_VERIFICATION_COMPLETED: {
    type: 'CLIENT_PROFILE_VERIFICATION_COMPLETED',
    role: 'CLIENT',
    name: 'Profile Verification Completed',
    title: 'Profile Verification Completed ✅',
    subtitle: 'Your KYC & company documents are verified.',
    content: 'Your company documentation and GST details have been verified by THE TRUCKX compliance team. You now have full platform privileges.',
    category: 'system',
    actionScreen: 'CLIENT_DASHBOARD',
  },
  CLIENT_REQUIREMENT_SUBMITTED_SUCCESSFULLY: {
    type: 'CLIENT_REQUIREMENT_SUBMITTED_SUCCESSFULLY',
    role: 'CLIENT',
    name: 'Requirement Submitted Successfully',
    title: 'Requirement Submitted Successfully 📋',
    subtitle: 'Requirement #{refId} is now live in the system.',
    content: 'Your freight requirement from {origin} to {destination} for {material} has been submitted successfully and is queued for verification.',
    category: 'requirement',
    actionScreen: 'MY_REQUIREMENTS',
  },
  CLIENT_REQUIREMENT_UNDER_REVIEW: {
    type: 'CLIENT_REQUIREMENT_UNDER_REVIEW',
    role: 'CLIENT',
    name: 'Requirement Under Review',
    title: 'Requirement Under Review 🔍',
    subtitle: 'Requirement #{refId} is being audited by operations.',
    content: 'Our logistics desk is reviewing route feasibility, toll corridors, and vehicle compatibility for Requirement #{refId}.',
    category: 'requirement',
    actionScreen: 'REQUIREMENT_DETAILS',
  },
  CLIENT_REQUIREMENT_APPROVED: {
    type: 'CLIENT_REQUIREMENT_APPROVED',
    role: 'CLIENT',
    name: 'Requirement Approved',
    title: 'Requirement Approved 🟢',
    subtitle: 'Requirement #{refId} is published for vendor bidding.',
    content: 'Your requirement is now open for verified fleet partners to place commercial quotations.',
    category: 'requirement',
    actionScreen: 'QUOTATIONS_LIST',
  },
  CLIENT_REQUIREMENT_REJECTED: {
    type: 'CLIENT_REQUIREMENT_REJECTED',
    role: 'CLIENT',
    name: 'Requirement Rejected',
    title: 'Requirement Rejected ❌',
    subtitle: 'Action needed on Requirement #{refId}.',
    content: 'Requirement #{refId} could not be approved due to: {reason}. Please edit specifications and resubmit.',
    category: 'requirement',
    actionScreen: 'REQUIREMENT_DETAILS',
    isImportant: true,
  },
  CLIENT_QUOTATION_RECEIVED: {
    type: 'CLIENT_QUOTATION_RECEIVED',
    role: 'CLIENT',
    name: 'Quotation Received',
    title: 'Quotation Received 💬',
    subtitle: 'New bid of ₹{amount} received for #{refId}.',
    content: 'A verified transporter submitted a competitive commercial quote for route {origin} → {destination}. Compare bids now.',
    category: 'quotation',
    actionScreen: 'QUOTATIONS_LIST',
    isImportant: true,
  },
  CLIENT_QUOTATION_UPDATED: {
    type: 'CLIENT_QUOTATION_UPDATED',
    role: 'CLIENT',
    name: 'Quotation Updated',
    title: 'Quotation Updated 🔄',
    subtitle: 'Revised quotation received for Requirement #{refId}.',
    content: 'A transporter updated their commercial bid terms or pricing to ₹{amount}. Check revised quote details.',
    category: 'quotation',
    actionScreen: 'QUOTATION_DETAILS',
  },
  CLIENT_QUOTATION_EXPIRING_SOON: {
    type: 'CLIENT_QUOTATION_EXPIRING_SOON',
    role: 'CLIENT',
    name: 'Quotation Expiring Soon',
    title: 'Quotation Expiring Soon ⏳',
    subtitle: 'Quote for Requirement #{refId} expires in 2 hours.',
    content: 'Lock in the current freight rate of ₹{amount} before the transporter\'s validity window closes.',
    category: 'quotation',
    actionScreen: 'QUOTATIONS_LIST',
  },
  CLIENT_QUOTATION_ACCEPTED: {
    type: 'CLIENT_QUOTATION_ACCEPTED',
    role: 'CLIENT',
    name: 'Quotation Accepted',
    title: 'Quotation Accepted 🤝',
    subtitle: 'Bid of ₹{amount} accepted. Booking created.',
    content: 'You accepted quote from {transporter} for ₹{amount}. Booking order #{refId} is being generated.',
    category: 'quotation',
    actionScreen: 'BOOKING_CONFIRMATION',
  },
  CLIENT_QUOTATION_REJECTED: {
    type: 'CLIENT_QUOTATION_REJECTED',
    role: 'CLIENT',
    name: 'Quotation Rejected',
    title: 'Quotation Rejected 🚫',
    subtitle: 'Quotation for Requirement #{refId} was declined.',
    content: 'You have declined this quotation. Alternative bids remain available on your dashboard.',
    category: 'quotation',
    actionScreen: 'QUOTATIONS_LIST',
  },
  CLIENT_BOOKING_CONFIRMED: {
    type: 'CLIENT_BOOKING_CONFIRMED',
    role: 'CLIENT',
    name: 'Booking Confirmed',
    title: 'Booking Confirmed 🚛',
    subtitle: 'Booking #{refId} confirmed. Lorry allocation underway.',
    content: 'Booking #{refId} is confirmed. Transporter is preparing vehicle and driver assignment.',
    category: 'booking',
    actionScreen: 'MY_BOOKINGS',
    isImportant: true,
  },
  CLIENT_BOOKING_UPDATED: {
    type: 'CLIENT_BOOKING_UPDATED',
    role: 'CLIENT',
    name: 'Booking Updated',
    title: 'Booking Updated 📝',
    subtitle: 'Schedule or route updated for Booking #{refId}.',
    content: 'Booking #{refId} details have been updated. Review the updated dispatch schedule and instructions.',
    category: 'booking',
    actionScreen: 'BOOKING_DETAILS',
  },
  CLIENT_BOOKING_CANCELLED: {
    type: 'CLIENT_BOOKING_CANCELLED',
    role: 'CLIENT',
    name: 'Booking Cancelled',
    title: 'Booking Cancelled ⚠️',
    subtitle: 'Booking #{refId} has been cancelled.',
    content: 'Booking #{refId} has been cancelled. Any applicable freight advances or ledger adjustments have been processed.',
    category: 'booking',
    actionScreen: 'MY_BOOKINGS',
    isImportant: true,
  },
  CLIENT_VEHICLE_ASSIGNED: {
    type: 'CLIENT_VEHICLE_ASSIGNED',
    role: 'CLIENT',
    name: 'Vehicle Assigned',
    title: 'Vehicle Assigned 🚚',
    subtitle: 'Lorry {vehicleNumber} assigned to Booking #{refId}.',
    content: 'Transporter has allocated {vehicleNumber} ({vehicleType}) for your shipment.',
    category: 'shipment',
    actionScreen: 'BOOKING_DETAILS',
  },
  CLIENT_DRIVER_ASSIGNED: {
    type: 'CLIENT_DRIVER_ASSIGNED',
    role: 'CLIENT',
    name: 'Driver Assigned',
    title: 'Driver Assigned 👤',
    subtitle: 'Captain {driverName} assigned to your load.',
    content: 'Driver {driverName} ({driverPhone}) has been assigned. Ready for loading bay reporting.',
    category: 'shipment',
    actionScreen: 'BOOKING_DETAILS',
  },
  CLIENT_VEHICLE_DISPATCHED: {
    type: 'CLIENT_VEHICLE_DISPATCHED',
    role: 'CLIENT',
    name: 'Vehicle Dispatched',
    title: 'Vehicle Dispatched 🚀',
    subtitle: 'Lorry {vehicleNumber} is en route to pickup point.',
    content: 'Assigned vehicle has been dispatched from transporter yard to your loading warehouse at {origin}.',
    category: 'shipment',
    actionScreen: 'SHIPMENT_TRACKING',
  },
  CLIENT_LOADING_STARTED: {
    type: 'CLIENT_LOADING_STARTED',
    role: 'CLIENT',
    name: 'Loading Started',
    title: 'Loading Started 📦',
    subtitle: 'Cargo loading begun for Booking #{refId}.',
    content: 'Driver has reported at {origin}. Material loading and physical package count are underway.',
    category: 'shipment',
    actionScreen: 'SHIPMENT_TRACKING',
  },
  CLIENT_LOADING_COMPLETED: {
    type: 'CLIENT_LOADING_COMPLETED',
    role: 'CLIENT',
    name: 'Loading Completed',
    title: 'Loading Completed 🔒',
    subtitle: 'Consignment sealed and e-waybill verified.',
    content: 'Cargo loading finished. Vehicle tarping, weight verification, and dispatch clearance complete.',
    category: 'shipment',
    actionScreen: 'SHIPMENT_TRACKING',
  },
  CLIENT_TRIP_STARTED: {
    type: 'CLIENT_TRIP_STARTED',
    role: 'CLIENT',
    name: 'Trip Started',
    title: 'Trip Started 🛣️',
    subtitle: 'Consignment is in transit. Live GPS tracking active.',
    content: 'Lorry {vehicleNumber} has departed origin warehouse. Track live telemetry on your shipment map.',
    category: 'shipment',
    actionScreen: 'SHIPMENT_TRACKING',
    isImportant: true,
  },
  CLIENT_TRIP_DELAYED: {
    type: 'CLIENT_TRIP_DELAYED',
    role: 'CLIENT',
    name: 'Trip Delayed',
    title: 'Trip Delayed ⏱️',
    subtitle: 'Transit delay reported on Booking #{refId}.',
    content: 'Consignment delayed due to: {reason}. Revised ETA is {eta}. Telematics desk is monitoring.',
    category: 'shipment',
    actionScreen: 'SHIPMENT_TRACKING',
    isImportant: true,
  },
  CLIENT_VEHICLE_REACHED_DESTINATION: {
    type: 'CLIENT_VEHICLE_REACHED_DESTINATION',
    role: 'CLIENT',
    name: 'Vehicle Reached Destination',
    title: 'Vehicle Reached Destination 📍',
    subtitle: 'Lorry arrived at destination warehouse.',
    content: 'Lorry {vehicleNumber} has arrived at {destination} unloading dock. Awaiting warehouse clearance.',
    category: 'shipment',
    actionScreen: 'SHIPMENT_TRACKING',
  },
  CLIENT_UNLOADING_STARTED: {
    type: 'CLIENT_UNLOADING_STARTED',
    role: 'CLIENT',
    name: 'Unloading Started',
    title: 'Unloading Started 🏗️',
    subtitle: 'Cargo unloading commenced at destination.',
    content: 'Receiving team has initiated consignment unloading and physical package inspection at {destination}.',
    category: 'shipment',
    actionScreen: 'SHIPMENT_TRACKING',
  },
  CLIENT_UNLOADING_COMPLETED: {
    type: 'CLIENT_UNLOADING_COMPLETED',
    role: 'CLIENT',
    name: 'Unloading Completed',
    title: 'Unloading Completed 📦',
    subtitle: 'All packages discharged successfully.',
    content: 'Material safely unloaded at destination dock. Awaiting consignee proof of delivery signature.',
    category: 'shipment',
    actionScreen: 'PROOF_OF_DELIVERY',
  },
  CLIENT_PAYMENT_DUE: {
    type: 'CLIENT_PAYMENT_DUE',
    role: 'CLIENT',
    name: 'Payment Due',
    title: 'Payment Due 💳',
    subtitle: 'Invoice for Booking #{refId} due: ₹{amount}.',
    content: 'Consignment invoice #{refId} is now due for settlement as per agreed commercial credit terms.',
    category: 'payment',
    actionScreen: 'BOOKING_DETAILS',
    isImportant: true,
  },
  CLIENT_PAYMENT_RECEIVED: {
    type: 'CLIENT_PAYMENT_RECEIVED',
    role: 'CLIENT',
    name: 'Payment Received',
    title: 'Payment Received 💰',
    subtitle: 'Payment of ₹{amount} credited successfully.',
    content: 'Your freight payment of ₹{amount} for Booking #{refId} has been credited and reconciled in ledger.',
    category: 'payment',
    actionScreen: 'BOOKING_DETAILS',
  },
  CLIENT_BOOKING_COMPLETED: {
    type: 'CLIENT_BOOKING_COMPLETED',
    role: 'CLIENT',
    name: 'Booking Completed',
    title: 'Booking Completed 🏁',
    subtitle: 'Booking #{refId} closed with signed e-POD.',
    content: 'All trip milestones, consignee delivery receipts, and financial settlements are completed.',
    category: 'booking',
    actionScreen: 'BOOKING_DETAILS',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR NOTIFICATION TEMPLATES (34)
// ─────────────────────────────────────────────────────────────────────────────
export const VENDOR_NOTIFICATIONS: Record<VendorNotificationType, NotificationTemplate> = {
  VENDOR_REGISTRATION_SUCCESSFUL: {
    type: 'VENDOR_REGISTRATION_SUCCESSFUL',
    role: 'VENDOR',
    name: 'Registration Successful',
    title: 'Registration Successful 🚛',
    subtitle: 'Fleet Partner profile registered on THE TRUCKX.',
    content: 'Your transporter registration is recorded. Complete document verification to unlock live bidding.',
    category: 'system',
    actionScreen: 'VENDOR_DASHBOARD',
  },
  VENDOR_VERIFICATION_PENDING: {
    type: 'VENDOR_VERIFICATION_PENDING',
    role: 'VENDOR',
    name: 'Verification Pending',
    title: 'Verification Pending ⏳',
    subtitle: 'Compliance team is auditing your fleet documents.',
    content: 'Your GST, PAN, transport licence, and vehicle documents are under review.',
    category: 'system',
    actionScreen: 'VENDOR_VERIFICATION_STATUS',
  },
  VENDOR_APPROVED: {
    type: 'VENDOR_APPROVED',
    role: 'VENDOR',
    name: 'Vendor Approved',
    title: 'Vendor Approved 🌟',
    subtitle: 'Account verified! You are an Official Fleet Partner.',
    content: 'Your transporter KYC is approved. You can now bid on verified freight requirements and dispatch trips.',
    category: 'system',
    actionScreen: 'VENDOR_DASHBOARD',
  },
  VENDOR_REJECTED: {
    type: 'VENDOR_REJECTED',
    role: 'VENDOR',
    name: 'Vendor Rejected',
    title: 'Vendor Rejected ❌',
    subtitle: 'Transporter application could not be verified.',
    content: 'Compliance verification failed due to: {reason}. Please update documents in Document Correction.',
    category: 'system',
    actionScreen: 'VENDOR_DOC_CORRECTION',
    isImportant: true,
  },
  VENDOR_ADDITIONAL_DOCUMENTS_REQUIRED: {
    type: 'VENDOR_ADDITIONAL_DOCUMENTS_REQUIRED',
    role: 'VENDOR',
    name: 'Additional Documents Required',
    title: 'Additional Documents Required 📄',
    subtitle: 'Please upload missing fleet or KYC files.',
    content: 'Compliance desk requires: {docList}. Upload clear PDF or image copies to finalize verification.',
    category: 'document',
    actionScreen: 'VENDOR_DOC_CORRECTION',
    isImportant: true,
  },
  VENDOR_ACCOUNT_ACCESS_ENABLED: {
    type: 'VENDOR_ACCOUNT_ACCESS_ENABLED',
    role: 'VENDOR',
    name: 'Account Access Enabled',
    title: 'Account Access Enabled 🔓',
    subtitle: 'Full transporter capabilities unlocked.',
    content: 'Your account access has been fully enabled. View live RFQs, submit quotes, and manage fleet lorries.',
    category: 'system',
    actionScreen: 'VENDOR_DASHBOARD',
  },
  VENDOR_NEW_TRANSPORT_REQUIREMENT_RECEIVED: {
    type: 'VENDOR_NEW_TRANSPORT_REQUIREMENT_RECEIVED',
    role: 'VENDOR',
    name: 'New Transport Requirement Received',
    title: 'New Transport Requirement Received 📦',
    subtitle: 'Route: {origin} → {destination} | {material}.',
    content: 'A verified client posted Requirement #{refId}. Submit your competitive commercial quotation now.',
    category: 'requirement',
    actionScreen: 'VENDOR_REQUIREMENTS',
  },
  VENDOR_REQUIREMENT_DEADLINE_APPROACHING: {
    type: 'VENDOR_REQUIREMENT_DEADLINE_APPROACHING',
    role: 'VENDOR',
    name: 'Requirement Deadline Approaching',
    title: 'Requirement Deadline Approaching ⏱️',
    subtitle: 'Bidding closes in 1 hour for #{refId}.',
    content: 'Requirement #{refId} ({origin} → {destination}) quotation window is closing soon. Submit your bid.',
    category: 'requirement',
    actionScreen: 'VENDOR_SUBMIT_QUOTATION',
  },
  VENDOR_REQUIREMENT_WITHDRAWN: {
    type: 'VENDOR_REQUIREMENT_WITHDRAWN',
    role: 'VENDOR',
    name: 'Requirement Withdrawn',
    title: 'Requirement Withdrawn 🚫',
    subtitle: 'Client withdrew Requirement #{refId}.',
    content: 'Requirement #{refId} was cancelled by shipper before award. No further quotes accepted.',
    category: 'requirement',
    actionScreen: 'VENDOR_REQUIREMENTS',
  },
  VENDOR_REQUIREMENT_CLOSED: {
    type: 'VENDOR_REQUIREMENT_CLOSED',
    role: 'VENDOR',
    name: 'Requirement Closed',
    title: 'Requirement Closed 🔒',
    subtitle: 'Bidding closed for Requirement #{refId}.',
    content: 'Requirement #{refId} bidding window has concluded. Final quote evaluation is in progress.',
    category: 'requirement',
    actionScreen: 'VENDOR_REQUIREMENTS',
  },
  VENDOR_QUOTATION_SUBMITTED_SUCCESSFULLY: {
    type: 'VENDOR_QUOTATION_SUBMITTED_SUCCESSFULLY',
    role: 'VENDOR',
    name: 'Quotation Submitted Successfully',
    title: 'Quotation Submitted Successfully 📨',
    subtitle: 'Bid of ₹{amount} submitted for #{refId}.',
    content: 'Your commercial quotation of ₹{amount} for Requirement #{refId} has been delivered to client.',
    category: 'quotation',
    actionScreen: 'VENDOR_MY_QUOTATIONS',
  },
  VENDOR_QUOTATION_ACCEPTED: {
    type: 'VENDOR_QUOTATION_ACCEPTED',
    role: 'VENDOR',
    name: 'Quotation Accepted',
    title: 'Quotation Accepted! Trip Awarded 🏆',
    subtitle: 'Booking #{refId} awarded to your fleet!',
    content: 'Congratulations! Client accepted your quotation of ₹{amount}. Assign vehicle and driver now.',
    category: 'quotation',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_QUOTATION_REJECTED: {
    type: 'VENDOR_QUOTATION_REJECTED',
    role: 'VENDOR',
    name: 'Quotation Rejected',
    title: 'Quotation Rejected ❌',
    subtitle: 'Quote for Requirement #{refId} not selected.',
    content: 'Client selected an alternative transporter for #{refId}. Check other live requirements.',
    category: 'quotation',
    actionScreen: 'VENDOR_REQUIREMENTS',
  },
  VENDOR_QUOTATION_REVISION_REQUESTED: {
    type: 'VENDOR_QUOTATION_REVISION_REQUESTED',
    role: 'VENDOR',
    name: 'Quotation Revision Requested',
    title: 'Quotation Revision Requested 🔄',
    subtitle: 'Counter-offer received on Requirement #{refId}.',
    content: 'Client requested rate revision for #{refId}. Review counter-terms and submit revised bid.',
    category: 'quotation',
    actionScreen: 'VENDOR_QUOTATION_DETAILS',
    isImportant: true,
  },
  VENDOR_BOOKING_CONFIRMED: {
    type: 'VENDOR_BOOKING_CONFIRMED',
    role: 'VENDOR',
    name: 'Booking Confirmed',
    title: 'Booking Confirmed 🚛',
    subtitle: 'Booking #{refId} confirmed. Prepare fleet placement.',
    content: 'Booking #{refId} confirmed. Route: {origin} → {destination}. Ensure lorry reaches loading bay on time.',
    category: 'booking',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_VEHICLE_DETAILS_REQUIRED: {
    type: 'VENDOR_VEHICLE_DETAILS_REQUIRED',
    role: 'VENDOR',
    name: 'Vehicle Details Required',
    title: 'Vehicle Details Required 📋',
    subtitle: 'Action needed on Booking #{refId}.',
    content: 'Please assign a verified lorry (RC, fitness, permit) for Booking #{refId} before dispatch cutoff.',
    category: 'shipment',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_DRIVER_DETAILS_REQUIRED: {
    type: 'VENDOR_DRIVER_DETAILS_REQUIRED',
    role: 'VENDOR',
    name: 'Driver Details Required',
    title: 'Driver Details Required 👤',
    subtitle: 'Link driver to Booking #{refId}.',
    content: 'Please specify captain name, phone, and driving licence for assigned vehicle.',
    category: 'driver',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_VEHICLE_ASSIGNED: {
    type: 'VENDOR_VEHICLE_ASSIGNED',
    role: 'VENDOR',
    name: 'Vehicle Assigned',
    title: 'Vehicle Assigned 🚚',
    subtitle: 'Lorry {vehicleNumber} allocated to Booking #{refId}.',
    content: 'Vehicle {vehicleNumber} successfully allocated. Verification synced with operations.',
    category: 'shipment',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
  },
  VENDOR_DRIVER_ASSIGNED: {
    type: 'VENDOR_DRIVER_ASSIGNED',
    role: 'VENDOR',
    name: 'Driver Assigned',
    title: 'Driver Assigned 🚦',
    subtitle: 'Captain {driverName} assigned to #{refId}.',
    content: 'Driver {driverName} ({driverPhone}) linked to trip. Driver console notified.',
    category: 'driver',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
  },
  VENDOR_VEHICLE_DRIVER_DETAILS_REJECTED: {
    type: 'VENDOR_VEHICLE_DRIVER_DETAILS_REJECTED',
    role: 'VENDOR',
    name: 'Vehicle / Driver Details Rejected',
    title: 'Vehicle / Driver Details Rejected ⚠️',
    subtitle: 'Assigned credentials rejected for Booking #{refId}.',
    content: 'Verification failed: {reason}. Please reallocate an alternative compliant vehicle or driver.',
    category: 'shipment',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_LOADING_SCHEDULE_UPDATED: {
    type: 'VENDOR_LOADING_SCHEDULE_UPDATED',
    role: 'VENDOR',
    name: 'Loading Schedule Updated',
    title: 'Loading Schedule Updated 📅',
    subtitle: 'Reporting time revised for Booking #{refId}.',
    content: 'Client adjusted loading window to {time} at {origin}. Instruct driver accordingly.',
    category: 'shipment',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
  },
  VENDOR_TRIP_STARTED: {
    type: 'VENDOR_TRIP_STARTED',
    role: 'VENDOR',
    name: 'Trip Started',
    title: 'Trip Started 🛣️',
    subtitle: 'Lorry {vehicleNumber} has departed origin.',
    content: 'Trip #{refId} is underway with live telemetry active. Monitor milestone progress.',
    category: 'shipment',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
  },
  VENDOR_TRIP_DELAYED: {
    type: 'VENDOR_TRIP_DELAYED',
    role: 'VENDOR',
    name: 'Trip Delayed',
    title: 'Trip Delayed ⏱️',
    subtitle: 'Transit delay on Trip #{refId}.',
    content: 'Driver reported transit delay: {reason}. Operations team is tracking vehicle position.',
    category: 'shipment',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_UNLOADING_COMPLETED: {
    type: 'VENDOR_UNLOADING_COMPLETED',
    role: 'VENDOR',
    name: 'Unloading Completed',
    title: 'Unloading Completed 📦',
    subtitle: 'Trip #{refId} discharged at destination.',
    content: 'Consignment successfully discharged at {destination}. Collect and upload proof of delivery.',
    category: 'shipment',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
  },
  VENDOR_WEIGHT_BILL_UPLOAD_REQUIRED: {
    type: 'VENDOR_WEIGHT_BILL_UPLOAD_REQUIRED',
    role: 'VENDOR',
    name: 'Weight Bill Upload Required',
    title: 'Weight Bill Upload Required ⚖️',
    subtitle: 'Upload weighbridge slip for Trip #{refId}.',
    content: 'Gross and tare weighbridge slips required to initiate freight settlement reconciliation.',
    category: 'document',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_POD_UPLOAD_REQUIRED: {
    type: 'VENDOR_POD_UPLOAD_REQUIRED',
    role: 'VENDOR',
    name: 'POD Upload Required',
    title: 'POD Upload Required 📸',
    subtitle: 'Upload signed & stamped Proof of Delivery.',
    content: 'Upload clean copy of consignee-stamped delivery challan for Trip #{refId} to clear billing.',
    category: 'document',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_SIGNED_LR_UPLOAD_REQUIRED: {
    type: 'VENDOR_SIGNED_LR_UPLOAD_REQUIRED',
    role: 'VENDOR',
    name: 'Signed LR Upload Required',
    title: 'Signed LR Upload Required 📄',
    subtitle: 'Upload consignor copy of Lorry Receipt.',
    content: 'Signed LR / consignment note required to clear trip for audit and payment.',
    category: 'document',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_DOCUMENT_VERIFICATION_COMPLETED: {
    type: 'VENDOR_DOCUMENT_VERIFICATION_COMPLETED',
    role: 'VENDOR',
    name: 'Document Verification Completed',
    title: 'Document Verification Completed ✅',
    subtitle: 'e-POD & LR verified by billing desk.',
    content: 'Delivery documents for Trip #{refId} verified. Trip moved to settlement queue.',
    category: 'document',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
  },
  VENDOR_DOCUMENT_REJECTED: {
    type: 'VENDOR_DOCUMENT_REJECTED',
    role: 'VENDOR',
    name: 'Document Rejected',
    title: 'Document Rejected ❌',
    subtitle: 'e-POD or slip rejected for Trip #{refId}.',
    content: 'Document rejected due to: {reason}. Please re-upload clear signed copy.',
    category: 'document',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
    isImportant: true,
  },
  VENDOR_TRIP_CLOSURE_PENDING: {
    type: 'VENDOR_TRIP_CLOSURE_PENDING',
    role: 'VENDOR',
    name: 'Trip Closure Pending',
    title: 'Trip Closure Pending ⏳',
    subtitle: 'Trip #{refId} awaiting final audit.',
    content: 'Consignment delivered. Final audit of detention, tolls, and shortages in progress.',
    category: 'shipment',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
  },
  VENDOR_TRIP_CLOSED: {
    type: 'VENDOR_TRIP_CLOSED',
    role: 'VENDOR',
    name: 'Trip Closed',
    title: 'Trip Closed 🏁',
    subtitle: 'Trip #{refId} successfully closed.',
    content: 'Trip #{refId} audit complete. Freight payout ledger updated.',
    category: 'shipment',
    actionScreen: 'VENDOR_AWARDED_BOOKINGS',
  },
  VENDOR_PAYMENT_STATUS_UPDATED: {
    type: 'VENDOR_PAYMENT_STATUS_UPDATED',
    role: 'VENDOR',
    name: 'Payment Status Updated',
    title: 'Payment Status Updated 🔄',
    subtitle: 'Payout status updated for Trip #{refId}.',
    content: 'Payment status changed to {status}. Net payable amount: ₹{amount}.',
    category: 'payment',
    actionScreen: 'VENDOR_DASHBOARD',
  },
  VENDOR_PAYMENT_RECEIVED: {
    type: 'VENDOR_PAYMENT_RECEIVED',
    role: 'VENDOR',
    name: 'Payment Received',
    title: 'Payment Received 💰',
    subtitle: '₹{amount} credited for Trip #{refId}.',
    content: 'Freight settlement of ₹{amount} has been disbursed to your registered bank account.',
    category: 'payment',
    actionScreen: 'VENDOR_DASHBOARD',
  },
  VENDOR_PAYMENT_OVERDUE: {
    type: 'VENDOR_PAYMENT_OVERDUE',
    role: 'VENDOR',
    name: 'Payment Overdue',
    title: 'Payment Overdue ⚠️',
    subtitle: 'Settlement notice for Trip #{refId}.',
    content: 'Payout reconciliation overdue. Logistics billing desk has prioritized your payout.',
    category: 'payment',
    actionScreen: 'VENDOR_DASHBOARD',
    isImportant: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER NOTIFICATION TEMPLATES (33)
// ─────────────────────────────────────────────────────────────────────────────
export const DRIVER_NOTIFICATIONS: Record<DriverNotificationType, NotificationTemplate> = {
  DRIVER_REGISTRATION_SUCCESSFUL: {
    type: 'DRIVER_REGISTRATION_SUCCESSFUL',
    role: 'DRIVER',
    name: 'Registration Successful',
    title: 'Registration Successful 🚦',
    subtitle: 'Welcome Captain! Driver profile created.',
    content: 'Your driver profile is registered on THE TRUCKX. Complete licence upload to receive trips.',
    category: 'system',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_VERIFICATION_PENDING: {
    type: 'DRIVER_VERIFICATION_PENDING',
    role: 'DRIVER',
    name: 'Verification Pending',
    title: 'Verification Pending ⏳',
    subtitle: 'Driving licence & Aadhaar under verification.',
    content: 'Our safety team is validating your driving licence, badges, and background credentials.',
    category: 'system',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_APPROVED: {
    type: 'DRIVER_APPROVED',
    role: 'DRIVER',
    name: 'Driver Approved',
    title: 'Driver Approved 🌟',
    subtitle: 'Verification complete! You can now take trips.',
    content: 'You are now a verified THE TRUCKX Captain. You will receive live trip assignments here.',
    category: 'system',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_REJECTED: {
    type: 'DRIVER_REJECTED',
    role: 'DRIVER',
    name: 'Driver Rejected',
    title: 'Driver Rejected ❌',
    subtitle: 'Driver verification could not be approved.',
    content: 'Verification was rejected due to: {reason}. Please re-upload valid documents.',
    category: 'system',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_ADDITIONAL_DOCUMENTS_REQUIRED: {
    type: 'DRIVER_ADDITIONAL_DOCUMENTS_REQUIRED',
    role: 'DRIVER',
    name: 'Additional Documents Required',
    title: 'Additional Documents Required 📄',
    subtitle: 'Upload missing licence or verification badge.',
    content: 'Please upload clear copy of: {docList} to activate trip dispatch.',
    category: 'document',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_ACCOUNT_ACCESS_ENABLED: {
    type: 'DRIVER_ACCOUNT_ACCESS_ENABLED',
    role: 'DRIVER',
    name: 'Account Access Enabled',
    title: 'Account Access Enabled 🔓',
    subtitle: 'Your driver cab console is active.',
    content: 'Your account is ready. Keep notifications on to receive instant trip dispatches.',
    category: 'system',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_NEW_TRIP_ASSIGNMENT: {
    type: 'DRIVER_NEW_TRIP_ASSIGNMENT',
    role: 'DRIVER',
    name: 'New Trip Assignment',
    title: 'New Trip Assignment! 🚚',
    subtitle: 'Trip #{refId}: {origin} → {destination}.',
    content: 'You are assigned to Trip #{refId}. Vehicle: {vehicleNumber}. Report to loading dock.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_TRIP_ASSIGNMENT_UPDATED: {
    type: 'DRIVER_TRIP_ASSIGNMENT_UPDATED',
    role: 'DRIVER',
    name: 'Trip Assignment Updated',
    title: 'Trip Assignment Updated 📝',
    subtitle: 'Trip #{refId} details updated.',
    content: 'Pickup schedule or consignment notes updated for Trip #{refId}. Check trip sheet.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_TRIP_ASSIGNMENT_CANCELLED: {
    type: 'DRIVER_TRIP_ASSIGNMENT_CANCELLED',
    role: 'DRIVER',
    name: 'Trip Assignment Cancelled',
    title: 'Trip Assignment Cancelled ⚠️',
    subtitle: 'Trip #{refId} assignment was cancelled.',
    content: 'Trip #{refId} assignment cancelled by fleet manager. Stand by for next load.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_VEHICLE_ASSIGNED: {
    type: 'DRIVER_VEHICLE_ASSIGNED',
    role: 'DRIVER',
    name: 'Vehicle Assigned',
    title: 'Vehicle Assigned 🚛',
    subtitle: 'Lorry {vehicleNumber} assigned to you.',
    content: 'Report to vehicle {vehicleNumber} ({vehicleType}) for pre-trip inspection.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_LOADING_LOCATION_UPDATED: {
    type: 'DRIVER_LOADING_LOCATION_UPDATED',
    role: 'DRIVER',
    name: 'Loading Location Updated',
    title: 'Loading Location Updated 📍',
    subtitle: 'Pickup bay updated for Trip #{refId}.',
    content: 'Report to: {origin}. Contact loading supervisor {supervisorPhone} upon arrival.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_LOADING_SCHEDULE_REMINDER: {
    type: 'DRIVER_LOADING_SCHEDULE_REMINDER',
    role: 'DRIVER',
    name: 'Loading Schedule Reminder',
    title: 'Loading Schedule Reminder ⏰',
    subtitle: 'Report to loading dock by {time}.',
    content: 'Reporting time for Trip #{refId} is {time}. Maintain road safety.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_ARRIVAL_AT_LOADING_LOCATION: {
    type: 'DRIVER_ARRIVAL_AT_LOADING_LOCATION',
    role: 'DRIVER',
    name: 'Arrival at Loading Location',
    title: 'Arrival at Loading Location 🏢',
    subtitle: 'Check-in recorded at loading warehouse.',
    content: 'Gate-in timestamp logged for Trip #{refId}. Proceed to designated loading bay.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_LOADING_STARTED: {
    type: 'DRIVER_LOADING_STARTED',
    role: 'DRIVER',
    name: 'Loading Started',
    title: 'Loading Started 📦',
    subtitle: 'Cargo loading in progress.',
    content: 'Supervise freight placement and ensure safe weight distribution across axles.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_LOADING_COMPLETED: {
    type: 'DRIVER_LOADING_COMPLETED',
    role: 'DRIVER',
    name: 'Loading Completed',
    title: 'Loading Completed 🔒',
    subtitle: 'Tarping, sealing & e-waybill verified.',
    content: 'Loading finished. Collect physical consignment notes and prepare for departure.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_REQUIRED_DOCUMENTS_PENDING: {
    type: 'DRIVER_REQUIRED_DOCUMENTS_PENDING',
    role: 'DRIVER',
    name: 'Required Documents Pending',
    title: 'Required Documents Pending ⚠️',
    subtitle: 'LR or e-waybill copy pending.',
    content: 'Ensure you carry hard copy LR and e-waybill before exiting loading gate.',
    category: 'document',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_PRE_TRIP_VERIFICATION_REMINDER: {
    type: 'DRIVER_PRE_TRIP_VERIFICATION_REMINDER',
    role: 'DRIVER',
    name: 'Pre-Trip Verification Reminder',
    title: 'Pre-Trip Verification Reminder 🔧',
    subtitle: 'Inspect tyres, brakes, fuel & fasteners.',
    content: 'Complete safety walk-around checklist before hitting the highway.',
    category: 'system',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_TRIP_STARTED_SUCCESSFULLY: {
    type: 'DRIVER_TRIP_STARTED_SUCCESSFULLY',
    role: 'DRIVER',
    name: 'Trip Started Successfully',
    title: 'Trip Started Successfully 🛣️',
    subtitle: 'Trip #{refId} underway. Drive safely!',
    content: 'GPS tracking active. Follow designated freight corridor to {destination}.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_ROUTE_UPDATED: {
    type: 'DRIVER_ROUTE_UPDATED',
    role: 'DRIVER',
    name: 'Route Updated',
    title: 'Route Updated 🔄',
    subtitle: 'Optimized navigation route assigned.',
    content: 'Operations desk has updated your route to avoid toll/road congestion. Follow map.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_DESTINATION_UPDATED: {
    type: 'DRIVER_DESTINATION_UPDATED',
    role: 'DRIVER',
    name: 'Destination Updated',
    title: 'Destination Updated 📍',
    subtitle: 'Delivery location revised for Trip #{refId}.',
    content: 'New destination: {destination}. Verify revised delivery address in app.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_TRIP_DELAYED: {
    type: 'DRIVER_TRIP_DELAYED',
    role: 'DRIVER',
    name: 'Trip Delayed',
    title: 'Trip Delayed ⏱️',
    subtitle: 'Delay status logged for Trip #{refId}.',
    content: 'Transit delay recorded: {reason}. Emergency helpdesk is notified.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_EMERGENCY_INCIDENT_ALERT: {
    type: 'DRIVER_EMERGENCY_INCIDENT_ALERT',
    role: 'DRIVER',
    name: 'Emergency / Trip Incident Alert',
    title: 'Emergency / Incident Alert 🚨',
    subtitle: '24/7 SOS helpline active: 1800-XXX-XXXX.',
    content: 'Emergency assistance triggered. Stay in safe location. Operations support team is calling.',
    category: 'system',
    actionScreen: 'HELP_SUPPORT',
    isImportant: true,
  },
  DRIVER_REACHED_DESTINATION: {
    type: 'DRIVER_REACHED_DESTINATION',
    role: 'DRIVER',
    name: 'Reached Destination',
    title: 'Reached Destination 🏁',
    subtitle: 'Arrival at {destination} recorded.',
    content: 'Gate-in logged at consignee warehouse. Position vehicle in unloading dock.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_UNLOADING_STARTED: {
    type: 'DRIVER_UNLOADING_STARTED',
    role: 'DRIVER',
    name: 'Unloading Started',
    title: 'Unloading Started 🏗️',
    subtitle: 'Dock unloading in progress.',
    content: 'Consignee team is discharging consignment packages. Supervise unloading.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_UNLOADING_COMPLETED: {
    type: 'DRIVER_UNLOADING_COMPLETED',
    role: 'DRIVER',
    name: 'Unloading Completed',
    title: 'Unloading Completed 📦',
    subtitle: 'All packages discharged.',
    content: 'Unloading finished. Obtain stamped delivery receipt (POD) from warehouse manager.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_WEIGHT_BILL_UPLOAD_REMINDER: {
    type: 'DRIVER_WEIGHT_BILL_UPLOAD_REMINDER',
    role: 'DRIVER',
    name: 'Weight Bill Upload Reminder',
    title: 'Weight Bill Upload Reminder ⚖️',
    subtitle: 'Snap and upload weighbridge receipt.',
    content: 'Take a clear photo of destination weighbridge slip and upload to trip sheet.',
    category: 'document',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_POD_UPLOAD_REMINDER: {
    type: 'DRIVER_POD_UPLOAD_REMINDER',
    role: 'DRIVER',
    name: 'POD Upload Reminder',
    title: 'POD Upload Reminder 📸',
    subtitle: 'Upload consignee stamped POD.',
    content: 'Upload clean photo of signed and stamped proof of delivery to complete trip.',
    category: 'document',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_SIGNED_LR_UPLOAD_REMINDER: {
    type: 'DRIVER_SIGNED_LR_UPLOAD_REMINDER',
    role: 'DRIVER',
    name: 'Signed LR Upload Reminder',
    title: 'Signed LR Upload Reminder 📄',
    subtitle: 'Upload signed Lorry Receipt copy.',
    content: 'Consignee-acknowledged LR copy required for billing release.',
    category: 'document',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_DOCUMENT_UPLOADED_SUCCESSFULLY: {
    type: 'DRIVER_DOCUMENT_UPLOADED_SUCCESSFULLY',
    role: 'DRIVER',
    name: 'Document Uploaded Successfully',
    title: 'Document Uploaded Successfully ✅',
    subtitle: 'File received for Trip #{refId}.',
    content: 'Your document upload has been received and forwarded to compliance desk.',
    category: 'document',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_DOCUMENT_REJECTED: {
    type: 'DRIVER_DOCUMENT_REJECTED',
    role: 'DRIVER',
    name: 'Document Rejected',
    title: 'Document Rejected ❌',
    subtitle: 'Photo blurry or missing seal.',
    content: 'Document rejected due to: {reason}. Retake photo in good lighting with seal clearly visible.',
    category: 'document',
    actionScreen: 'DRIVER_DASHBOARD',
    isImportant: true,
  },
  DRIVER_DOCUMENT_VERIFIED: {
    type: 'DRIVER_DOCUMENT_VERIFIED',
    role: 'DRIVER',
    name: 'Document Verified',
    title: 'Document Verified 🌟',
    subtitle: 'POD & LR approved by verification team.',
    content: 'Delivery documentation verified. Trip marked ready for settlement.',
    category: 'document',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_TRIP_COMPLETED: {
    type: 'DRIVER_TRIP_COMPLETED',
    role: 'DRIVER',
    name: 'Trip Completed',
    title: 'Trip Completed 🏆',
    subtitle: 'Trip #{refId} completed successfully!',
    content: 'Great job Captain! Delivery completed and verified. Trip allowance queued.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
  DRIVER_TRIP_CLOSED: {
    type: 'DRIVER_TRIP_CLOSED',
    role: 'DRIVER',
    name: 'Trip Closed',
    title: 'Trip Closed 🔒',
    subtitle: 'Trip #{refId} final settlement done.',
    content: 'Trip #{refId} officially closed. Ready for next trip assignment.',
    category: 'shipment',
    actionScreen: 'DRIVER_DASHBOARD',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE VALIDATION & BUILDER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns whether a notification event key belongs strictly to the given role
 */
export function isNotificationValidForRole(eventType: string, role: MobileRole): boolean {
  if (role === 'CLIENT') {
    return eventType.startsWith('CLIENT_') && eventType in CLIENT_NOTIFICATIONS;
  }
  if (role === 'VENDOR') {
    return eventType.startsWith('VENDOR_') && eventType in VENDOR_NOTIFICATIONS;
  }
  if (role === 'DRIVER') {
    return eventType.startsWith('DRIVER_') && eventType in DRIVER_NOTIFICATIONS;
  }
  return false;
}

/**
 * Get all templates for a specific role
 */
export function getRoleNotificationCatalog(role: MobileRole): NotificationTemplate[] {
  if (role === 'CLIENT') {
    return Object.values(CLIENT_NOTIFICATIONS);
  }
  if (role === 'VENDOR') {
    return Object.values(VENDOR_NOTIFICATIONS);
  }
  if (role === 'DRIVER') {
    return Object.values(DRIVER_NOTIFICATIONS);
  }
  return [];
}

/**
 * Build a structured, non-colliding AppNotificationItem with safe parameter interpolation
 */
export function buildNotificationItem(
  role: MobileRole,
  eventType: NotificationEventType,
  params: Record<string, string | number> = {}
): AppNotificationItem {
  let template: NotificationTemplate | undefined;

  if (role === 'CLIENT') {
    template = CLIENT_NOTIFICATIONS[eventType as ClientNotificationType];
  } else if (role === 'VENDOR') {
    template = VENDOR_NOTIFICATIONS[eventType as VendorNotificationType];
  } else if (role === 'DRIVER') {
    template = DRIVER_NOTIFICATIONS[eventType as DriverNotificationType];
  }

  if (!template) {
    // Fallback safe template
    template = {
      type: eventType,
      role,
      name: eventType,
      title: 'THE TRUCKX Operational Alert',
      subtitle: 'New update available.',
      content: 'A logistics update has been posted to your dashboard.',
      category: 'system',
      actionScreen: role === 'CLIENT' ? 'CLIENT_DASHBOARD' : role === 'VENDOR' ? 'VENDOR_DASHBOARD' : 'DRIVER_DASHBOARD',
    };
  }

  const interpolate = (text: string): string => {
    return text.replace(/\{(\w+)\}/g, (_, key) => {
      if (params[key] !== undefined && params[key] !== null) {
        return String(params[key]);
      }
      switch (key) {
        case 'refId':
          return 'TRK-9824';
        case 'origin':
          return 'Guwahati Hub';
        case 'destination':
          return 'Kolkata Central';
        case 'material':
          return 'General Cargo';
        case 'amount':
          return '48,500';
        case 'vehicleNumber':
          return 'AS-01-EC-4421';
        case 'vehicleType':
          return '32FT Multi-Axle';
        case 'driverName':
          return 'Vikram Singh';
        case 'driverPhone':
          return '+91 98765 43210';
        case 'supervisorPhone':
          return '+91 94350 11223';
        case 'time':
          return 'Today, 04:00 PM';
        case 'eta':
          return 'Tomorrow, 08:00 AM';
        case 'reason':
          return 'Highway fog and toll corridor queue';
        case 'docList':
          return 'Permit Copy & Fitness Certificate';
        case 'status':
          return 'Disbursed';
        case 'transporter':
          return 'Assam Freightways';
        default:
          return key;
      }
    });
  };

  const uniqueSuffix = Math.random().toString(36).substring(2, 7);
  const cleanId = `${role.toLowerCase()}-${eventType.toLowerCase().replace(/_/g, '-')}-${Date.now()}-${uniqueSuffix}`;

  return {
    id: cleanId,
    category: template.category as any,
    title: interpolate(template.title),
    subtitle: interpolate(template.subtitle),
    time: 'Just now',
    isRead: false,
    isImportant: template.isImportant || false,
    content: interpolate(template.content),
    createdAt: new Date().toISOString(),
    refId: params.refId ? String(params.refId) : undefined,
  };
}
