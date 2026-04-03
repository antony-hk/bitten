import { ObjectFormat, toJS, fromJS, InferObjectFormat, createBuffer } from '../src';
import { Buffer } from 'buffer';

// 定義一個包含 ArrayBuffer 類型字段的測試格式
const arrayBufferFormat = {
  // 標頭字段（用於識別）
  header: {
    startByte: 0,
    length: 4,
    type: 'string'
  },
  // 8 位元組的 ArrayBuffer 字段
  rawData: {
    startByte: 4,
    length: 8,
    type: 'arraybuffer',
    subFormat: {
        test: {
            startByte: 0,
            length: 8,
            type: 'uint'
        }
    }
  },
  // 後續的整數字段
  count: {
    startByte: 12,
    bitLength: 32,
    type: 'uint'
  }
} as const;

// 從格式定義推導類型
type ArrayBufferTest = InferObjectFormat<typeof arrayBufferFormat>;

console.log('==== ArrayBuffer 字段類型測試 ====');

// 創建測試數據
const testData: ArrayBufferTest = {
  header: 'TEST',
  // 創建一個包含 1-8 數字的 ArrayBuffer
  rawData: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
  count: 12345
};

console.log('原始對象:', {
  header: testData.header,
  rawData: new Uint8Array(testData.rawData),
  count: testData.count
});

// 使用 createBuffer 將對象轉換為 Buffer
const buffer = createBuffer(testData, arrayBufferFormat) as Buffer;

console.log('轉換後的 Buffer 長度:', buffer.length);
console.log('轉換後的 Buffer 內容:', buffer);

// 使用 toJS 從 Buffer 解析回對象
const parsed = toJS(buffer, buffer.length, arrayBufferFormat);

// 為了更好地顯示 ArrayBuffer 的內容，轉換為 Uint8Array
const parsedRawDataArray = new Uint8Array(parsed[0].rawData);
console.log('解析結果:');
console.log('- header:', parsed[0].header);
console.log('- rawData (Uint8Array):', Array.from(parsedRawDataArray));
console.log('- count:', parsed[0].count);

// 測試類型正確性
console.log('\n類型檢測:');
console.log('- header 類型:', typeof parsed[0].header);
console.log('- rawData 是否為 ArrayBuffer:', parsed[0].rawData instanceof ArrayBuffer);
console.log('- count 類型:', typeof parsed[0].count);

// 測試帶有自定義轉換函數的 ArrayBuffer 字段
console.log('\n==== 測試帶有自定義轉換函數的 ArrayBuffer 字段 ====');

// 定義一個帶有自定義轉換的格式
const customFormat = {
  // 二進制圖像數據轉為 Base64 字符串
  imageData: {
    startByte: 0,
    length: 12,
    type: 'arraybuffer',
    readTransform: (buffer: ArrayBuffer) => {
      // 將二進制數據轉換為 Base64 字符串
      return Buffer.from(buffer).toString('base64');
    },
    writeTransform: (base64: string) => {
      // 將 Base64 字符串轉回二進制數據
      return Buffer.from(base64, 'base64');
    }
  }
} as const;

// 使用自定義字段類型
type CustomTest = InferObjectFormat<typeof customFormat>;

// 檢測 TypeScript 是否正確推導類型
// 下面的註釋說明了在 TypeScript 中推導出的類型
// imageData 應該被推導為 string 類型，因為 readTransform 返回字符串
const typeCheck: CustomTest = {
  imageData: 'SGVsbG8gV29ybGQ=' // 這個是 "Hello World" 的 Base64 編碼
};

// 創建測試數據
const imageBuffer = Buffer.from('Hello World');
const testObj = {
  imageData: imageBuffer.toString('base64')
};

// 轉換為 Buffer
const customBuffer = createBuffer(testObj, customFormat) as Buffer;
console.log('轉換後的 Buffer:', customBuffer);

// 解析回對象
const parsedCustom = toJS(customBuffer, customBuffer.length, customFormat);
console.log('解析結果 (Base64):', parsedCustom[0].imageData);
console.log('解析結果 (解碼):', Buffer.from(parsedCustom[0].imageData, 'base64').toString());

// 類型檢測
console.log('imageData 類型:', typeof parsedCustom[0].imageData); 