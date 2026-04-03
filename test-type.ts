import { Bitten, ObjectFormat } from './src';
import { Buffer } from 'buffer';

// 定義一個有嵌套subFormat嘅格式
const testFormat = {
  header: { 
    startByte: 0, 
    length: 4,
    type: 'string'
  },
  nested: {
    startByte: 4,
    length: 8,
    type: 'arraybuffer',
    subFormat: {
      field1: {
        startByte: 0,
        bitLength: 32,
        type: 'uint'
      },
      field2: {
        startByte: 4,
        length: 4,
        type: 'string'
      }
    }
  },
  count: {
    startByte: 12,
    bitLength: 16,
    type: 'uint'
  }
} as const;

// 使用新嘅泛型參數功能
type CustomType = {
  header: string;
  nested: {
    field1: number;
    field2: string;
  };
  count: number;
};

// 創建測試數據
const buffer = Buffer.alloc(14); // 14字節嘅buffer

// 初始化Bitten實例
const bitten = new Bitten(testFormat);

// 1. 測試默認類型推導
const data1 = bitten.fromBuffer(buffer);
console.log("Type test 1 (自動推導):");
console.log("data1.header type:", typeof data1.header);
console.log("data1.nested type:", typeof data1.nested);
console.log("data1.nested.field1 type:", typeof data1.nested?.field1);
console.log("data1.nested.field2 type:", typeof data1.nested?.field2);
console.log("data1.count type:", typeof data1.count);

// 2. 測試顯式指定類型
const data2 = bitten.fromBuffer<CustomType>(buffer);
console.log("\nType test 2 (顯式指定類型):");
console.log("data2.header type:", typeof data2.header);
console.log("data2.nested type:", typeof data2.nested);
console.log("data2.nested.field1 type:", typeof data2.nested?.field1);
console.log("data2.nested.field2 type:", typeof data2.nested?.field2);
console.log("data2.count type:", typeof data2.count);

// 這行應該能夠編譯通過
const header: string = data1.header;
const nestedField: number = data1.nested.field1;

// 如果返回類型正確，下面兩行都應該可以編譯
const header2: string = data2.header;
const nestedField2: number = data2.nested.field1; 