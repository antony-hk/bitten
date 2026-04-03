import { Bitten } from '../src';
import { Buffer } from 'buffer';

// 定義一個簡單格式
const testFormat = {
  id: { startByte: 0, bitLength: 16, type: 'uint' },
  name: { startByte: 2, length: 10, type: 'string' },
  age: { startByte: 12, bitLength: 8, type: 'uint' }
} as const;

// 創建 Bitten 實例
const bitten = new Bitten(testFormat);

// 創建測試數據
const buffer = Buffer.alloc(13);
buffer.writeUInt16LE(42, 0);
buffer.write('Test User', 2);
buffer[12] = 25;

// 解析數據
const user = bitten.fromBuffer(buffer);

console.log('原始對象:', user);

// 測試對象是否可修改
try {
  user.id = 100;
  user.name = 'Modified User';
  user.age = 30;
  
  console.log('修改後對象:', user);
  console.log('對象可成功修改！');
} catch (error) {
  console.error('修改對象失敗:', error);
}

// 測試展開運算符
const mutableUser = { ...user };
mutableUser.id = 200;
mutableUser.name = 'Expanded User';
mutableUser.age = 35;

console.log('展開後修改對象:', mutableUser); 