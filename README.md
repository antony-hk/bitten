# Bitten

Bitten 係一個 JavaScript/TypeScript 庫，用於解析和構建二進制數據格式。

## 安裝

```bash
pnpm add bitten
```

## 使用方法

Bitten 提供兩種風格嘅 API：函數式和類式（OOP）。

### 函數式 API（原始風格）

```typescript
import { toJS, fromJS, ObjectFormat } from 'bitten';

// 定義格式
const personFormat: ObjectFormat = {
  id: { startByte: 0, bitLength: 16, type: 'uint' },
  name: { startByte: 2, length: 10, type: 'string' },
  age: { startByte: 12, bitLength: 8, type: 'uint' }
};

// 解析二進制數據
const buffer = getBufferFromSomewhere();
const people = toJS(buffer, 13, personFormat);
console.log(people[0].id, people[0].name, people[0].age);

// 將對象轉換為二進制
const newPerson = { id: 1, name: 'John', age: 30 };
const newBuffer = fromJS([newPerson], 13, personFormat);
```

### 類式 API（OOP 風格 - 簡化版本）

```typescript
import { Bitten, InferObjectFormat } from 'bitten';

// 定義格式
const personFormat = {
  id: { startByte: 0, bitLength: 16, type: 'uint' },
  name: { startByte: 2, length: 10, type: 'string' },
  age: { startByte: 12, bitLength: 8, type: 'uint' }
} as const;

// 從格式自動推導類型
type Person = InferObjectFormat<typeof personFormat>;

// 創建格式處理器（可選擇設置大小端序）
const format = new Bitten(personFormat, { isBigEndian: false });

// 解析二進制數據
const buffer = getBufferFromSomewhere();
const person = format.fromBuffer(buffer);
console.log(person.name);

// 將對象轉換為二進制
const newPerson: Person = { id: 1, name: 'John', age: 30 };
const newBuffer = format.toBuffer(newPerson);

// 處理多條記錄（使用直接函數）
import { toJS, fromJS } from 'bitten';
const recordLength = 13; // 每個記錄嘅字節長度
const manyPeople: Person[] = [/* ... */];
const bigBuffer = fromJS(manyPeople, recordLength, personFormat);
const parsedPeople = toJS(bigBuffer, recordLength, personFormat);
```

## 方法說明

### Bitten 類方法

- `fromBuffer(buffer, options?)` - 從二進制數據解析為 JavaScript 對象
- `toBuffer(data, returnType?)` - 將 JavaScript 對象轉換為二進制數據

### 函數式 API

- `toJS(buffer, recordLength, format, keepBase64?, isBigEndian?)` - 解析二進制數據為多個對象
- `fromJS(jsObjects, recordLength, format, isBigEndian?, returnType?)` - 將多個對象轉換為二進制數據

## 主要功能

- 🔢 支持各種數據類型：`boolean`、`int`、`uint`、`string`、`bigint`、`arraybuffer`
- 📦 支持陣列和嵌套對象
- 📐 精確到位元級別嘅操作
- 🧠 TypeScript 類型推導，編碼時提供完整類型安全
- 🔄 自定義轉換函數，允許高級數據處理
- 🧩 靈活嘅格式定義，支持複雜嘅數據結構
- 🔌 支持小端序和大端序

## 示例

更多示例請查看 `examples` 目錄。

### License
MIT
