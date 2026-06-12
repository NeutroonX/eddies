import { parseSms, MIN_CONFIDENCE, type RawSms } from '../parser';

const T = Date.UTC(2026, 5, 12, 9, 30, 0); // fixed timestamp for occurred_at

function sms(address: string, body: string, date = T): RawSms {
  return { address, body, date };
}

describe('parseSms — debits / outflows', () => {
  it('HDFC UPI debit with VPA merchant + ref', () => {
    const p = parseSms(
      sms(
        'VM-HDFCBK',
        'Rs.500.00 debited from a/c **1234 on 12-06-26 to VPA merchant@okhdfcbank Ref 102938475612. Avl Bal Rs.4500.00 -HDFC Bank'
      )
    );
    expect(p).not.toBeNull();
    expect(p!.kind).toBe('outflow');
    expect(p!.amount_minor).toBe(50000);
    expect(p!.account_tail).toBe('1234');
    expect(p!.ref_id).toBe('102938475612');
    expect(p!.merchant).toBe('merchant@okhdfcbank');
    expect(p!.bank_hint).toBe('HDFC');
    expect(p!.occurred_at).toBe(T);
    expect(p!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('SBI debit at merchant with comma + decimals, "a/c no." form', () => {
    const p = parseSms(
      sms(
        'AD-SBIINB',
        'Your a/c no. XX5678 debited for Rs.1,250.50 on 12/06/2026 at AMAZON. Ref no 998877665544 -SBI'
      )
    );
    expect(p!.kind).toBe('outflow');
    expect(p!.amount_minor).toBe(125050);
    expect(p!.account_tail).toBe('5678');
    expect(p!.ref_id).toBe('998877665544');
    expect(p!.merchant).toBe('AMAZON');
    expect(p!.bank_hint).toBe('SBI');
  });

  it('ICICI card spend, no ref id', () => {
    const p = parseSms(
      sms('VK-ICICIB', 'INR 99.00 spent on ICICI Bank Card XX4321 at SWIGGY on 12-Jun-26. Avl limit INR 50000')
    );
    expect(p!.kind).toBe('outflow');
    expect(p!.amount_minor).toBe(9900);
    expect(p!.account_tail).toBe('4321');
    expect(p!.ref_id).toBeNull();
    expect(p!.merchant).toBe('SWIGGY');
    expect(p!.bank_hint).toBe('ICICI');
  });

  it('Axis P2P "Sent ... to NAME" with UPI Ref', () => {
    const p = parseSms(
      sms('JD-AXISBK', 'Sent Rs.300 from Axis Bank A/c x9876 to JOHN DOE on 12/06 UPI Ref 123456789012 -Axis')
    );
    expect(p!.kind).toBe('outflow');
    expect(p!.amount_minor).toBe(30000);
    expect(p!.account_tail).toBe('9876');
    expect(p!.ref_id).toBe('123456789012');
    expect(p!.merchant).toBe('JOHN DOE');
    expect(p!.bank_hint).toBe('AXIS');
  });

  it('Kotak ATM withdrawal', () => {
    const p = parseSms(sms('KOTAKB', 'Rs 2000 withdrawn from A/c XX1111 on 12-06-2026 at ATM'));
    expect(p!.kind).toBe('outflow');
    expect(p!.amount_minor).toBe(200000);
    expect(p!.account_tail).toBe('1111');
    expect(p!.merchant).toBe('ATM');
    expect(p!.bank_hint).toBe('KOTAK');
  });
});

describe('parseSms — credits / inflows', () => {
  it('SBI salary credit', () => {
    const p = parseSms(
      sms('AD-SBIINB', 'Rs.50,000.00 credited to a/c XX5678 on 01-06-2026. UPI Ref no 555444333222 -SBI')
    );
    expect(p!.kind).toBe('inflow');
    expect(p!.amount_minor).toBe(5000000);
    expect(p!.account_tail).toBe('5678');
    expect(p!.ref_id).toBe('555444333222');
    expect(p!.bank_hint).toBe('SBI');
  });

  it('HDFC "Received ... from NAME"', () => {
    const p = parseSms(
      sms('VM-HDFCBK', 'Received Rs.1500 in your A/c XX1234 from RAVI KUMAR on 11-06-26 Ref 778899001122')
    );
    expect(p!.kind).toBe('inflow');
    expect(p!.amount_minor).toBe(150000);
    expect(p!.account_tail).toBe('1234');
    expect(p!.merchant).toBe('RAVI KUMAR');
  });

  it('ICICI refund "by MERCHANT"', () => {
    const p = parseSms(sms('VK-ICICIB', 'INR 250.00 refunded to your ICICI Bank Card XX4321 by AMAZON'));
    expect(p!.kind).toBe('inflow');
    expect(p!.amount_minor).toBe(25000);
    expect(p!.account_tail).toBe('4321');
    expect(p!.merchant).toBe('AMAZON');
  });
});

describe('parseSms — non-transactional (ignored)', () => {
  it('OTP message → null', () => {
    expect(
      parseSms(sms('VM-HDFCBK', '123456 is your OTP for txn of Rs.500 at AMAZON. Do not share. -HDFC'))
    ).toBeNull();
  });

  it('promotional offer → null', () => {
    expect(
      parseSms(sms('AD-SBIINB', 'Get 10% discount! Spend Rs.2000 and win cashback. Apply now -SBI'))
    ).toBeNull();
  });

  it('balance enquiry (no direction verb) → null', () => {
    expect(
      parseSms(sms('VM-HDFCBK', 'Avl Bal in A/c XX1234 is Rs.4500.00 as on 12-06-26 -HDFC'))
    ).toBeNull();
  });

  it('statement notice (no amount) → null', () => {
    expect(parseSms(sms('AD-SBIINB', 'Your A/c XX1234 statement is ready. -SBI'))).toBeNull();
  });

  it('empty body → null', () => {
    expect(parseSms(sms('X', ''))).toBeNull();
  });
});

describe('parseSms — confidence gate', () => {
  it('amount + direction alone clears MIN_CONFIDENCE', () => {
    const p = parseSms(sms('X', 'Rs.100 debited'));
    expect(p).not.toBeNull();
    expect(p!.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
  });

  it('truncates raw_excerpt and never exceeds the cap', () => {
    const long = 'Rs.100 debited from a/c XX1234 ' + 'x'.repeat(300);
    const p = parseSms(sms('X', long));
    expect(p!.raw_excerpt.length).toBeLessThanOrEqual(140);
  });
});
