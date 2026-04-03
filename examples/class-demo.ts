// class-demo.ts
// 展示 Bitten 類嘅使用方法

import { Buffer } from 'buffer';
import { Bitten, InferObjectFormat, toJS, fromJS } from '../src/index';

// 定義一個格式
const personFormat = {
  id: { startByte: 0, bitLength: 16, type: 'uint' },
  name: { startByte: 2, length: 10, type: 'string' },
  age: { startByte: 12, bitLength: 8, type: 'uint' },
  active: { startByte: 13, bitOffset: 0, bitLength: 1, type: 'boolean' }
} as const;

// 推導正確嘅類型
type Person = InferObjectFormat<typeof personFormat>;

// 範例 1：基本用法
function basicDemo() {
  console.log('===== 基本用法演示 =====');
  
  // 創建一個二進制格式處理器
  const format = new Bitten(personFormat);
  
  // 創建一個測試數據
  const person: Person = {
    id: 1234,
    name: '張三',
    age: 30,
    active: true
  };
  
  // 將數據轉換為二進制
  const buffer = format.toBuffer(person);
  console.log('轉換結果：', buffer);
  console.log('Buffer 長度：', Buffer.isBuffer(buffer) ? buffer.length : buffer.byteLength, '字節');
  
  // 將二進制數據解析回對象
  const parsed = format.fromBuffer(buffer);
  console.log('解析結果：', parsed);
  
  // 輸出記錄長度
  console.log('記錄長度：', Buffer.isBuffer(buffer) ? buffer.length : buffer.byteLength, '字節');
}

// 範例 2：處理多條記錄
function multipleRecordsDemo() {
  console.log('\n===== 多條記錄演示 =====');
  
  // 創建多個人嘅資料
  const people: Person[] = [
    { id: 1001, name: '張三', age: 30, active: true },
    { id: 1002, name: '李四', age: 25, active: false },
    { id: 1003, name: '王五', age: 40, active: true }
  ];
  
  // 直接使用原始 fromJS 函數轉換多條記錄為二進制
  const recordLength = 14; // 我們知道每個記錄嘅長度係14字節
  const buffer = fromJS(people, recordLength, personFormat);
  console.log('多條記錄轉換結果長度：', Buffer.isBuffer(buffer) ? buffer.length : buffer.byteLength, '字節');
  
  // 使用原始 toJS 函數解析多條記錄
  const parsedRecords = toJS(buffer, recordLength, personFormat);
  console.log('解析回嘅記錄數：', parsedRecords.length);
  
  // 顯示所有解析嘅記錄
  parsedRecords.forEach((person, index) => {
    console.log(`記錄 #${index + 1}:`, person);
  });
}

// 範例 3：使用 ArrayBuffer 而唔係 Buffer
function arrayBufferDemo() {
  console.log('\n===== ArrayBuffer 演示 =====');
  
  const format = new Bitten(personFormat);
  
  // 創建測試數據
  const person: Person = {
    id: 9999,
    name: '老六',
    age: 50,
    active: true
  };
  
  // 使用 ArrayBuffer 作為返回類型
  const arrayBuffer = format.toBuffer(person, 'arraybuffer') as ArrayBuffer;
  console.log('ArrayBuffer 長度：', arrayBuffer.byteLength, '字節');
  
  // 從 ArrayBuffer 解析
  const parsed = format.fromBuffer(arrayBuffer);
  console.log('從 ArrayBuffer 解析結果：', parsed);
}

// 執行演示
basicDemo();
multipleRecordsDemo();
arrayBufferDemo(); 