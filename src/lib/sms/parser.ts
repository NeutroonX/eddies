/**
 * On-device parser for Indian bank / UPI transactional SMS.
 *
 * Pure and synchronous by design — every branch is unit-tested against a fixture
 * corpus (see __tests__/parser.test.ts). No SMS text ever leaves this module
 * except as a short `raw_excerpt` that the caller keeps on-device.
 *
 * Strategy: extract amount + direction (both required), then opportunistically
 * pull account tail, reference id, merchant and bank hint. Each signal adds to a
 * confidence score; below MIN_CONFIDENCE the message is treated as non-financial
 * (OTP, promo, balance enquiry) and ignored.
 */

export type RawSms = {
  /** Stable id from the device inbox, when available. */
  id?: string;
  /** Sender address, e.g. "VM-HDFCBK". Used for the bank hint. */
  address: string;
  body: string;
  /** SMS timestamp, epoch milliseconds. Becomes `occurred_at`. */
  date: number;
};

export type ParsedSms = {
  amount_minor: number;
  /** debit → outflow, credit → inflow. SMS never yields transfers. */
  kind: 'outflow' | 'inflow';
  merchant: string | null;
  account_tail: string | null;
  ref_id: string | null;
  occurred_at: number;
  bank_hint: string | null;
  confidence: number;
  /** Short, on-device-only snippet for provenance. Never uploaded. */
  raw_excerpt: string;
};

// Below this, the message is not a usable transaction. amount+direction alone
// clears the bar (0.45 + 0.30 = 0.75); amount-only (0.45) does not.
export const MIN_CONFIDENCE = 0.55;

const EXCERPT_MAX = 140;

// Strong non-transactional signals — drop even if an amount sneaks in.
const PROMO_DENYLIST =
  /\b(otp|one[\s-]?time\s?password|verification code|do not share|won|congratulations|claim|voucher|discount|apply now|loan offer|pre[\s-]?approved|sale ends)\b/i;

const OUTFLOW_RE =
  /\b(debited|debit|spent|paid|sent|withdrawn|withdrawal|purchase[d]?|deducted)\b/i;
const INFLOW_RE =
  /\b(credited|credit|received|deposited|refund(?:ed)?|added)\b/i;

// "Rs.500.00" / "INR 1,200.50" / "₹1,00,000" — Indian grouping (lakh) tolerated.
const AMOUNT_RE = /(?:rs|inr|₹)\.?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;

const ACCOUNT_TAIL_RES = [
  // "a/c **1234" · "a/c no. XX5678" · "Card XX4321" · "A/c x9876"
  // Consume label, optional "no."/spaces, then the mask chars (x/*), then digits.
  /(?:a\/c|ac|acct|account|card)\b[^x*\d]{0,10}[x*]+\s*(\d{3,4})\b/i,
  /\bending(?:\s+in)?\s+(\d{3,4})\b/i,
];

const REF_RES = [
  /\b(?:upi\s*ref(?:erence)?(?:\s*no)?|ref(?:erence)?(?:\s*no)?|txn(?:\s*id)?|utr)\b[^0-9a-z]{0,4}([0-9]{6,}|[0-9a-z]{8,})/i,
];

const MERCHANT_RES = [
  /\b(?:to vpa|vpa)\s+([a-z0-9.\-_]+@[a-z]{2,})/i,
  /\bat\s+([A-Za-z][A-Za-z0-9&.'\- ]{1,28}?)(?=\s+(?:on|ref|upi|avl|bal)\b|[.,]|$)/i,
  /\bto\s+([A-Za-z][A-Za-z0-9&.'\- ]{1,28}?)(?=\s+(?:on|ref|upi)\b|[.,]|$)/i,
  /\bfrom\s+([A-Za-z][A-Za-z0-9&.'\- ]{1,28}?)(?=\s+(?:on|ref|upi)\b|[.,]|$)/i,
  /\bby\s+([A-Za-z][A-Za-z0-9&.'\- ]{1,28}?)(?=\s+(?:on|ref|upi)\b|[.,]|$)/i,
];

// Known issuer tokens → normalized bank hint.
const BANK_TOKENS: [RegExp, string][] = [
  [/hdfc/i, 'HDFC'],
  [/icici/i, 'ICICI'],
  [/\bsbi\b|sbiinb|state bank/i, 'SBI'],
  [/axis/i, 'AXIS'],
  [/kotak/i, 'KOTAK'],
  [/\bpnb\b|punjab national/i, 'PNB'],
  [/\bbob\b|bank of baroda/i, 'BOB'],
  [/idfc/i, 'IDFC'],
  [/indusind/i, 'INDUSIND'],
  [/\byes\s?bank|yesbnk\b/i, 'YES'],
  [/canara/i, 'CANARA'],
  [/union bank|unionbk/i, 'UNION'],
  [/\brbl\b/i, 'RBL'],
  [/federal/i, 'FEDERAL'],
];

function parseAmountMinor(body: string): number | null {
  const m = AMOUNT_RE.exec(body);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function detectKind(body: string): 'outflow' | 'inflow' | null {
  const out = OUTFLOW_RE.exec(body);
  const inn = INFLOW_RE.exec(body);
  if (out && inn) return out.index <= inn.index ? 'outflow' : 'inflow';
  if (out) return 'outflow';
  if (inn) return 'inflow';
  return null;
}

function firstMatch(res: RegExp[], body: string): string | null {
  for (const re of res) {
    const m = re.exec(body);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function detectBank(address: string, body: string): string | null {
  for (const [re, name] of BANK_TOKENS) {
    if (re.test(address) || re.test(body)) return name;
  }
  return null;
}

export function parseSms(sms: RawSms): ParsedSms | null {
  const body = sms.body ?? '';
  if (PROMO_DENYLIST.test(body)) return null;

  const amount_minor = parseAmountMinor(body);
  const kind = detectKind(body);
  // amount + direction are both mandatory — this gate rejects OTP/promo/balance.
  if (amount_minor === null || kind === null) return null;

  const account_tail = firstMatch(ACCOUNT_TAIL_RES, body);
  const ref_id = firstMatch(REF_RES, body);
  const rawMerchant = firstMatch(MERCHANT_RES, body);
  const merchant = rawMerchant ? rawMerchant.replace(/\s+/g, ' ').trim() : null;
  const bank_hint = detectBank(sms.address ?? '', body);

  let confidence = 0.45 + 0.3; // amount + direction (both guaranteed here)
  if (account_tail) confidence += 0.15;
  if (ref_id) confidence += 0.07;
  if (merchant) confidence += 0.03;
  confidence = Math.min(1, confidence);

  if (confidence < MIN_CONFIDENCE) return null;

  return {
    amount_minor,
    kind,
    merchant,
    account_tail,
    ref_id,
    occurred_at: sms.date,
    bank_hint,
    confidence,
    raw_excerpt: body.slice(0, EXCERPT_MAX),
  };
}
