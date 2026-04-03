import { ObjectFormat, toJS, fromJS } from '../src';

// 定義一個子格式，表示一個點嘅坐標
const pointFormat: ObjectFormat = {
  x: { offset: 0, bitLength: 16, type: 'int' },
  y: { offset: 2, bitLength: 16, type: 'int' }
};

// 定義一個多邊形格式，包含頂點數量同頂點列表
const polygonFormat: ObjectFormat = {
  // 頂點數量
  numVertices: {
    offset: 0,
    bitLength: 8,
    type: 'uint'
  },
  // 頂點列表，每個頂點都係一個點
  vertices: {
    offset: 1,  // 從第二個byte開始
    length: 4,  // 每個頂點用4 bytes (x: 2 bytes, y: 2 bytes)
    type: 'int',
    arrayLength: 4,  // 最多支持4個頂點
    subFormat: pointFormat,
    // 將原始嘅頂點數組轉換成一個更友好嘅格式
    readTransform: (points: Array<{ x: number, y: number }>) => 
      points.map(p => ({
        x: p.x / 100,
        y: p.y / 100
      })),
    // 將友好格式轉返去原始格式
    writeTransform: (points: Array<{ x: number, y: number }>) =>
      points.map(p => ({
        x: Math.round(p.x * 100),
        y: Math.round(p.y * 100)
      }))
  }
};

// 創建一個簡單嘅測試 Buffer
// [0x02]                 - numVertices = 2
// [0x00, 0x64]          - vertex1.x = 100
// [0x00, 0xC8]          - vertex1.y = 200
// [0xFF, 0x9C]          - vertex2.x = -100
// [0xFF, 0x38]          - vertex2.y = -200
// [0x00, 0x00]          - vertex3.x = 0 (unused)
// [0x00, 0x00]          - vertex3.y = 0 (unused)
// [0x00, 0x00]          - vertex4.x = 0 (unused)
// [0x00, 0x00]          - vertex4.y = 0 (unused)
const testBuffer = Buffer.from([
  0x02,             // numVertices = 2
  0x64, 0x00,      // vertex1.x = 100 (little endian)
  0xC8, 0x00,      // vertex1.y = 200 (little endian)
  0x9C, 0xFF,      // vertex2.x = -100 (little endian)
  0x38, 0xFF,      // vertex2.y = -200 (little endian)
  0x00, 0x00,      // vertex3.x = 0 (unused)
  0x00, 0x00,      // vertex3.y = 0 (unused)
  0x00, 0x00,      // vertex4.x = 0 (unused)
  0x00, 0x00,      // vertex4.y = 0 (unused)
]);

// 將二進制轉返去對象
const result = toJS(testBuffer, 17, polygonFormat);

console.log('Little Endian 測試結果:', result[0]);

// Big Endian 測試
// 創建一個使用 Big Endian 嘅測試 Buffer
const testBufferBE = Buffer.from([
    0x02,             // numVertices = 2
    0x00, 0x64,      // vertex1.x = 100 (big endian)
    0x00, 0xC8,      // vertex1.y = 200 (big endian)
    0xFF, 0x9C,      // vertex2.x = -100 (big endian)
    0xFF, 0x38,      // vertex2.y = -200 (big endian)
    0x00, 0x00,      // vertex3.x = 0 (unused)
    0x00, 0x00,      // vertex3.y = 0 (unused)
    0x00, 0x00,      // vertex4.x = 0 (unused)
    0x00, 0x00,      // vertex4.y = 0 (unused)
]);

// 將二進制轉返去對象 (使用 Big Endian)
const resultBE = toJS(testBufferBE, 17, polygonFormat, false, true);

console.log('\nBig Endian 測試結果:', resultBE[0]);
// 預期輸出：
// {
//   numVertices: 2,
//   vertices: [
//     { x: 1, y: 2 },      // 100/100 = 1, 200/100 = 2
//     { x: -1, y: -2 },    // -100/100 = -1, -200/100 = -2
//     { x: 0, y: 0 },      // unused
//     { x: 0, y: 0 }       // unused
//   ]
// } 

