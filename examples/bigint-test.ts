import { Buffer } from 'buffer';
import { Bitten, InferObjectFormat, toJS, fromJS } from '../src';

// 定義一個只有 BigInt 字段的測試格式
const bigIntFormat = {
  // 8 位元組（64 位）大整數
  value: {
    startByte: 0,
    length: 8,
    type: 'bigint'
  }
} as const;

type BigIntTestFormat = InferObjectFormat<typeof bigIntFormat>;

// 創建 Bitten 實例
const bitten = new Bitten(bigIntFormat);

// 測試寫入和讀取不同大小的 BigInt 值
const testValues = [
  BigInt(123),                      // 小整數
  BigInt(2147483647),               // 32 位整數最大值
  BigInt('9007199254740991'),       // JavaScript 安全整數最大值
  BigInt('9223372036854775807'),    // 64 位有符號整數最大值
  BigInt('-9223372036854775808'),   // 64 位有符號整數最小值
];

console.log('==== BigInt 讀寫測試 ====');

for (let i = 0; i < testValues.length; i++) {
  const value = testValues[i];
  console.log(`\n測試 BigInt 值: ${value}`);
  
  // 手動寫入 BigInt 到 Buffer
  const buffer = Buffer.alloc(8);
  let tempValue = value < 0n ? value * -1n : value; // 取絕對值
  const negative = value < 0n;
  
  // 將 BigInt 轉換為 8 個字節，按小端序寫入
  for (let j = 0; j < 8; j++) {
    buffer[j] = Number(tempValue & BigInt(0xFF)); // 獲取最低 8 位
    tempValue = tempValue >> BigInt(8); // 右移 8 位
  }
  
  // 如果是負數，進行二的補碼轉換
  if (negative) {
    // 反轉所有位
    for (let j = 0; j < 8; j++) {
      buffer[j] = ~buffer[j] & 0xFF;
    }
    
    // 加 1
    let carry = 1;
    for (let j = 0; j < 8; j++) {
      const sum = buffer[j] + carry;
      buffer[j] = sum & 0xFF;
      carry = sum > 0xFF ? 1 : 0;
    }
  }
  
  console.log('手動寫入的 Buffer:', buffer);
  
  // 使用 Bitten 類讀取
  const parsed = bitten.fromBuffer(buffer);
  console.log('使用 Bitten 讀取:', parsed.value);
  
  // 使用 Bitten 類寫入
  const obj: BigIntTestFormat = { value };
  const resultBuffer = bitten.toBuffer(obj) as Buffer;
  console.log('使用 Bitten 寫入:', resultBuffer);
  
  // 再次使用 Bitten 類讀取
  const resultParsed = bitten.fromBuffer(resultBuffer);
  console.log('再次使用 Bitten 讀取:', resultParsed.value);
  
  // 驗證一致性
  const isConsistent = resultParsed.value === value;
  console.log('讀寫一致性:', isConsistent ? '✓ 通過' : '✗ 失敗');
}

console.log('\n==== 使用 ArrayBuffer 測試 ====');
const testValue = BigInt('1234567890123456');
const obj: BigIntTestFormat = { value: testValue };

// 轉換為 ArrayBuffer
const arrayBuffer = bitten.toBuffer(obj, 'arraybuffer') as ArrayBuffer;
console.log('ArrayBuffer 大小:', arrayBuffer.byteLength);

// 從 ArrayBuffer 解析
const parsedFromArrayBuffer = bitten.fromBuffer(arrayBuffer);
console.log('從 ArrayBuffer 解析:', parsedFromArrayBuffer.value);
console.log('ArrayBuffer 讀寫一致性:', parsedFromArrayBuffer.value === testValue ? '✓ 通過' : '✗ 失敗');

// 使用函數式 API 處理多條記錄的示例
console.log('\n==== 處理多個 BigInt 記錄 ====');
const multipleValues = [
  { value: BigInt(111) },
  { value: BigInt(222) },
  { value: BigInt(333) }
];

// 使用函數式 API 將多個記錄轉換為二進制
const multiBuffer = fromJS(multipleValues, 8, bigIntFormat) as Buffer;
console.log('多個記錄的 Buffer 長度:', multiBuffer.length);

// 使用函數式 API 讀取多個記錄
const parsedMultiple = toJS(multiBuffer, 8, bigIntFormat);
console.log('解析的記錄數量:', parsedMultiple.length);
parsedMultiple.forEach((item, index) => {
  console.log(`記錄 #${index + 1}:`, item.value);
}); 