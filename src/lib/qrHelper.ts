/**
 * Remove Vietnamese accents and special characters
 */
export function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '');
}

/**
 * Generate the standard banking QR memo string
 */
export function generateQrMemo(
  customerId: string,
  customerName: string,
  serviceName: string,
  period: number
): string {
  if (!customerId) return '';
  const namePart = removeAccents(customerName).toUpperCase();
  const servicePart = removeAccents(serviceName).toUpperCase();
  let memo = `${customerId} - ${namePart}`;
  if (servicePart) {
    memo += ` - ${servicePart}`;
  }
  if (period > 1) {
    memo += ` X${period}`;
  }
  return memo;
}

// @para-doc [#csa-config-qr-prefixes]
export const DEFAULT_QR_PREFIXES = ['TT DV', 'TT GIA HAN', 'TT HOAN TIEN', 'TT TOOL'];

/**
 * Safely parse JSON array string for transaction prefixes with fallback defaults
 */
export function parseQrPrefixesConfig(rawJson?: string | null): string[] {
  if (!rawJson) return DEFAULT_QR_PREFIXES;
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Return fallback on JSON parse error
  }
  return DEFAULT_QR_PREFIXES;
}

// @para-doc [#csa-qr-tool-clean-memo]
/**
 * Constructs a clean payment memo string without duplicated prefixes.
 */
export function formatCleanMemo(
  customerId: string,
  customerName: string,
  transactionPrefix: string,
  serviceName: string,
  period: number = 1
): string {
  if (!customerId) return '';

  const cleanName = removeAccents(customerName).toUpperCase();
  const cleanService = removeAccents(serviceName).toUpperCase();
  const cleanPrefix = removeAccents(transactionPrefix).toUpperCase();

  const memoParts: string[] = [`${customerId} - ${cleanName}`];

  let serviceSegment = '';
  if (cleanPrefix) {
    serviceSegment = cleanPrefix;
  }

  if (cleanService) {
    if (serviceSegment) {
      if (cleanService.startsWith(serviceSegment)) {
        serviceSegment = cleanService;
      } else {
        serviceSegment += ` ${cleanService}`;
      }
    } else {
      serviceSegment = cleanService;
    }
  }

  if (serviceSegment) {
    memoParts.push(serviceSegment);
  }

  if (period > 1) {
    memoParts.push(`X${period}`);
  }

  return memoParts.join(' - ');
}

/**
 * Calculate final amount based on base price and periods multiplier
 */
export function calculateQrAmount(basePrice: number, period: number): number {
  return (basePrice || 0) * (period || 1);
}
