/**
 * Pincode Lookup Service
 * Uses Postal Pincode API with timeout, in-memory caching,
 * and offline logistics hub fallbacks.
 */

export interface PincodeDetails {
  city: string;
  state: string;
  district?: string;
}

// In-memory cache for fast lookups
const pincodeCache = new Map<string, PincodeDetails>();

// Common logistics corridor hubs fallback
const LOGISTICS_HUB_FALLBACKS: Record<string, PincodeDetails> = {
  // Assam & North East Hubs
  "781001": { city: "Guwahati", state: "Assam", district: "Kamrup Metropolitan" },
  "781005": { city: "Dispur", state: "Assam", district: "Kamrup Metropolitan" },
  "781015": { city: "Guwahati", state: "Assam", district: "Kamrup Metropolitan" },
  "786001": { city: "Dibrugarh", state: "Assam", district: "Dibrugarh" },
  "785001": { city: "Jorhat", state: "Assam", district: "Jorhat" },
  "788001": { city: "Silchar", state: "Assam", district: "Cachar" },
  "783001": { city: "Dhubri", state: "Assam", district: "Dhubri" },
  "784001": { city: "Tezpur", state: "Assam", district: "Sonitpur" },
  "793001": { city: "Shillong", state: "Meghalaya", district: "East Khasi Hills" },
  "799001": { city: "Agartala", state: "Tripura", district: "West Tripura" },
  "795001": { city: "Imphal", state: "Manipur", district: "Imphal West" },
  "796001": { city: "Aizawl", state: "Mizoram", district: "Aizawl" },
  "797112": { city: "Dimapur", state: "Nagaland", district: "Dimapur" },
  "797001": { city: "Kohima", state: "Nagaland", district: "Kohima" },
  "791111": { city: "Itanagar", state: "Arunachal Pradesh", district: "Papum Pare" },
  "737101": { city: "Gangtok", state: "Sikkim", district: "East Sikkim" },

  // Eastern & National Freight Corridors
  "700001": { city: "Kolkata", state: "West Bengal", district: "Kolkata" },
  "711101": { city: "Howrah", state: "West Bengal", district: "Howrah" },
  "734001": { city: "Siliguri", state: "West Bengal", district: "Darjeeling" },
  "800001": { city: "Patna", state: "Bihar", district: "Patna" },
  "834001": { city: "Ranchi", state: "Jharkhand", district: "Ranchi" },
  "751001": { city: "Bhubaneswar", state: "Odisha", district: "Khordha" },
  "752054": { city: "Paradip Port", state: "Odisha", district: "Jagatsinghpur" },
  "110001": { city: "New Delhi", state: "Delhi", district: "Central Delhi" },
  "122001": { city: "Gurugram", state: "Haryana", district: "Gurugram" },
  "201301": { city: "Noida", state: "Uttar Pradesh", district: "Gautam Buddha Nagar" },
  "400001": { city: "Mumbai", state: "Maharashtra", district: "Mumbai" },
  "411001": { city: "Pune", state: "Maharashtra", district: "Pune" },
  "440001": { city: "Nagpur", state: "Maharashtra", district: "Nagpur" },
  "380001": { city: "Ahmedabad", state: "Gujarat", district: "Ahmedabad" },
  "394210": { city: "Surat", state: "Gujarat", district: "Surat" },
  "560001": { city: "Bengaluru", state: "Karnataka", district: "Bengaluru Urban" },
  "600001": { city: "Chennai", state: "Tamil Nadu", district: "Chennai" },
  "500001": { city: "Hyderabad", state: "Telangana", district: "Hyderabad" },
  "530001": { city: "Visakhapatnam", state: "Andhra Pradesh", district: "Visakhapatnam" }
};

export const pincodeService = {
  /**
   * Resolve 6-digit Indian PIN code to City, State, and District
   */
  async fetchPincode(pin: string): Promise<PincodeDetails | null> {
    const cleanedPin = pin.trim().replace(/\D/g, "");
    if (cleanedPin.length !== 6) {
      return null;
    }

    // 1. Check in-memory cache
    if (pincodeCache.has(cleanedPin)) {
      return pincodeCache.get(cleanedPin)!;
    }

    // 2. Query Postal Pincode API with 5s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanedPin}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data[0]?.Status === "Success" && Array.isArray(data[0].PostOffice) && data[0].PostOffice.length > 0) {
          const po = data[0].PostOffice[0];
          const result: PincodeDetails = {
            city: po.District || po.Block || po.Name || "",
            state: po.State || "",
            district: po.District || ""
          };
          pincodeCache.set(cleanedPin, result);
          return result;
        }
      }
    } catch {
      // Ignore network timeout or fetch errors and fall back gracefully
    }

    // 3. Fall back to offline logistics hub directory
    if (LOGISTICS_HUB_FALLBACKS[cleanedPin]) {
      const fallback = LOGISTICS_HUB_FALLBACKS[cleanedPin];
      pincodeCache.set(cleanedPin, fallback);
      return fallback;
    }

    return null;
  },

  /**
   * Enhanced lookup returning structured status, source, and error for UI notifications
   */
  async lookupPincode(pin: string): Promise<{
    success: boolean;
    data?: PincodeDetails & { source?: string };
    error?: string;
  }> {
    const cleanedPin = pin.trim().replace(/\D/g, "");
    const details = await this.fetchPincode(cleanedPin);
    if (details && details.city && details.state) {
      const isFallback = Boolean(LOGISTICS_HUB_FALLBACKS[cleanedPin]);
      return {
        success: true,
        data: {
          ...details,
          source: isFallback ? "fallback" : "api",
        },
      };
    }
    return {
      success: false,
      error: "PIN code not found in postal directory. Please enter City and State manually.",
    };
  },
};
