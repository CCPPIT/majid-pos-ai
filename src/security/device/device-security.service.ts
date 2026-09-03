/**
 * خدمة سلامة الجهاز (PHASE 26).
 * تغلّف استعلامات المنصة (هل جهاز حقيقي؟ عتاد/تسجيل البصمة) وتغذّي منطق
 * المجال النقي `buildDeviceReport`. خارج الاختبارات تعمل عبر expo-device
 * وexpo-local-authentication؛ في الاختبارات تُحقن حقائق وهمية.
 */
import * as Device from 'expo-device';

import { buildDeviceReport } from '@/domain/security-lock';
import type { DeviceFacts, DeviceSecurityReport } from '@/domain/security-lock';
import { getBiometricCapability } from '@/security/biometric/biometric';

// منفذ قابل للحقن (لتسهيل الاختبار والمنصات غير المدعومة).
export interface DeviceFactsPort {
  getFacts(): Promise<DeviceFacts>;
}

// منفذ الجهاز الحقيقي (يعتمد على المنصة).
export class PlatformDeviceFactsPort implements DeviceFactsPort {
  async getFacts(): Promise<DeviceFacts> {
    // نجمع نوع الجهاز وقدرات البصمة بالتوازي.
    const [isDevice, biometric] = await Promise.all([
      Promise.resolve(Device.isDevice ?? false),
      getBiometricCapability(),
    ]);
    return {
      isDevice,
      hasBiometricHardware: biometric.available || biometric.enrolled,
      biometricEnrolled: biometric.enrolled,
      biometricKind: biometric.kind,
    };
  }
}

// يبني تقرير سلامة الجهاز عبر منطق المجال النقي.
export async function getDeviceSecurityReport(port: DeviceFactsPort = new PlatformDeviceFactsPort()): Promise<DeviceSecurityReport> {
  const facts = await port.getFacts();
  return buildDeviceReport(facts);
}
