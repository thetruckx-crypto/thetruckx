/**
 * Vendor Document Classification and Normalization Helpers
 * Maps client/mobile input strings to strict PostgreSQL CHECK constraint types:
 * category: 'VENDOR_KYC'
 * document_type: 'COMPANY_PAN' | 'GST_CERTIFICATE' | 'BANK_PASSBOOK' | 'MSME_UDYAM' | 'INCORPORATION_PROOF' | 'TIE_UP_AUTHORIZATION' | 'OTHER'
 */
export function normalizeVendorDocType(rawType?: string): { category: string; docType: string } {
  const t = (rawType || '').toUpperCase().trim();
  if (t === 'COMPANY_PAN' || t === 'PAN' || t === 'VENDOR_PAN') {
    return { category: 'VENDOR_KYC', docType: 'COMPANY_PAN' };
  }
  if (t === 'GST_CERTIFICATE' || t === 'GSTIN' || t === 'GST') {
    return { category: 'VENDOR_KYC', docType: 'GST_CERTIFICATE' };
  }
  if (t === 'BANK_CANCELLED_CHEQUE' || t === 'BANK_PASSBOOK' || t === 'CHEQUE' || t === 'BANK_PROOF') {
    return { category: 'VENDOR_KYC', docType: 'BANK_PASSBOOK' };
  }
  if (t === 'MSME_UDYAM' || t === 'UDYAM' || t === 'MSME') {
    return { category: 'VENDOR_KYC', docType: 'MSME_UDYAM' };
  }
  if (t === 'INCORPORATION_PROOF' || t === 'CERTIFICATE_OF_INCORPORATION' || t === 'COI') {
    return { category: 'VENDOR_KYC', docType: 'INCORPORATION_PROOF' };
  }
  if (t === 'TRANSPORT_DECLARATION' || t === 'DECLARATION' || t === 'TIE_UP_AUTHORIZATION') {
    return { category: 'VENDOR_KYC', docType: 'TIE_UP_AUTHORIZATION' };
  }
  return { category: 'VENDOR_KYC', docType: 'OTHER' };
}
