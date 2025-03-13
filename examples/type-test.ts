import { FormatFieldType, ObjectFormat, InferObjectFormat, toJS, fromJS } from '../src/index';
import { Buffer } from 'buffer';

// 測試基本類型推導
const boolField = {
  startByte: 0,
  bitLength: 1,
  type: 'boolean' as const
};

const stringField = {
  startByte: 1,
  length: 5,
  type: 'string' as const
};

const intField = {
  startByte: 6,
  bitLength: 8,
  type: 'int' as const
};

// 測試 readTransform 推導
const transformedBoolToString = {
  startByte: 0,
  bitLength: 1,
  type: 'boolean' as const,
  readTransform: (input: boolean) => input ? "Yes" : "No"
};

const transformedIntToString = {
  startByte: 1,
  bitLength: 8,
  type: 'int' as const,
  readTransform: (input: number) => input.toString()
};

const transformedStringToDate = {
  startByte: 2,
  length: 10,
  type: 'string' as const,
  readTransform: (input: string) => new Date(input)
};

// 創建一個包含所有字段的測試格式
const testFormat: ObjectFormat = {
  boolField,
  stringField,
  intField,
  transformedBoolToString,
  transformedIntToString,
  transformedStringToDate
};

// 檢查單獨字段的類型
type BoolFieldType = FormatFieldType<typeof boolField>;
type StringFieldType = FormatFieldType<typeof stringField>;
type IntFieldType = FormatFieldType<typeof intField>;

type TransformedBoolToStringType = FormatFieldType<typeof transformedBoolToString>;
type TransformedIntToStringType = FormatFieldType<typeof transformedIntToString>;
type TransformedStringToDateType = FormatFieldType<typeof transformedStringToDate>;

// 測試整個對象類型
type TestFormatType = InferObjectFormat<typeof testFormat>;

// 新增一個特殊測試案例
const specialTestFormat = {
  // 字符串字段，嚟測試可能嘅問題
  strField: {
    startByte: 0,
    length: 5,
    type: 'string' as const
  },
  // 即使類型係 boolean，readTransform 返回字符串，所以最終應該係字符串類型
  transformedField: {
    startByte: 5,
    bitLength: 1,
    type: 'boolean' as const,
    readTransform: (input: boolean) => input ? "Yes" : "No"
  }
} as const;

// 輸出類型名稱（運行時僅輸出 "function"，但編譯時能檢查類型）
console.log('基本類型檢查:');
console.log('BoolFieldType type:', typeof true);
console.log('StringFieldType type:', typeof "");
console.log('IntFieldType type:', typeof 0);

console.log('\n轉換類型檢查:');
console.log('TransformedBoolToStringType type:', typeof "");
console.log('TransformedIntToStringType type:', typeof "");
console.log('TransformedStringToDateType type:', typeof new Date()); 

// ==== 實際執行測試 ====
console.log('\n實際執行測試:');

// 創建一個測試格式
const runtimeTestFormat: ObjectFormat = {
  normal: {
    startByte: 0,
    bitLength: 1,
    type: 'boolean' as const
  },
  transformed: {
    startByte: 1,
    bitLength: 1,
    type: 'boolean' as const,
    readTransform: (input: boolean) => input ? "Yes" : "No"
  }
};

// 創建測試數據
const testBuffer = Buffer.from([0x01, 0x01]); // 兩個位元組，都是1
const recordLength = 2;

// 解析數據
const parsed = toJS(testBuffer, recordLength, runtimeTestFormat);

// 檢查實際類型
console.log('解析後的值:');
console.log('normal值:', parsed[0].normal, '類型:', typeof parsed[0].normal);
console.log('transformed值:', parsed[0].transformed, '類型:', typeof parsed[0].transformed);

// ==== 測試特殊案例 ====
console.log('\n特殊案例測試:');

// 創建測試數據：5個字節字符串 "HELLO" + 1個布爾值(1)
const specialBuffer = Buffer.from([0x48, 0x45, 0x4C, 0x4C, 0x4F, 0x01]);
const specialRecordLength = 6;

// 解析數據
const specialParsed = toJS(specialBuffer, specialRecordLength, specialTestFormat);

// 檢查類型及結果
console.log('specialParsed.strField:', specialParsed[0].strField, '類型:', typeof specialParsed[0].strField);
console.log('specialParsed.transformedField:', specialParsed[0].transformedField, '類型:', typeof specialParsed[0].transformedField);

// 測試類型系統是否正確推導
type SpecialTestFormatType = InferObjectFormat<typeof specialTestFormat>;
// 以下註解中的類型檢查應該是正確的
// strField 應該是 string 類型
// transformedField 應該是 string 類型
// const typeCheck: SpecialTestFormatType = {
//   strField: "test",
//   transformedField: "Yes" // 如果這裡錯誤，表示類型推導出問題
// }; 