// 測試位元級別打包
// 定義一個角色狀態格式，包含各種遊戲數據
const statusEffectFormat: ObjectFormat = {
  isPoisoned: { offset: 0, bitOffset: 0, bitLength: 1, type: 'boolean' },
  isStunned: { offset: 0, bitOffset: 1, bitLength: 1, type: 'boolean' },
  isInvincible: { offset: 0, bitOffset: 2, bitLength: 1, type: 'boolean' },
  effectDuration: { offset: 0, bitOffset: 3, bitLength: 5, type: 'uint' }  // 0-31秒
};

const characterStatsFormat: ObjectFormat = {
  health: { offset: 0, bitOffset: 0, bitLength: 10, type: 'uint' },     // 0-1023 HP
  mana: { offset: 1, bitOffset: 2, bitLength: 9, type: 'uint' },        // 0-511 MP
  level: { offset: 2, bitOffset: 3, bitLength: 7, type: 'uint' },       // 0-127
  experience: { offset: 3, bitOffset: 2, bitLength: 14, type: 'uint' }  // 0-16383 XP
};

const characterFormat: ObjectFormat = {
  // 基本信息
  id: { offset: 0, bitLength: 16, type: 'uint' },
  // 狀態效果 (使用子格式)
  status: { 
    offset: 2,
    bitLength: 8,
    type: 'uint',
    subFormat: statusEffectFormat
  },
  // 角色屬性 (使用子格式)
  stats: {
    offset: 3,
    bitLength: 40,
    type: 'uint',
    subFormat: characterStatsFormat
  }
};

// 創建測試數據 (Little Endian)
const characterTestBuffer = Buffer.from([
  0x2A, 0x00,      // id = 42
  0x1B,            // status: isPoisoned=1, isStunned=1, isInvincible=0, effectDuration=3
  0x58, 0xB2,      // [01011000][10110010] health=600 (LSB 8 bits + MSB 2 bits) + mana LSB 6 bits
  0x04, 0x00,      // level=32 (0100000)
                   // 第三個 byte [00000100]: 
                   //   - bit 0-2: mana嘅頭3個bits
                   //   - bit 3-7: 拎level嘅LSB 5個bits (00000)放入去
                   // 第四個 byte [00000000]:
                   //   - bit 0-1: 拎level嘅MSB 2個bits (01)放入去
                   //   - bit 2-7: 留俾experience用
  0xF3, 0xFF,      // [11110011][11111111] experience
  0x3F             // [00111111] experience
]);

console.log('\n位元級別打包測試：');
const characterResult = toJS(characterTestBuffer, 10, characterFormat);
console.log('角色數據:', characterResult[0]);

// 預期輸出：
// {
//   id: 42,
//   status: {
//     isPoisoned: true,
//     isStunned: true,
//     isInvincible: false,
//     effectDuration: 3
//   },
//   stats: {
//     health: 1023,
//     mana: 511,
//     level: 127,
//     experience: 16383
//   }
// } 

// Big Endian 測試
const characterTestBufferBE = Buffer.from([
  0x00, 0x2A,      // id = 42 (big endian)
  0x1B,            // status: isPoisoned=1, isStunned=1, isInvincible=0, effectDuration=3
  0x96, 0x25,      // [10010110][00100101] health=600 (MSB 8 bits + LSB 2 bits) + mana MSB 6 bits
  0x08, 0x00,      // level=32 (0100000)
                   // 第三個 byte [00001000]:
                   //   - bit 0-2: mana嘅尾3個bits
                   //   - bit 3-7: 拎level嘅MSB 5個bits (01000)放入去
                   // 第四個 byte [00000000]:
                   //   - bit 0-1: 拎level嘅MSB 2個bits (00)放入去
                   //   - bit 2-7: 留俾experience用
  0xFF, 0xF3,      // [11111111][11110011] experience
  0x3F             // [00111111] experience
]);

console.log('\n位元級別打包測試 (Big Endian)：');
const characterResultBE = toJS(characterTestBufferBE, 10, characterFormat, false, true);
console.log('角色數據 (Big Endian):', characterResultBE[0]);

// 預期輸出：
// {
//   id: 42,
//   status: {
//     isPoisoned: true,
//     isStunned: true,
//     isInvincible: false,
//     effectDuration: 3
//   },
//   stats: {
//     health: 1023,
//     mana: 511,
//     level: 127,
//     experience: 16383
//   }
// } 