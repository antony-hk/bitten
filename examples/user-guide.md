# 使用 readTransform 和 writeTransform 的指南

當你在使用 Bitten 庫解析二進制數據時，`readTransform` 和 `writeTransform` 是兩個重要的函數，可以幫助你將原始數據轉換為更有用的類型。

## readTransform 的作用

`readTransform` 函數用於將從二進制讀取的原始值轉換為你需要的類型。例如：

```typescript
// 布爾值轉為字符串
const boolField = {
  startByte: 0,
  bitLength: 1,
  type: 'boolean',
  readTransform: (input: boolean) => input ? "Yes" : "No"
};

// 數字轉為日期
const timestampField = {
  startByte: 1,
  bitLength: 32,
  type: 'uint',
  readTransform: (input: number) => new Date(input * 1000)
};
```

## 類型推導

Bitten 的類型系統會自動推導包含 `readTransform` 的字段最終類型：

- 如果 `readTransform` 返回字符串，字段類型會被推導為 `string`
- 如果 `readTransform` 返回布爾值，字段類型會被推導為 `boolean`
- 如果 `readTransform` 返回數字，字段類型會被推導為 `number`
- 如果 `readTransform` 返回復雜對象，字段類型會被推導為該對象類型

## 常見問題排除

如果你發現類型推導不正確：

1. **確保使用最新版本**：舊版本可能存在類型推導問題
2. **檢查 readTransform 的實現**：確保返回類型正確且一致
3. **避免類型混合**：不要在同一個 `readTransform` 中返回不同類型的值
4. **使用 as const**：定義格式時加上 `as const` 來確保類型推導精確
5. **類型註解**：如果推導不正確，可以使用顯式類型註解

## 示例

完整的示例：

```typescript
import { ObjectFormat, toJS, Buffer, InferObjectFormat } from 'bitten';

// 定義格式
const myFormat = {
  boolAsString: {
    startByte: 0,
    bitLength: 1,
    type: 'boolean' as const,
    readTransform: (input: boolean) => input ? "YES" : "NO"
  }
} as const;

// 推導類型
type MyFormatType = InferObjectFormat<typeof myFormat>;
// MyFormatType 將是 { boolAsString: string }

// 使用格式解析數據
const buffer = Buffer.from([0x01]);
const result = toJS(buffer, 1, myFormat);

// 使用解析結果
console.log(result[0].boolAsString); // 輸出: "YES"
console.log(typeof result[0].boolAsString); // 輸出: "string"
```

## 運行時類型檢查

如果需要在運行時檢查類型：

```typescript
// 檢查值是否為字符串
if (typeof result[0].boolAsString === 'string') {
  console.log('是字符串');
}

// 檢查值是否為數字
if (typeof result[0].numericField === 'number') {
  console.log('是數字');
}
``` 