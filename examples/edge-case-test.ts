import { Bitten } from '../src';
import { Buffer } from 'buffer';

// 最簡單的 boolean -> string 轉換測試
const simpleFormat = {
  boolAsString: {
    startByte: 0,
    bitLength: 1,
    type: 'boolean' as const,
    readTransform: (input: boolean) => input ? "YES" : "NO",
    writeTransform: (input: number) => input === 1
  }
} as const;

// 創建 Bitten 實例
const bitten = new Bitten(simpleFormat);

// 創建一個測試用的二進制數據緩衝區
const testBuffer = Buffer.from([0x01]); // 1位元組，值為1 (true)

// 測試解析
const result = bitten.fromBuffer(testBuffer);

console.log('結果檢查:');
console.log('boolAsString 值:', result.boolAsString);
console.log('boolAsString 類型:', typeof result.boolAsString);

// 測試訪問形式
console.log('\n不同訪問形式:');
console.log('使用點號訪問:', result.boolAsString, typeof result.boolAsString);
console.log('使用方括號訪問:', result['boolAsString'], typeof result['boolAsString']);

// 測試變量賦值
console.log('\n變量賦值測試:');
const extracted = result.boolAsString;
console.log('提取後的值:', extracted);
console.log('提取後的類型:', typeof extracted);

// 輸出完整對象
console.log('\n完整對象:');
console.log(JSON.stringify(result));

// 測試將字符串寫回二進制
console.log('\n寫回測試:');
const objToWrite = { boolAsString: "YES" as "YES" | "NO" };
const writtenBuffer = bitten.toBuffer(objToWrite) as Buffer;
console.log('寫入後的緩衝區:', writtenBuffer);
console.log('緩衝區第一字節 (應為 1):', writtenBuffer[0]); 