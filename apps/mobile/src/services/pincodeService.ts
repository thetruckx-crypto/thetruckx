/**
 * NECL Mobile Application — India Postal PIN Code Lookup Service
 * Open, free, no-auth integration with Postal PIN Code API
 * Supports offline logistics hub fallback, caching, and auto city/state resolution
 */

export interface PincodeDetails {
  pincode: string;
  city: string;
  district: string;
  state: string;
  postOfficeName?: string;
  source?: 'api' | 'cache' | 'fallback';
}

export interface PincodeLookupResult {
  success: boolean;
  data?: PincodeDetails;
  error?: string;
}

// In-memory cache for ultra-fast instant lookups
const pincodeCache = new Map<string, PincodeDetails>();

// Comprehensive offline fallback dictionary for key Indian logistics hubs
const LOGISTICS_HUB_FALLBACKS: Record<string, { city: string; district: string; state: string }> = {
  // Assam & North East Hubs
  '781001': { city: 'Guwahati', district: 'Kamrup Metropolitan', state: 'Assam' },
  '781005': { city: 'Guwahati', district: 'Kamrup Metropolitan', state: 'Assam' },
  '781006': { city: 'Guwahati', district: 'Kamrup Metropolitan', state: 'Assam' },
  '781020': { city: 'Guwahati', district: 'Kamrup Metropolitan', state: 'Assam' },
  '781028': { city: 'Guwahati', district: 'Kamrup Metropolitan', state: 'Assam' },
  '781035': { city: 'Guwahati', district: 'Kamrup', state: 'Assam' },
  '782001': { city: 'Nagaon', district: 'Nagaon', state: 'Assam' },
  '782435': { city: 'Hojai', district: 'Hojai', state: 'Assam' },
  '783001': { city: 'Dhubri', district: 'Dhubri', state: 'Assam' },
  '783380': { city: 'Bongaigaon', district: 'Bongaigaon', state: 'Assam' },
  '784001': { city: 'Tezpur', district: 'Sonitpur', state: 'Assam' },
  '785001': { city: 'Jorhat', district: 'Jorhat', state: 'Assam' },
  '785640': { city: 'Sivasagar', district: 'Sivasagar', state: 'Assam' },
  '786001': { city: 'Dibrugarh', district: 'Dibrugarh', state: 'Assam' },
  '786125': { city: 'Tinsukia', district: 'Tinsukia', state: 'Assam' },
  '788001': { city: 'Silchar', district: 'Cachar', state: 'Assam' },
  // Meghalaya
  '793001': { city: 'Shillong', district: 'East Khasi Hills', state: 'Meghalaya' },
  '793102': { city: 'Byrnihat', district: 'Ri Bhoi', state: 'Meghalaya' },
  // Tripura
  '799001': { city: 'Agartala', district: 'West Tripura', state: 'Tripura' },
  // Nagaland
  '797001': { city: 'Kohima', district: 'Kohima', state: 'Nagaland' },
  '797112': { city: 'Dimapur', district: 'Dimapur', state: 'Nagaland' },
  // Manipur
  '795001': { city: 'Imphal', district: 'Imphal West', state: 'Manipur' },
  // Mizoram
  '796001': { city: 'Aizawl', district: 'Aizawl', state: 'Mizoram' },
  // Arunachal Pradesh
  '791111': { city: 'Itanagar', district: 'Papum Pare', state: 'Arunachal Pradesh' },
  // West Bengal & Siliguri Corridor
  '734001': { city: 'Siliguri', district: 'Darjeeling', state: 'West Bengal' },
  '734005': { city: 'Siliguri', district: 'Jalpaiguri', state: 'West Bengal' },
  '700001': { city: 'Kolkata', district: 'Kolkata', state: 'West Bengal' },
  '711101': { city: 'Howrah', district: 'Howrah', state: 'West Bengal' },
  '712311': { city: 'Dankuni', district: 'Hooghly', state: 'West Bengal' },
  // Delhi NCR
  '110001': { city: 'New Delhi', district: 'Central Delhi', state: 'Delhi' },
  '110020': { city: 'Okhla', district: 'South Delhi', state: 'Delhi' },
  '122001': { city: 'Gurugram', district: 'Gurgaon', state: 'Haryana' },
  '201301': { city: 'Noida', district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh' },
  // Maharashtra
  '400001': { city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra' },
  '421302': { city: 'Bhiwandi', district: 'Thane', state: 'Maharashtra' },
  '411001': { city: 'Pune', district: 'Pune', state: 'Maharashtra' },
  // Southern & Central Corridors
  '560001': { city: 'Bengaluru', district: 'Bangalore', state: 'Karnataka' },
  '600001': { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu' },
  '500001': { city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  '380001': { city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat' },
  '302001': { city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan' },
  '800001': { city: 'Patna', district: 'Patna', state: 'Bihar' },
  '834001': { city: 'Ranchi', district: 'Ranchi', state: 'Jharkhand' },
  '492001': { city: 'Raipur', district: 'Raipur', state: 'Chhattisgarh' },
  '462001': { city: 'Bhopal', district: 'Bhopal', state: 'Madhya Pradesh' },
};

/**
 * Validates whether a given string is a valid 6-digit Indian PIN Code format
 */
export function validatePincodeFormat(pincode: string): { isValid: boolean; error?: string } {
  const clean = pincode ? pincode.trim() : '';
  if (!clean) {
    return { isValid: false, error: 'PIN Code is required.' };
  }
  if (!/^\d{6}$/.test(clean)) {
    return { isValid: false, error: 'PIN Code must be exactly 6 numeric digits.' };
  }
  // Indian PIN codes range from 100000 to 999999 (zones 1 to 9)
  if (clean.startsWith('0')) {
    return { isValid: false, error: 'Invalid PIN Code. Indian postal codes start with digits 1-9.' };
  }
  return { isValid: true };
}

/**
 * Cleans the district / division name for clean logistics display
 */
function formatCityName(division?: string, district?: string, block?: string): string {
  if (division && division.trim() && division.toLowerCase() !== 'na') {
    return division.trim();
  }
  if (district && district.trim()) {
    return district.replace(/\s+Metropolitan/i, '').replace(/\s+District/i, '').trim();
  }
  if (block && block.trim()) {
    return block.trim();
  }
  return '';
}

/**
 * Look up City, District, and State for an Indian PIN Code.
 * Checks memory cache -> Online India Postal API -> Offline Hub Fallbacks.
 */
export async function lookupPincode(pincode: string): Promise<PincodeLookupResult> {
  const clean = pincode ? pincode.trim().replace(/\D/g, '') : '';

  if (clean.length !== 6) {
    return {
      success: false,
      error: 'PIN code must be a 6-digit number.',
    };
  }

  // 1. Check in-memory cache
  if (pincodeCache.has(clean)) {
    return {
      success: true,
      data: { ...pincodeCache.get(clean)!, source: 'cache' },
    };
  }

  // 2. Fetch from India Postal PIN Code API with 5-second timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0]?.Status === 'Success') {
        const postOffices = data[0].PostOffice;
        if (Array.isArray(postOffices) && postOffices.length > 0) {
          const po = postOffices[0];
          const rawDistrict = po.District || '';
          const rawDivision = po.Division || '';
          const rawBlock = po.Block || '';
          const state = po.State || '';
          const postOfficeName = po.Name || '';

          const city = formatCityName(rawDivision, rawDistrict, rawBlock) || rawDistrict || postOfficeName;

          const details: PincodeDetails = {
            pincode: clean,
            city,
            district: rawDistrict || city,
            state,
            postOfficeName,
            source: 'api',
          };

          // Cache valid response
          pincodeCache.set(clean, details);
          return {
            success: true,
            data: details,
          };
        }
      }
    }
  } catch {
    // Network failure, timeout, or abort -> fallback to offline dictionary
  }

  // 3. Check offline fallback dictionary
  if (LOGISTICS_HUB_FALLBACKS[clean]) {
    const fallback = LOGISTICS_HUB_FALLBACKS[clean];
    const details: PincodeDetails = {
      pincode: clean,
      city: fallback.city,
      district: fallback.district,
      state: fallback.state,
      source: 'fallback',
    };
    pincodeCache.set(clean, details);
    return {
      success: true,
      data: details,
    };
  }

  return {
    success: false,
    error: 'PIN code not found in postal directory. You can enter State and City manually.',
  };
}

export const pincodeService = {
  lookupPincode,
  validatePincodeFormat,
};

export default pincodeService;
