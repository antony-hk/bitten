import { Bitten, InferObjectFormat } from '../src';
import { Buffer } from 'buffer';

// ==== 定義一個測試格式，包括新的 BigInt 類型 ====
const testFormat = {
  // 8 位元組（64 位）大整數
  bigIntField: {
    startByte: 0,
    length: 8,
    type: 'bigint'
  },
  // 4 位元組（32 位）無符號整數
  uintField: {
    startByte: 8,
    bitLength: 32,
    type: 'uint'
  },
  // 布爾值
  boolField: {
    startByte: 12,
    bitLength: 1,
    type: 'boolean'
  },
  // 字符串
  stringField: {
    startByte: 13,
    length: 10,
    type: 'string'
  }
} as const;

// 測試數據類型
type TestFormat = InferObjectFormat<typeof testFormat>;

// 創建 Bitten 實例
const bitten = new Bitten(testFormat);

// ==== 測試 Buffer 轉 JS 對象 ====
console.log('==== 測試從 Buffer 解析數據 ====');

// 創建測試數據 Buffer
const bigIntValue = BigInt('9223372036854775807'); // JavaScript 最大安全整數的最大值
const buffer = Buffer.alloc(23); // 總長度 = 8 + 4 + 1 + 10 = 23 位元組

// 寫入 BigInt (使用 BigInt 自帶的轉 Buffer 方法，按小端序)
const bigIntBuffer = Buffer.alloc(8);
// 分成 8 個位元組寫入
for (let i = 0; i < 8; i++) {
  bigIntBuffer[i] = Number((bigIntValue >> BigInt(i * 8)) & BigInt(0xFF));
}
bigIntBuffer.copy(buffer, 0);

// 寫入 32 位無符號整數 (1234567890)
buffer.writeUInt32LE(1234567890, 8);

// 寫入布爾值 (true = 1)
buffer[12] = 1;

// 寫入字符串 ("Hello世界")
buffer.write("Hello世界", 13);

// 使用 Bitten 解析數據
const parsed = bitten.fromBuffer(buffer);

// 輸出解析結果
console.log('解析結果:', parsed);
console.log('bigIntField 類型:', typeof parsed.bigIntField);
console.log('bigIntField 值:', parsed.bigIntField.toString());
console.log('uintField 類型:', typeof parsed.uintField);
console.log('boolField 類型:', typeof parsed.boolField);
console.log('stringField 類型:', typeof parsed.stringField);

// ==== 測試 JS 對象轉 Buffer/ArrayBuffer ====
console.log('\n==== 測試將 JS 對象轉為二進制數據 ====');

// 創建測試對象
const testObject: TestFormat = {
  bigIntField: BigInt('1234567890123456'), // 使用一個較小的 BigInt 值
  uintField: 987654321,
  boolField: true,
  stringField: 'Testing123'
};

// 轉換為 Buffer
const resultBuffer = bitten.toBuffer(testObject) as Buffer;
console.log('轉換為 Buffer 結果:', resultBuffer);

// 轉換為 ArrayBuffer
const resultArrayBuffer = bitten.toBuffer(testObject, 'arraybuffer') as ArrayBuffer;
console.log('轉換為 ArrayBuffer 結果 (位元組長度):', resultArrayBuffer.byteLength);

// 從 ArrayBuffer 解析回 JS 對象
console.log('\n==== 測試從 ArrayBuffer 解析數據 ====');
const parsedFromArrayBuffer = bitten.fromBuffer(resultArrayBuffer);
console.log('從 ArrayBuffer 解析結果:', parsedFromArrayBuffer);
console.log('bigIntField 值:', parsedFromArrayBuffer.bigIntField.toString()); 