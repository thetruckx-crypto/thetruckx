/**
 * NECL Indian Freight & Currency Formatters
 * 100% Free / In-Memory Utility
 */

export function formatINR(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eightteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n > 0) {
    if (n < 20) {
      str += ONES[n] + ' ';
    } else {
      str += TENS[Math.floor(n / 10)] + ' ';
      if (n % 10 > 0) {
        str += ONES[n % 10] + ' ';
      }
    }
  }
  return str.trim();
}

/**
 * Converts a numeric amount to Indian Rupee Words
 * Example: 145000 -> "One Lakh Forty-Five Thousand Rupees"
 */
export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount <= 0) return '';
  const rounded = Math.floor(amount);
  if (rounded === 0) return 'Zero Rupees';

  let remaining = rounded;
  let result = '';

  // Crores (1,00,00,000)
  if (remaining >= 10000000) {
    const crores = Math.floor(remaining / 10000000);
    result += convertBelowThousand(crores) + ' Crore ';
    remaining %= 10000000;
  }

  // Lakhs (1,00,000)
  if (remaining >= 100000) {
    const lakhs = Math.floor(remaining / 100000);
    result += convertBelowThousand(lakhs) + ' Lakh ';
    remaining %= 100000;
  }

  // Thousands (1,000)
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    result += convertBelowThousand(thousands) + ' Thousand ';
    remaining %= 1000;
  }

  // Below thousand (hundreds, tens, ones)
  if (remaining > 0) {
    result += convertBelowThousand(remaining) + ' ';
  }

  return result.trim() + ' Rupees Only';
}

/**
 * Metric Ton to Kilogram conversion
 */
export function mtToKg(mt: number): number {
  if (isNaN(mt) || mt <= 0) return 0;
  return Math.round(mt * 1000 * 100) / 100;
}

/**
 * Kilogram to Metric Ton conversion
 */
export function kgToMt(kg: number): number {
  if (isNaN(kg) || kg <= 0) return 0;
  return Math.round((kg / 1000) * 1000) / 1000;
}
