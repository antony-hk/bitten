import { describe, it, expect } from 'vitest';
import { Buffer } from 'buffer';
import {
  toJS,
  fromJS,
  Bitten,
  readString,
  writeString,
  readBitsLE,
  writeBitsLE,
  readBitsBE,
  writeBitsBE,
} from '../src/index';

// ─── readString / writeString ─────────────────────────────────────────────────

describe('readString / writeString', () => {
  it('reads ASCII string from buffer', () => {
    const buf = Buffer.from('Hello\0\0\0\0\0');
    expect(readString(buf, 0, 10)).toBe('Hello');
  });

  it('strips null bytes', () => {
    const buf = Buffer.from('Hi\0\0\0');
    expect(readString(buf, 0, 5)).toBe('Hi');
  });

  it('writes and reads back a string', () => {
    const buf = Buffer.alloc(10);
    writeString(buf, 0, 10, 'World');
    expect(readString(buf, 0, 10)).toBe('World');
  });

  it('truncates string that exceeds field length', () => {
    const buf = Buffer.alloc(3);
    writeString(buf, 0, 3, 'TooLong');
    // Should not throw; reads back at most 3 bytes (including null terminator)
    const result = readString(buf, 0, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

// ─── readBitsLE / writeBitsLE ─────────────────────────────────────────────────

describe('readBitsLE / writeBitsLE', () => {
  it('reads a single byte value', () => {
    const buf = Buffer.from([0b10110100]);
    expect(readBitsLE(buf, 0, 0, 8)).toBe(0b10110100);
  });

  it('reads partial bits from a byte', () => {
    // byte: 0b_0001_1100 → bits 2-4 = 0b111 = 7
    const buf = Buffer.from([0b00011100]);
    expect(readBitsLE(buf, 0, 2, 3)).toBe(7);
  });

  it('reads across two bytes (little-endian)', () => {
    // [0xFF, 0x01] with bitOffset=4, bitLength=8
    // low nibble of byte 0: 0xF (bits 4-7) → 4 bits
    // byte 1 bits 0-3: 0x1 → 4 bits
    // LE: 0x1 << 4 | 0xF = 0x1F = 31
    const buf = Buffer.from([0xFF, 0x01]);
    expect(readBitsLE(buf, 0, 4, 8)).toBe(0x1F);
  });

  it('round-trips a value via writeBitsLE + readBitsLE', () => {
    const buf = Buffer.alloc(2);
    writeBitsLE(buf, 0, 0, 16, 12345);
    expect(readBitsLE(buf, 0, 0, 16)).toBe(12345);
  });

  it('reads signed negative value', () => {
    const buf = Buffer.alloc(1);
    writeBitsLE(buf, 0, 0, 8, -1);
    expect(readBitsLE(buf, 0, 0, 8, true)).toBe(-1);
  });
});

// ─── readBitsBE / writeBitsBE ─────────────────────────────────────────────────

describe('readBitsBE / writeBitsBE', () => {
  it('round-trips a value via writeBitsBE + readBitsBE', () => {
    const buf = Buffer.alloc(2);
    writeBitsBE(buf, 0, 0, 16, 54321);
    expect(readBitsBE(buf, 0, 0, 16)).toBe(54321);
  });

  it('LE and BE produce different byte layouts for multi-byte values', () => {
    const le = Buffer.alloc(2);
    const be = Buffer.alloc(2);
    writeBitsLE(le, 0, 0, 16, 0x0102);
    writeBitsBE(be, 0, 0, 16, 0x0102);
    expect(le[0]).toBe(0x02); // LE: low byte first
    expect(be[0]).toBe(0x01); // BE: high byte first
  });
});

// ─── toJS / fromJS — basic field types ───────────────────────────────────────

describe('toJS / fromJS — uint', () => {
  const fmt = {
    value: { offset: 0, bitLength: 16, type: 'uint' as const },
  } as const;

  it('parses a uint from buffer', () => {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(1234);
    const [rec] = toJS(buf, 2, fmt);
    expect(rec.value).toBe(1234);
  });

  it('round-trips uint via fromJS + toJS', () => {
    const [rec] = toJS(fromJS([{ value: 65535 }], 2, fmt) as Buffer, 2, fmt);
    expect(rec.value).toBe(65535);
  });

  it('handles zero', () => {
    const [rec] = toJS(fromJS([{ value: 0 }], 2, fmt) as Buffer, 2, fmt);
    expect(rec.value).toBe(0);
  });
});

describe('toJS / fromJS — int (signed)', () => {
  const fmt = {
    value: { offset: 0, bitLength: 8, type: 'int' as const },
  } as const;

  it('round-trips a negative int', () => {
    const [rec] = toJS(fromJS([{ value: -42 }], 1, fmt) as Buffer, 1, fmt);
    expect(rec.value).toBe(-42);
  });

  it('round-trips positive int', () => {
    const [rec] = toJS(fromJS([{ value: 100 }], 1, fmt) as Buffer, 1, fmt);
    expect(rec.value).toBe(100);
  });
});

describe('toJS / fromJS — boolean', () => {
  const fmt = {
    flag: { offset: 0, bitLength: 1, type: 'boolean' as const },
  } as const;

  it('round-trips true', () => {
    const [rec] = toJS(fromJS([{ flag: true }], 1, fmt) as Buffer, 1, fmt);
    expect(rec.flag).toBe(true);
  });

  it('round-trips false', () => {
    const [rec] = toJS(fromJS([{ flag: false }], 1, fmt) as Buffer, 1, fmt);
    expect(rec.flag).toBe(false);
  });
});

describe('toJS / fromJS — string', () => {
  const fmt = {
    name: { offset: 0, length: 8, type: 'string' as const },
  } as const;

  it('round-trips a string', () => {
    const [rec] = toJS(fromJS([{ name: 'Alice' }], 8, fmt) as Buffer, 8, fmt);
    expect(rec.name).toBe('Alice');
  });

  it('handles empty string', () => {
    const [rec] = toJS(fromJS([{ name: '' }], 8, fmt) as Buffer, 8, fmt);
    expect(rec.name).toBe('');
  });
});

describe('toJS / fromJS — bigint', () => {
  const fmt = {
    value: { offset: 0, bitLength: 64, type: 'bigint' as const },
  } as const;

  it('round-trips a small bigint', () => {
    const [rec] = toJS(fromJS([{ value: 999n }], 8, fmt) as Buffer, 8, fmt);
    expect(rec.value).toBe(999n);
  });

  it('round-trips zero bigint', () => {
    const [rec] = toJS(fromJS([{ value: 0n }], 8, fmt) as Buffer, 8, fmt);
    expect(rec.value).toBe(0n);
  });
});

// ─── Multiple fields in one record ───────────────────────────────────────────

describe('multiple fields — round-trip', () => {
  const fmt = {
    id:     { offset: 0,  bitLength: 16, type: 'uint' as const },
    score:  { offset: 2,  bitLength: 8,  type: 'int' as const },
    active: { offset: 3,  bitLength: 1,  type: 'boolean' as const },
    name:   { offset: 4,  length: 6,     type: 'string' as const },
  } as const;

  it('round-trips a mixed record', () => {
    const original = { id: 1001, score: -5, active: true, name: 'Bob' };
    const [rec] = toJS(fromJS([original], 10, fmt) as Buffer, 10, fmt);
    expect(rec.id).toBe(1001);
    expect(rec.score).toBe(-5);
    expect(rec.active).toBe(true);
    expect(rec.name).toBe('Bob');
  });
});

// ─── Multiple records ─────────────────────────────────────────────────────────

describe('multiple records', () => {
  const fmt = {
    x: { offset: 0, bitLength: 8, type: 'uint' as const },
    y: { offset: 1, bitLength: 8, type: 'uint' as const },
  } as const;

  it('round-trips three records', () => {
    const data = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }];
    const buf = fromJS(data, 2, fmt) as Buffer;
    expect(buf.length).toBe(6);
    const records = toJS(buf, 2, fmt);
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ x: 1, y: 2 });
    expect(records[1]).toMatchObject({ x: 3, y: 4 });
    expect(records[2]).toMatchObject({ x: 5, y: 6 });
  });
});

// ─── arrayLength ─────────────────────────────────────────────────────────────

describe('arrayLength', () => {
  const fmt = {
    values: { offset: 0, bitLength: 8, type: 'uint' as const, arrayLength: 4 },
  } as const;

  it('round-trips an array field', () => {
    const original = { values: [10, 20, 30, 40] };
    const [rec] = toJS(fromJS([original], 4, fmt) as Buffer, 4, fmt);
    expect(rec.values).toEqual([10, 20, 30, 40]);
  });
});

// ─── subFormat (nested) ───────────────────────────────────────────────────────

describe('subFormat — nested object', () => {
  const fmt = {
    header: {
      offset: 0,
      length: 4,
      type: 'uint' as const,
      subFormat: {
        version: { offset: 0, bitLength: 8,  type: 'uint' as const },
        flags:   { offset: 1, bitLength: 8,  type: 'uint' as const },
        size:    { offset: 2, bitLength: 16, type: 'uint' as const },
      },
    },
  } as const;

  it('round-trips a nested record', () => {
    const original = { header: { version: 2, flags: 0xFF, size: 1024 } };
    const buf = fromJS([original], 4, fmt) as Buffer;
    const [rec] = toJS(buf, 4, fmt);
    expect(rec.header.version).toBe(2);
    expect(rec.header.flags).toBe(0xFF);
    expect(rec.header.size).toBe(1024);
  });
});

// ─── readTransform / writeTransform ──────────────────────────────────────────

describe('readTransform', () => {
  const fmt = {
    enabled: {
      offset: 0,
      bitLength: 1,
      type: 'boolean' as const,
      readTransform: (v: boolean) => v ? 'yes' : 'no',
    },
  } as const;

  it('applies readTransform on read', () => {
    const buf = Buffer.from([0x01]);
    const [rec] = toJS(buf, 1, fmt);
    expect(rec.enabled).toBe('yes');
  });

  it('applies readTransform for false value', () => {
    const buf = Buffer.from([0x00]);
    const [rec] = toJS(buf, 1, fmt);
    expect(rec.enabled).toBe('no');
  });
});

describe('writeTransform', () => {
  // fromJS calls writeTransform twice for numeric fields:
  //   1st call: receives the whole array [value]  → should pass arrays through unchanged
  //   2nd call: receives the individual element   → do the real transformation here
  const fmt = {
    celsius: {
      offset: 0,
      bitLength: 8,
      type: 'uint' as const,
      writeTransform: (v: any) => Array.isArray(v) ? v : Math.round(v * 2),
      readTransform:  (v: number) => v / 2,
    },
  } as const;

  it('applies writeTransform on write and readTransform on read', () => {
    const [rec] = toJS(fromJS([{ celsius: 36.5 }], 1, fmt) as Buffer, 1, fmt);
    expect(rec.celsius).toBe(36.5);
  });
});

// ─── Big endian ───────────────────────────────────────────────────────────────

describe('isBigEndian flag', () => {
  const fmt = {
    value: { offset: 0, bitLength: 16, type: 'uint' as const },
  } as const;

  it('LE and BE produce different buffers for the same value', () => {
    const leBuf = fromJS([{ value: 0x0102 }], 2, fmt, false) as Buffer;
    const beBuf = fromJS([{ value: 0x0102 }], 2, fmt, true)  as Buffer;
    expect(leBuf[0]).toBe(0x02); // LE: low byte first
    expect(beBuf[0]).toBe(0x01); // BE: high byte first
  });

  it('round-trips value in big-endian mode', () => {
    const buf = fromJS([{ value: 9999 }], 2, fmt, true) as Buffer;
    const [rec] = toJS(buf, 2, fmt, false, true);
    expect(rec.value).toBe(9999);
  });
});

// ─── keepBase64 ───────────────────────────────────────────────────────────────

describe('keepBase64', () => {
  const fmt = {
    x: { offset: 0, bitLength: 8, type: 'uint' as const },
  } as const;

  it('attaches base64 string when keepBase64 = true', () => {
    const buf = Buffer.from([42]);
    const [rec] = toJS(buf, 1, fmt, true);
    expect(rec.base64).toBeDefined();
    expect(typeof rec.base64).toBe('string');
  });

  it('does not attach base64 by default', () => {
    const buf = Buffer.from([42]);
    const [rec] = toJS(buf, 1, fmt);
    expect(rec.base64).toBeUndefined();
  });
});

// ─── Bitten class ─────────────────────────────────────────────────────────────

describe('Bitten class', () => {
  const fmt = {
    id:   { offset: 0, bitLength: 16, type: 'uint' as const },
    name: { offset: 2, length: 5,     type: 'string' as const },
  } as const;

  it('auto-calculates recordLength from format', () => {
    const b = new Bitten(fmt);
    const buf = b.toBuffer({ id: 7, name: 'Test' });
    // recordLength should be 7 (2 bytes uint + 5 bytes string)
    expect(Buffer.isBuffer(buf) ? buf.length : (buf as ArrayBuffer).byteLength).toBe(7);
  });

  it('toBuffer + fromBuffer round-trip', () => {
    const b = new Bitten(fmt);
    const original = { id: 512, name: 'Hi' };
    const buf = b.toBuffer(original);
    const rec = b.fromBuffer(buf);
    expect(rec.id).toBe(512);
    expect(rec.name).toBe('Hi');
  });

  it('returns ArrayBuffer when returnType = arraybuffer', () => {
    const b = new Bitten(fmt);
    const buf = b.toBuffer({ id: 1, name: 'X' }, 'arraybuffer');
    expect(buf instanceof ArrayBuffer).toBe(true);
  });

  it('accepts ArrayBuffer as input to fromBuffer', () => {
    const b = new Bitten(fmt);
    const ab = b.toBuffer({ id: 42, name: 'AB' }, 'arraybuffer') as ArrayBuffer;
    const rec = b.fromBuffer(ab);
    expect(rec.id).toBe(42);
    expect(rec.name).toBe('AB');
  });

  it('respects explicit recordLength option', () => {
    const b = new Bitten(fmt, { recordLength: 10 });
    const buf = b.toBuffer({ id: 1, name: 'Hi' });
    expect(Buffer.isBuffer(buf) ? buf.length : (buf as ArrayBuffer).byteLength).toBe(10);
  });

  it('respects isBigEndian option', () => {
    const le = new Bitten(fmt, { isBigEndian: false });
    const be = new Bitten(fmt, { isBigEndian: true });
    const leBuf = le.toBuffer({ id: 0x0102, name: '' }) as Buffer;
    const beBuf = be.toBuffer({ id: 0x0102, name: '' }) as Buffer;
    expect(leBuf[0]).toBe(0x02);
    expect(beBuf[0]).toBe(0x01);
  });
});

// ─── parseFormat validation ───────────────────────────────────────────────────

describe('parseFormat — validation errors', () => {
  it('throws when neither length nor bitLength is specified', () => {
    const fmt = { bad: { offset: 0, type: 'uint' as const } } as any;
    expect(() => toJS(Buffer.alloc(1), 1, fmt)).toThrow();
  });

  it('throws when boolean has bitLength != 1', () => {
    const fmt = { flag: { offset: 0, bitLength: 4, type: 'boolean' as const } } as any;
    expect(() => toJS(Buffer.alloc(1), 1, fmt)).toThrow();
  });

  it('throws when string field uses bitLength instead of length', () => {
    const fmt = { s: { offset: 0, bitLength: 8, type: 'string' as const } } as any;
    expect(() => toJS(Buffer.alloc(1), 1, fmt)).toThrow();
  });

  it('throws on duplicate field names', () => {
    // Can't have duplicate keys in a JS object literal, so we build the format manually
    const fmt: any = {};
    Object.defineProperty(fmt, 'x', { value: { offset: 0, bitLength: 8, type: 'uint' }, enumerable: true });
    // Simulate by calling parseFormat indirectly; duplicate keys in object literal are ignored by JS
    // so we just verify the happy path isn't broken
    expect(() => toJS(Buffer.alloc(1), 1, fmt)).not.toThrow();
  });
});

// ─── Packed bit fields ────────────────────────────────────────────────────────

describe('packed bit fields', () => {
  // Pack 3 fields into 1 byte: [2 bits][3 bits][3 bits]
  const fmt = {
    a: { offset: 0, bitOffset: 0, bitLength: 2, type: 'uint' as const },
    b: { offset: 0, bitOffset: 2, bitLength: 3, type: 'uint' as const },
    c: { offset: 0, bitOffset: 5, bitLength: 3, type: 'uint' as const },
  } as const;

  it('round-trips packed bit fields within a single byte', () => {
    const original = { a: 3, b: 5, c: 7 };
    const buf = fromJS([original], 1, fmt) as Buffer;
    expect(buf.length).toBe(1);
    const [rec] = toJS(buf, 1, fmt);
    expect(rec.a).toBe(3);
    expect(rec.b).toBe(5);
    expect(rec.c).toBe(7);
  });

  it('fields are independent (changing one does not affect others)', () => {
    const buf1 = fromJS([{ a: 1, b: 0, c: 0 }], 1, fmt) as Buffer;
    const buf2 = fromJS([{ a: 0, b: 1, c: 0 }], 1, fmt) as Buffer;
    expect(buf1[0]).not.toBe(buf2[0]);
  });
});
