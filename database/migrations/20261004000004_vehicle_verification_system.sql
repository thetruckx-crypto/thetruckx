BEGIN;

-- ============================================================
-- NECL DOCUMENT TYPE CONSTRAINT FIX
-- Preserves existing document types and adds missing types
-- ============================================================

-- Step 1: Remove the existing constraint.
ALTER TABLE public.documents
DROP CONSTRAINT IF EXISTS documents_document_type_check;

-- Step 2: Recreate the constraint with existing and new types.
ALTER TABLE public.documents
ADD CONSTRAINT documents_document_type_check
CHECK (
    document_type = ANY (
        ARRAY[
            -- Existing vehicle document types
            'RC',
            'INSURANCE',
            'FITNESS',
            'PERMIT',
            'TIE_UP_AUTHORIZATION',
            'LICENCE',

            -- Existing vendor registration documents
            'AADHAAR',
            'GST_CERTIFICATE',
            'COMPANY_PAN',
            'INCORPORATION_PROOF',
            'MSME_UDYAM',
            'BANK_PASSBOOK',
            'VENDOR_PAN',

            -- Existing client and transport documents
            'CLIENT_INVOICE',
            'WAYBILL',
            'WEIGHBRIDGE_SLIP',
            'POD_LR',
            'POD',
            'DELIVERY_RECEIPT',
            'OTHER'
        ]::TEXT[]
    )
);

-- Step 3: Add document lookup index if it does not exist.
CREATE INDEX IF NOT EXISTS idx_documents_reference
ON public.documents (
    reference_id,
    category,
    document_type
);

COMMIT;

-- ============================================================
-- VERIFICATION 1: Check the final constraint.
-- ============================================================

SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.documents'::regclass
  AND conname = 'documents_document_type_check';

-- ============================================================
-- VERIFICATION 2: Check existing document types and record counts.
-- ============================================================

SELECT
    document_type,
    COUNT(*) AS record_count
FROM public.documents
GROUP BY document_type
ORDER BY document_type;