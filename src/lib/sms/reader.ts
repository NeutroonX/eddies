/**
 * Swappable SMS-reader boundary. The rest of the app depends only on the
 * `SmsReader` interface, never on a concrete native module — so the dependency
 * can be replaced without touching parser/scan/UI code (roadmap §5.3.3).
 *
 * Android uses `react-native-get-sms-android` (lazy-required, so importing this
 * file never throws when the native module isn't installed yet — e.g. before the
 * dev-client rebuild, or in Jest). Everywhere else (iOS/web) a NullReader makes
 * the feature a graceful no-op.
 */
import { Platform } from 'react-native';

import type { RawSms } from '@/lib/sms/parser';

export type SmsListOptions = {
  /** Only return messages newer than this epoch-ms watermark. */
  sinceMs?: number;
  /** Hard cap on returned rows (first scan / huge inbox protection). */
  maxCount?: number;
};

export interface SmsReader {
  /** Platform can read SMS at all (Android only). */
  isSupported(): boolean;
  hasPermission(): Promise<boolean>;
  /** Triggers the OS permission prompt; resolves to the granted state. */
  requestPermission(): Promise<boolean>;
  list(opts?: SmsListOptions): Promise<RawSms[]>;
}

/** iOS / web / unsupported: the feature does nothing and never errors. */
export class NullSmsReader implements SmsReader {
  isSupported(): boolean {
    return false;
  }
  async hasPermission(): Promise<boolean> {
    return false;
  }
  async requestPermission(): Promise<boolean> {
    return false;
  }
  async list(): Promise<RawSms[]> {
    return [];
  }
}

/** In-memory reader for tests and dev seeding. */
export class MockSmsReader implements SmsReader {
  constructor(
    private messages: RawSms[] = [],
    private granted = true
  ) {}
  isSupported(): boolean {
    return true;
  }
  async hasPermission(): Promise<boolean> {
    return this.granted;
  }
  async requestPermission(): Promise<boolean> {
    this.granted = true;
    return true;
  }
  async list(opts: SmsListOptions = {}): Promise<RawSms[]> {
    if (!this.granted) return [];
    let out = this.messages;
    if (opts.sinceMs != null) out = out.filter((m) => m.date > opts.sinceMs!);
    out = [...out].sort((a, b) => b.date - a.date);
    if (opts.maxCount != null) out = out.slice(0, opts.maxCount);
    return out;
  }
}

type NativeSms = { _id?: string; address?: string; body?: string; date?: string | number };

/** Android implementation over react-native-get-sms-android. */
export class AndroidSmsReader implements SmsReader {
  isSupported(): boolean {
    return Platform.OS === 'android';
  }

  async hasPermission(): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PermissionsAndroid } = require('react-native');
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
  }

  async requestPermission(): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PermissionsAndroid } = require('react-native');
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
      title: 'Read transaction SMS',
      message:
        'Eddies reads bank & UPI SMS on your device to suggest transactions. ' +
        'Nothing leaves your phone.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }

  async list(opts: SmsListOptions = {}): Promise<RawSms[]> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SmsAndroid = require('react-native-get-sms-android');
    const filter: Record<string, unknown> = { box: 'inbox' };
    if (opts.sinceMs != null) filter.minDate = opts.sinceMs;
    if (opts.maxCount != null) filter.maxCount = opts.maxCount;

    return new Promise<RawSms[]>((resolve, reject) => {
      SmsAndroid.list(
        JSON.stringify(filter),
        (err: string) => reject(new Error(err)),
        (_count: number, smsListJson: string) => {
          let list: NativeSms[] = [];
          try {
            const parsed = JSON.parse(smsListJson);
            // Native payload is untyped; guard before .map to avoid a TypeError
            // thrown inside this success callback (escapes the Promise → crash).
            list = Array.isArray(parsed) ? (parsed as NativeSms[]) : [];
          } catch {
            list = [];
          }
          resolve(
            list.map((m) => ({
              id: m._id != null ? String(m._id) : undefined,
              address: m.address ?? '',
              body: m.body ?? '',
              date: Number(m.date ?? 0),
            }))
          );
        }
      );
    });
  }
}

/** Factory: the right reader for the current platform. */
export function createSmsReader(): SmsReader {
  return Platform.OS === 'android' ? new AndroidSmsReader() : new NullSmsReader();
}
