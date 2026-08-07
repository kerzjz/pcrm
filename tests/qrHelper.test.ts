import { describe, it, expect } from 'vitest';
import { removeAccents, generateQrMemo, calculateQrAmount, formatCleanMemo, parseQrPrefixesConfig } from '@/lib/qrHelper';

describe('QR Helper Logic (TDD)', () => {
  describe('removeAccents', () => {
    it('should strip Vietnamese accents correctly', () => {
      expect(removeAccents('Nguyễn Văn A')).toBe('Nguyen Van A');
      expect(removeAccents('Gia Hạn Dịch Vụ')).toBe('Gia Han Dich Vu');
      expect(removeAccents('Đường sá')).toBe('Duong sa');
    });
  });

  describe('generateQrMemo', () => {
    it('should generate standard memo without period suffix when period is 1', () => {
      const memo = generateQrMemo('1005', 'Nguyễn Văn A', 'TT GIA HAN', 1);
      expect(memo).toBe('1005 - NGUYEN VAN A - TT GIA HAN');
    });

    it('should append multiplier suffix when period is greater than 1', () => {
      const memo = generateQrMemo('1005', 'Nguyễn Văn A', 'TT GIA HAN', 3);
      expect(memo).toBe('1005 - NGUYEN VAN A - TT GIA HAN X3');
    });

    it('should handle missing service name', () => {
      const memo = generateQrMemo('1005', 'Nguyễn Văn A', '', 12);
      expect(memo).toBe('1005 - NGUYEN VAN A X12');
    });

    it('should return empty if customerId is missing', () => {
      const memo = generateQrMemo('', 'Nguyễn Văn A', 'TT GIA HAN', 1);
      expect(memo).toBe('');
    });
  });

  describe('calculateQrAmount', () => {
    it('should calculate correct multiplied price', () => {
      expect(calculateQrAmount(200000, 1)).toBe(200000);
      expect(calculateQrAmount(200000, 3)).toBe(600000);
      expect(calculateQrAmount(150000, 12)).toBe(1800000);
    });

    it('should fallback gracefully', () => {
      expect(calculateQrAmount(0, 5)).toBe(0);
    });
  });

  describe('formatCleanMemo', () => {
    it('should format clean memo with prefix, service, and period = 1', () => {
      // @ts-ignore
      const memo = formatCleanMemo('AG1', 'Hồ Thị Nhận Duyên', 'TT DV', 'FB T200', 1);
      expect(memo).toBe('AG1 - HO THI NHAN DUYEN - TT DV FB T200');
    });

    it('should format clean memo without transaction prefix', () => {
      // @ts-ignore
      const memo = formatCleanMemo('AG1', 'Hồ Thị Nhận Duyên', '', 'FB T200', 1);
      expect(memo).toBe('AG1 - HO THI NHAN DUYEN - FB T200');
    });

    it('should format clean memo with period > 1', () => {
      // @ts-ignore
      const memo = formatCleanMemo('AG1', 'Hồ Thị Nhận Duyên', 'TT DV', 'FB T200', 3);
      expect(memo).toBe('AG1 - HO THI NHAN DUYEN - TT DV FB T200 - X3');
    });

    it('should prevent prefix duplication if serviceName starts with transactionPrefix', () => {
      // @ts-ignore
      const memo = formatCleanMemo('AG1', 'Hồ Thị Nhận Duyên', 'TT DV', 'TT DV FB T200', 1);
      expect(memo).toBe('AG1 - HO THI NHAN DUYEN - TT DV FB T200');
    });

    it('should return empty if customerId is missing', () => {
      // @ts-ignore
      const memo = formatCleanMemo('', 'Hồ Thị Nhận Duyên', 'TT DV', 'FB T200', 1);
      expect(memo).toBe('');
    });
  });

  describe('DEFAULT_QR_PREFIXES & parseQrPrefixesConfig', () => {
    it('should return default prefixes when raw JSON is invalid or empty', () => {
      // @ts-ignore
      expect(parseQrPrefixesConfig('')).toEqual(['TT DV', 'TT GIA HAN', 'TT HOAN TIEN', 'TT TOOL']);
      // @ts-ignore
      expect(parseQrPrefixesConfig('invalid json')).toEqual(['TT DV', 'TT GIA HAN', 'TT HOAN TIEN', 'TT TOOL']);
    });

    it('should parse valid JSON prefix array', () => {
      // @ts-ignore
      expect(parseQrPrefixesConfig('["TT KH", "TT THANH TOAN"]')).toEqual(['TT KH', 'TT THANH TOAN']);
    });
  });
});
