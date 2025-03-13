import { Buffer } from 'buffer';
import { ObjectFormat, toJS, fromJS, InferObjectFormat } from '../src/index';

// ==== 格式定義部分 ====

// 測試各種類型嘅字段格式
// 使用 as const 確保類型推導嘅準確性（類型會保持字面量類型而非擴大）
const typesFormat = {
  // 布爾類型：佔用1個位元，從第0個位元組嘅第0位開始
  boolField: {
    startByte: 0,
    bitLength: 1,
    type: 'boolean',
    readTransform: (input: boolean) => input ? "test" : "null",
    writeTransform: (input: string) => true,
  },
  
  // 無符號整數：佔用7個位元，從第0個位元組嘅第1位開始
  uintField: { startByte: 0, startBit: 1, bitLength: 7, type: 'uint' },
  
  // 有符號整數：佔用8個位元（1位元組），從第1個位元組開始
  intField: { startByte: 1, bitLength: 8, type: 'int' },
  
  // 字符串：佔用5個位元組，從第2個位元組開始
  stringField: { startByte: 2, length: 5, type: 'string' },
  
  // 另一個字符串：佔用3個位元組，從第7個位元組開始
  legacyString: { startByte: 7, length: 3, type: 'string' },
  
  // 另一個有符號整數：佔用8個位元（1位元組），從第10個位元組開始
  legacyInt: { startByte: 10, bitLength: 8, type: 'int' }
} as const;

// 添加這裡：輸出格式定義中的 readTransform
console.log("\n格式定義詳情:");
console.log("boolField readTransform:", typesFormat.boolField.readTransform);
console.log("boolField readTransform TYPE:", typeof typesFormat.boolField.readTransform);
console.log("boolField type:", typeof true);

// 輸出格式類型推導
console.log("\n類型推導測試:");
import { FormatFieldType } from '../src/index';
type BoolFieldType = FormatFieldType<typeof typesFormat.boolField>;
console.log("推導的 BoolFieldType 應該是 string 類型");

// 測試布爾值數組嘅格式
const boolArrayFormat = {
  // 布爾數組：每個值佔用1個位元，總共8個值，從第0個位元組開始
  flags: { startByte: 0, bitLength: 1, type: 'boolean', arrayLength: 8 }
} as const;

// ==== 測試數據部分 ====

// 創建一個測試用嘅二進制數據緩衝區
// 0x81: 10000001 - 布爾 true (1) 和 uint 64 (1000000)
// 0xFF: 11111111 - 有符號整數 -1 (補碼表示)
// 0x41,0x42,0x43,0x00,0x00: "ABC" 字符串加填充
// 0x58,0x59,0x5A: "XYZ" 字符串
// 0xFF: 11111111 - 有符號整數 -1 (補碼表示)
const testBuffer = Buffer.from([0x81, 0xFF, 0x41, 0x42, 0x43, 0x00, 0x00, 0x58, 0x59, 0x5A, 0xFF]);

// ==== 測試解析部分 ====

// 使用 toJS 函數將二進制數據解析為 JavaScript 對象
// 參數：二進制數據、每條記錄長度（11位元組）、格式定義
const result = toJS(testBuffer, 11, typesFormat);
const data = result[0]; // 獲取第一條記錄

// 檢查各字段嘅值和類型，顯示解析結果
console.log('布爾字段:', data.boolField, '類型:', typeof data.boolField);
console.log('無符號整數:', data.uintField, '類型:', typeof data.uintField);
console.log('有符號整數:', data.intField, '類型:', typeof data.intField);
console.log('字符串字段:', data.stringField, '類型:', typeof data.stringField);
console.log('舊式字符串:', data.legacyString, '類型:', typeof data.legacyString);
console.log('舊式整數:', data.legacyInt, '類型:', typeof data.legacyInt);

// 添加更詳細的檢查
console.log("\n更詳細的測試:");
// 檢查值是否確實是特定類型的實例
console.log("data.boolField 是否原始字符串:", typeof data.boolField === 'string');
console.log("data.boolField 的直接輸出:", String(data.boolField));

// ==== 測試布爾數組部分 ====

// 創建一個測試用嘅二進制數據緩衝區，表示8個布爾值
// 0xA5: 10100101 - 表示 [true, false, true, false, false, true, false, true]
const boolArrayBuffer = Buffer.from([0xA5]);

// 使用 toJS 函數將二進制數據解析為 JavaScript 對象
const boolResult = toJS(boolArrayBuffer, 1, boolArrayFormat);
const boolData = boolResult[0];

// 輸出布爾數組內容及其類型
console.log('布爾數組:', boolData.flags);
console.log('數組各值類型:', boolData.flags.map(f => typeof f).join(', '));

// ==== 測試寫入部分 ====

// 創建一個新嘅 JavaScript 對象，準備寫入二進制
const newData = {
  boolField: "true" as any, // 修正：應該是字符串類型
  uintField: 42,
  intField: -10,
  stringField: 'Hello',
  legacyString: 'Old',
  legacyInt: -5
};

// 使用 fromJS 函數將對象轉換為二進制數據
// 參數：對象數組、每條記錄長度（11位元組）、格式定義
const newBuffer = fromJS([newData], 11, typesFormat);
console.log('寫入後的Buffer:', newBuffer);

// 再次使用 toJS 函數將寫入嘅二進制數據解析回 JavaScript 對象
// 用於驗證寫入是否成功
const verifyResult = toJS(newBuffer, 11, typesFormat);
const verifyData = verifyResult[0];
console.log('驗證數據:', verifyData);

// ==== 測試布爾數組寫入部分 ====

// 創建一個包含布爾值數組嘅對象
const newBoolData = {
  flags: [true, false, true, true, false, false, true, false]
};

// 使用 fromJS 函數將對象轉換為二進制數據
const newBoolBuffer = fromJS([newBoolData], 1, boolArrayFormat);
console.log('布爾數組Buffer:', newBoolBuffer);

// 再次使用 toJS 函數將寫入嘅二進制數據解析回 JavaScript 對象
const verifyBoolResult = toJS(newBoolBuffer, 1, boolArrayFormat);
const verifyBoolData = verifyBoolResult[0];
console.log('驗證布爾數組:', verifyBoolData.flags);
