/**
 * Bitten - A JavaScript/TypeScript library for parsing and constructing data in binary format
 */
import { Buffer } from "buffer";
import type { Simplify } from 'type-fest';

/**
 * 面向位元組的字段格式定義（用於 string 和 arraybuffer 類型）
 */
export interface ByteAlignedFormatItem {
  /** 該字段在記錄中的起始位元組位置 */
  offset: number;
  /** 該字段的位元組長度（必須指定） */
  length: number;
  /** 當該字段是數組時，數組的長度。0表示單個元素作為數組處理 */
  arrayLength?: number;
  /** 字段的數據類型 - 只能使用字節對齊類型 */
  type: 'string' | 'arraybuffer';
  /** 嵌套的格式定義，用於複合類型 */
  subFormat?: ObjectFormat;
  /** 自定義的讀取轉換函數，將讀取的原始值轉換為期望的類型 */
  readTransform?: (input: any) => any;
  /** 自定義的寫入轉換函數，將JS值轉換為適合寫入二進制的格式 */
  writeTransform?: (input: any) => any;
  
  /** 這些屬性不允許用於字節對齊類型 */
  bitOffset?: never;
  bitLength?: never;
}

/**
 * 面向位元的字段格式定義（用於 boolean、int、uint 和 bigint 類型）
 */
export interface BitLevelFormatItem {
  /** 該字段在記錄中的起始位元組位置 */
  offset: number;
  /** 該字段在起始位元組中的起始位元位置，默認為0 */
  bitOffset?: number;
  /** 該字段的總位元長度，與 length 只能選其一。必須提供 bitLength 或 length 中的一個 */
  bitLength?: number;
  /** 該字段的位元組長度，與 bitLength 只能選其一。必須提供 length 或 bitLength 中的一個 */
  length?: number;
  /** 當該字段是數組時，數組的長度。0表示單個元素作為數組處理 */
  arrayLength?: number;
  /** 字段的數據類型 - 只能使用位元級類型 */
  type: 'boolean' | 'uint' | 'int' | 'bigint';
  /** 嵌套的格式定義，用於複合類型 */
  subFormat?: ObjectFormat;
  /** 自定義的讀取轉換函數，將讀取的原始值轉換為期望的類型 */
  readTransform?: (input: any) => any;
  /** 自定義的寫入轉換函數，將JS值轉換為適合寫入二進制的格式 */
  writeTransform?: (input: any) => any;
}

/**
 * 定義二進制數據格式的基本單元，根據數據類型的不同，有不同的屬性要求
 */
export type FormatItem = ByteAlignedFormatItem | BitLevelFormatItem;

/**
 * 格式定義，以對象形式組織數據字段
 * 每個字段對應一個FormatItem
 */
export interface ObjectFormat {
  [fieldName: string]: FormatItem;
}

/**
 * 寬鬆版本的ObjectFormat，用於接受非const類型的格式定義
 */
// export type LooseObjectFormat = Record<string, any>;

/**
 * 解析後的格式項定義，所有可選字段都會被賦予默認值
 */
interface ParsedFormatItem {
  key: string;
  offset: number;
  bitOffset: number;  // 原 startBit
  bitLength: number;  // 這裡必須是 number，不能是 undefined
  arrayLength: number | undefined;
  type: 'boolean' | 'uint' | 'int' | 'string' | 'bigint' | 'arraybuffer';
  subFormat: ObjectFormat | undefined;
  readTransform?: (input: any) => any;
  writeTransform?: (input: any) => any;
}

/**
 * 解析格式定義的結果
 */
interface ParsedFormat {
  /** 解析後的格式項 */
  items: ParsedFormatItem[];
  /** 字段名稱到格式項的映射 */
  keyMap: Map<string, ParsedFormatItem>;
}

/**
 * 呢個類型用嚟推導字段嘅基本原始數據類型（未經過 readTransform 處理）
 */
export type RawFormatFieldType<F> = 
  // 如果係字符串且有 arrayLength 屬性，就推導為字符串數組
  F extends { type: 'string', arrayLength: number } ? string[] :
  // 如果係布爾值且有 arrayLength 屬性，就推導為布爾值數組
  F extends { type: 'boolean', arrayLength: number } ? boolean[] :
  // 如果係整數類型且有 arrayLength 屬性，就推導為數字數組
  F extends { type: 'int' | 'uint', arrayLength: number } ? number[] :
  // 如果是大整數類型且有 arrayLength 屬性，就推導為大整數數組
  F extends { type: 'bigint', arrayLength: number } ? bigint[] :
  // 如果是 ArrayBuffer 類型且有 arrayLength 屬性，就推導為 ArrayBuffer 數組
  F extends { type: 'arraybuffer', arrayLength: number } ? ArrayBuffer[] :
  // 如果只係字符串類型，推導為字符串
  F extends { type: 'string' } ? string :
  // 如果只係布爾值類型，推導為布爾值
  F extends { type: 'boolean' } ? boolean :
  // 如果只係整數類型，推導為數字
  F extends { type: 'int' | 'uint' } ? number :
  // 如果只是大整數類型，推導為大整數
  F extends { type: 'bigint' } ? bigint :
  // 如果只是 ArrayBuffer 類型，推導為 ArrayBuffer
  F extends { type: 'arraybuffer' } ? ArrayBuffer :
  // 默認情況下推導為數字
  number;

/**
 * 呢個類型用嚟推導字段嘅最終數據類型，考慮 readTransform 轉換
 * 
 * 主要功能係根據字段嘅 type 屬性同 arrayLength 屬性嚟決定最終嘅 JavaScript 類型：
 * 1. 如果有 readTransform 並且可以推導其返回類型，使用該返回類型
 * 2. 否則根據字段類型推導類型
 *    - 字符串類型：string 或 string[]
 *    - 布爾值類型：boolean 或 boolean[]
 *    - 數字類型：number 或 number[]
 *    - 大整數類型：bigint 或 bigint[]
 *    - ArrayBuffer 類型：ArrayBuffer 或 ArrayBuffer[]
 * 
 * 當冇法識別類型時，默認推導為 number
 */
export type FormatFieldType<F> = 
  // 如果有明確返回類型嘅 readTransform，使用該類型
  F extends { readTransform: (...args: any[]) => infer R } ? 
    R :
  // 如果無法推導 readTransform 類型，則根據字段類型決定
  F extends { type: 'string', arrayLength: number } ? string[] :
  F extends { type: 'boolean', arrayLength: number } ? boolean[] :
  F extends { type: 'int' | 'uint', arrayLength: number } ? number[] :
  F extends { type: 'bigint', arrayLength: number } ? bigint[] :
  F extends { type: 'arraybuffer', arrayLength: number } ? ArrayBuffer[] :
  F extends { type: 'string' } ? string :
  F extends { type: 'boolean' } ? boolean :
  F extends { type: 'int' | 'uint' } ? number :
  F extends { type: 'bigint' } ? bigint :
  F extends { type: 'arraybuffer' } ? ArrayBuffer :
  unknown;

/**
 * 呢個類型用嚟處理帶有子格式嘅字段類型推導
 * 
 * 主要功能係解析含有 subFormat 屬性嘅字段，將佢哋轉換成對應嘅 JavaScript 類型：
 * 1. 如果同時有 subFormat 同 arrayLength：
 *    - 推導為子格式對象嘅數組 (Array<InferObjectFormat<S>>)
 * 
 * 2. 如果只有 subFormat 冇 arrayLength：
 *    - 推導為單個子格式對象 (InferObjectFormat<S>)
 * 
 * 3. 如果冇 subFormat：
 *    - 使用 FormatFieldType 嚟推導基礎類型
 * 
 * 呢個類型主要處理複雜嘅嵌套結構，令到最終輸出嘅 JavaScript 對象類型同格式定義結構一致
 */
export type FormatSubType<F> = 
  // 如果有子格式同時有數組長度，推導為子格式物件嘅數組
  F extends { subFormat: infer S, arrayLength: number } ?
    S extends ObjectFormat ? Array<InferObjectFormat<S>> : never :
  // 如果只有子格式，推導為單個子格式物件
  F extends { subFormat: infer S } ?
    S extends ObjectFormat ? InferObjectFormat<S> : never :
  // 如果冇子格式，就用 FormatFieldType 推導基本類型
  FormatFieldType<F>;

/**
 * 從對象格式定義推斷生成的JS對象類型
 * 
 * 呢個類型係庫嘅核心類型之一，負責將格式定義轉換成 TypeScript 類型：
 * 1. 遍歷輸入格式 T 嘅所有字段（鍵）
 * 2. 對每個字段根據佢嘅屬性推導相應嘅 TypeScript 類型：
 *    - 如果字段有 subFormat 同 arrayLength：推導為子格式對象嘅數組
 *    - 如果字段只有 subFormat：推導為單個子格式對象
 *    - 其他情況：使用 FormatFieldType 推導基本類型
 * 
 * 3. 額外添加一個可選嘅 base64 屬性，用嚟存儲原始二進制數據嘅 Base64 編碼
 * 
 * 呢個類型令到庫用戶可以獲得完整嘅類型安全性，編譯時就能檢查到類型錯誤，
 * 同時喺代碼編輯器中提供自動完成功能，大大提高開發效率
 */
export type InferObjectFormat<T extends ObjectFormat> = Simplify<{
  // 遍歷 T 中嘅所有鍵，為每個鍵推導對應嘅類型
  -readonly [K in keyof T]: 
               // 如果字段既有子格式又有數組長度，推導為子格式物件嘅數組
               T[K] extends { subFormat: infer S, arrayLength: number } ?
                 S extends ObjectFormat ? Array<InferObjectFormat<S>> : never :
               // 如果字段只有子格式，推導為單個子格式物件
               T[K] extends { subFormat: infer S } ?
                 S extends ObjectFormat ? InferObjectFormat<S> : never :
               // 其他情況用 FormatFieldType 推導基本類型
               FormatFieldType<T[K]>;
  // 附加一個可選的 base64 字段，用於保存原始二進制數據
} & { base64?: string; }>;

/**
 * 從格式定義推斷生成的JS對象類型
 * 
 * 呢個類型係 InferObjectFormat 嘅簡單包裝，做咗類型檢查
 */
export type InferFormatType<T> = 
  T extends ObjectFormat ? InferObjectFormat<T> : never;

/**
 * 從Buffer中讀取UTF-8字符串
 * @param buf 數據緩衝區
 * @param offset 開始讀取的偏移量
 * @param length 要讀取的字節長度
 * @returns 讀取到的字符串，自動移除\0字符
 */
export function readString(buf: Buffer, offset: number, length: number): string {
    return buf.slice(offset, offset + length).toString('utf8').replace(/\0/g, '');
}

/**
 * 將字符串寫入Buffer
 * @param buf 數據緩衝區
 * @param offset 開始寫入的偏移量
 * @param length 寫入區域的最大長度
 * @param string 要寫入的字符串
 * @returns 實際寫入的字節數
 */
export function writeString(buf: Buffer, offset: number, length: number, string: string): number {
    buf.fill(0, offset, offset + length);
    string += '\u0000';
    return buf.write(string, offset, length, 'utf8');
}

/**
 * 按小端序從緩衝區的指定位元位置讀取值
 * @param buf 數據緩衝區
 * @param byteOffset 起始位元組位置
 * @param bitOffset 起始位元位置
 * @param bitLength 要讀取的位元數
 * @param signed 是否為有符號數值
 * @returns 讀取的數值
 */
export function readBitsLE(
  buf: Buffer, 
  byteOffset: number, 
  bitOffset: number, 
  bitLength: number, 
  signed = false
): number {
    // 第一步：讀取第一個位元組的值
    // 從緩衝區指定位置讀取一個無符號8位整數（一個位元組）
    const firstByte = buf.readUInt8(byteOffset);
    
    // 第二步：計算第一個位元組中可用的位元數量（從起始位到位元組尾）
    // 一個位元組有8位，減去起始位偏移，得到可用位元數
    const firstByteBitLength = 8 - bitOffset;
    
    // 第三步：建立掩碼來提取第一個位元組中我們需要嘅位元
    // 先計算掩碼嘅大小：(2^min(可用位元數, 需要讀取嘅位元數) - 1) << 起始位置
    // 呢個掩碼會將需要讀取嘅位設為1，其他位設為0
    const firstByteLengthMask = (2 ** Math.min(firstByteBitLength, bitLength) - 1) << bitOffset;
    
    // 第四步：結合位元組中的有效範圍同我們需要嘅部分
    // ((2^8 - 1) - (2^起始位置 - 1)) 創建從起始位置到位元組尾嘅掩碼
    // 與前面嘅掩碼進行與操作，確保只讀取需要嘅位
    const firstByteDataMask = ((2 ** 8 - 1) - (2 ** bitOffset - 1)) & firstByteLengthMask;
    
    // 第五步：提取數據並右移到正確位置（消除起始位偏移）
    // 將位元組與掩碼進行與操作，提取需要嘅位，然後右移到正確位置
    const firstByteNeededData = (firstByte & firstByteDataMask) >> bitOffset;

    // 第六步：初始化返回值為第一個位元組嘅數據
    let ret = firstByteNeededData;
    
    // 第七步：如果要讀取嘅位元數超過第一個位元組中可用嘅位元數，需要讀取更多位元組
    if (firstByteBitLength < bitLength) {
        let currentBitLength = firstByteBitLength; // 已經讀取嘅位元數
        let currentByteOffset = 0; // 在第一個位元組之後的偏移量
        let remainingBitLength = bitLength - currentBitLength; // 仲需要讀取嘅位元數

        // 第八步：繼續讀取後續位元組，直到讀取完要求嘅位元數
        while (remainingBitLength > 0) {
            // 移動到下一個位元組
            currentByteOffset += 1;

            // 從下一個位元組讀取數據（遞歸調用，但從位元組嘅起始位開始，即 bitOffset=0）
            // 呢度使用遞歸調用自身，但簡化了參數，因為後續位元組都係從第0位開始讀取
            const byteData = readBitsLE(buf, byteOffset + currentByteOffset, 0, Math.min(remainingBitLength, 8));
            
            // 將讀取嘅數據左移已讀取嘅位元數，然後加到結果中
            // 小端序：低位元組放低位，高位元組放高位，所以後讀嘅位元組需要左移
            // 呢個操作將新讀取嘅位元放到正確嘅位置上
            ret = ret + (byteData << currentBitLength);

            // 更新位元計數
            const delta = Math.min(remainingBitLength, 8);
            remainingBitLength -= delta;
            currentBitLength += delta;
        }
    }

    // 第九步：如果是有符號數，需要處理符號擴展
    if (signed) {
        // 計算符號位嘅位置（最高位）
        // 對於有符號整數，最高位表示符號（0為正，1為負）
        const cutoff = 1 << (bitLength - 1);
        
        // 檢查符號位是否為1（負數）
        if (ret > cutoff) {
            // 如果是負數，進行二補數轉換：減去2^lengthInBit
            // 二補數表示法中，負數 = 對應正數嘅二補數
            ret -= (1 << bitLength);
        }
    }

    // 第十步：返回讀取嘅數值
    return ret;
}

/**
 * 將值按小端序寫入緩衝區指定的位元位置
 * @param buf 數據緩衝區
 * @param byteOffset 起始位元組位置
 * @param bitOffset 起始位元位置
 * @param bitLength 要寫入的位元數
 * @param value 要寫入的數值 (number 或 bigint)
 */
export function writeBitsLE(
  buf: Buffer, 
  byteOffset: number, 
  bitOffset: number, 
  bitLength: number, 
  value: number | bigint
): void {
    // 處理不同類型的值
    const isValueBigInt = typeof value === 'bigint';
    const numericValue = isValueBigInt ? Number(value) : value as number;
    
    // 第一步：創建掩碼，用於清除第一個位元組中需要寫入嘅位
    // ((2^bitLength - 1) << bitOffset) 創建一個掩碼，在起始位置開始，長度為 bitLength 的位置設為1
    // 然後與 0xFF 進行與操作，確保掩碼只對一個位元組有效
    // 呢個掩碼會將需要寫入嘅位設為1，其他位設為0
    const dataMask = ((2 ** bitLength - 1) << bitOffset) & 0xFF;
    
    // 第二步：讀取當前位元組，並清除需要寫入的位置
    // (buf[byteOffset] | dataMask) ^ dataMask 操作會清除掩碼位置嘅位，保留其他位不變
    // 呢個技巧先將掩碼位置設為1，然後再異或掩碼，達到清除特定位嘅效果
    const firstByteClearedOldData = (buf.readUInt8(byteOffset) | dataMask) ^ dataMask;
    
    // 第三步：準備要寫入嘅數據
    // (value << bitOffset) 將數值左移到正確嘅起始位位置
    // 然後與掩碼進行與運算，確保只有需要寫入嘅位會被保留
    // 呢個操作確保數值只會影響到我們想要寫入嘅位
    const firstByteNewData = ((numericValue << bitOffset) & dataMask);
    
    // 第四步：合併現有數據與新數據，並寫入到位元組
    // 使用或運算將清除後嘅原始數據同新數據合併，然後寫回緩衝區
    buf.writeUInt8((firstByteClearedOldData | firstByteNewData), byteOffset);

    // 第五步：計算第一個位元組可以容納嘅位元數量
    // 一個位元組有8位，減去起始位偏移，得到可用位元數
    const firstByteBitLength = 8 - bitOffset;

    // 第六步：如果要寫入嘅位元數超過第一個位元組可容納嘅位元數，需要繼續寫入到後續位元組
    if (firstByteBitLength < bitLength) {
        // 計算還剩多少位元需要寫入
        // 總位元數減去已經寫入嘅位元數
        const remainingBitLength = bitLength - firstByteBitLength;
        
        // 獲取還未寫入嘅位（將value右移已寫入嘅位數）
        // 右移操作將已經寫入嘅低位丟棄，保留高位用於後續寫入
        const remainingData = isValueBigInt 
            ? Number((value as bigint) >> BigInt(firstByteBitLength))
            : numericValue >> firstByteBitLength;
        
        // 遞歸調用自身，寫入剩餘嘅位到下一個位元組
        // 注意起始位為0，因為從下一個位元組嘅頭部開始寫入
        // 呢個遞歸調用處理跨位元組嘅寫入操作
        writeBitsLE(buf, byteOffset + 1, 0, remainingBitLength, remainingData);
    }
}

/**
 * 按大端序從緩衝區的指定位元位置讀取值
 * @param buf 數據緩衝區
 * @param byteOffset 起始位元組位置
 * @param bitOffset 起始位元位置
 * @param bitLength 要讀取的位元數
 * @param signed 是否為有符號數值
 * @returns 讀取的數值
 */
export function readBitsBE(
  buf: Buffer, 
  byteOffset: number, 
  bitOffset: number, 
  bitLength: number, 
  signed = false
): number {
    // 第一步：調整起始位元組位置，考慮起始位偏移可能跨位元組嘅情況
    byteOffset += Math.floor(bitOffset / 8);
    bitOffset %= 8; // 調整起始位偏移到0-7嘅範圍
    
    // 第二步：計算結束位元組位置
    const endByteOffset = Math.ceil((byteOffset * 8 + bitOffset + bitLength) / 8);
    
    // 第三步：計算結束位偏移（在最後一個位元組中的位置）
    const endBitOffset = (bitOffset + bitLength) % 8 || 8;

    // 第四步：初始化返回值
    let ret = 0;

    // 第五步：按大端序讀取每個位元組（從高位到低位）
    for (let i = byteOffset; i < endByteOffset; i++) {
        const isFirstByte = (i === byteOffset);
        const isLastByte = (i === endByteOffset - 1);
        
        // 第六步：左移結果以容納新讀取嘅8位
        ret <<= 8;
        
        // 第七步：讀取當前位元組並加到結果中
        ret |= buf.readUInt8(i);

        // 第八步：如果是第一個位元組，需要清除起始位之前嘅位
        if (isFirstByte) {
            const mask = (0xFF >> bitOffset);
            ret &= mask;
        }

        // 第九步：如果是最後一個位元組，需要右移去掉不需要嘅尾部位
        if (isLastByte) {
            ret >>= (8 - endBitOffset);
        }
    }

    // 第十步：處理符號位
    if (signed) {
        // 計算符號位嘅位置（最高位）
        const cutoff = 1 << (bitLength - 1);
        
        // 檢查符號位是否為1（負數）
        if (ret > cutoff) {
            // 如果是負數，進行二補數轉換：減去2^lengthInBit
            ret -= (1 << bitLength);
        }
    }

    // 返回讀取嘅數值
    return ret;
}

/**
 * 將值按大端序寫入緩衝區指定的位元位置
 * @param buf 數據緩衝區
 * @param byteOffset 起始位元組位置
 * @param bitOffset 起始位元位置
 * @param bitLength 要寫入的位元數
 * @param value 要寫入的數值 (number 或 bigint)
 */
export function writeBitsBE(
  buf: Buffer, 
  byteOffset: number, 
  bitOffset: number, 
  bitLength: number, 
  value: number | bigint
): void {
    // 處理不同類型的值
    const numericValue = typeof value === 'bigint' ? Number(value) : value as number;
    
    // 第一步：調整起始位元組位置，考慮起始位偏移可能跨位元組嘅情況
    byteOffset += Math.floor(bitOffset / 8);
    bitOffset %= 8; // 調整起始位偏移到0-7嘅範圍
    
    // 第二步：計算結束位元組位置
    const endByteOffset = Math.ceil((byteOffset * 8 + bitOffset + bitLength) / 8);
    
    // 第三步：計算結束位偏移（在最後一個位元組中的位置）
    const endBitOffset = (bitOffset + bitLength) % 8 || 8;

    // 第四步：按大端序處理每個位元組（從高位到低位）
    for (let i = byteOffset; i < endByteOffset; i++) {
        const isFirstByte = (i === byteOffset);
        const isLastByte = (i === endByteOffset - 1);

        // 第五步：計算當前位元組內嘅起始位元位置
        const startBitOffsetInThisByte = isFirstByte ? bitOffset : 0;
        
        // 第六步：計算當前位元組內嘅結束位元位置
        const endBitOffsetInThisByte = isLastByte ? endBitOffset : 8;

        // 第七步：創建起始位掩碼（從起始位到位元組尾都設為1）
        const startBitMask = (0xFF >> startBitOffsetInThisByte);
        
        // 第八步：創建結束位掩碼（從位元組頭到結束位都設為1）
        const endBitMask = (0xFF >> endBitOffsetInThisByte);

        // 第九步：讀取當前位元組
        const byte = buf.readUInt8(i);
        
        // 第十步：清除需要寫入嘅位置
        // 即將(startBitMask ^ endBitMask)表示嘅位位置清零，保留其他位
        const clearedByte = byte & ~(startBitMask ^ endBitMask);

        // 第十一步：計算一些輔助值（用於處理大端序數據）
        const j = 8 - startBitOffsetInThisByte; // 當前位元組內可用嘅位數
        const k = endByteOffset - 1 - i; // 到最後一個位元組嘅距離

        // 第十二步：準備要寫入嘅數據
        let dataToWrite = numericValue;
        
        // 如果不是最後一個位元組，需要右移數據，因為大端序高位在前
        dataToWrite >>= isLastByte ? 0 : ((k - 1) * 8 + endBitOffset);
        
        // 左移數據到正確位置（考慮結束位置）
        dataToWrite <<= (8 - endBitOffsetInThisByte);
        
        // 確保數據只有一個位元組大小（截斷高位）
        dataToWrite &= 0xFF;

        // 第十三步：合併現有數據與新數據，並寫入到位元組
        const resultantByte = clearedByte | dataToWrite;
        buf.writeUInt8(resultantByte, i);
    }
}

/**
 * 解析格式定義，進行驗證並填充默認值
 * @param format 原始格式定義
 * @returns 處理後的格式定義
 */
function parseFormat(format: ObjectFormat): ParsedFormat {
    // 儲存解析後嘅格式項
    // 呢個數組會按照字段在二進制數據中嘅順序排序
    const parsedItems: ParsedFormatItem[] = [];
    
    // 建立字段名到格式項嘅映射，方便快速查找
    // 呢個映射表允許通過字段名直接訪問對應嘅格式項
    const keyMap = new Map<string, ParsedFormatItem>();
    
    // 用嚟檢查字段名是否重複
    // 使用 Set 數據結構確保每個字段名只出現一次
    const usedKeys = new Set<string>();
    
    // 遍歷對象格式的每個字段
    for (const [fieldName, fieldData] of Object.entries(format)) {
        // 第一步：檢查字段名稱是否已被使用，防止重複定義
        // 重複嘅字段名會導致數據覆蓋，所以需要嚴格檢查
        if (usedKeys.has(fieldName)) {
            throw new Error(`Field name '${fieldName}' is defined more than once.`);
        }
        usedKeys.add(fieldName);
        
        // 第二步：驗證 offset 必須為數字
        // offset 係必須嘅參數，用於確定字段在二進制數據中嘅起始位置
        if (typeof fieldData.offset !== 'number') {
            throw new Error(`Incorrect type of \`offset\` for field '${fieldName}'.`);
        }
        
        // 第三步：處理子格式（如果有）
        // 子格式用於表示嵌套對象，需要確保其為有效嘅對象格式
        const subFormat = fieldData.subFormat;
        if (subFormat !== undefined) {
            // 檢查子格式是否為有效的對象格式
            if (typeof subFormat !== 'object') {
                throw new Error(`Invalid \`subFormat\` for field '${fieldName}'. Must be an object.`);
            }
        }
        
        // 第四步：處理位元相關參數
        // 獲取起始位元組位置
        let offset = fieldData.offset;
        // 獲取起始位元位置，默認為0（位元組嘅第一位）
        // 注意：我們現在使用 bitOffset 代替 startBit
        let bitOffset = (fieldData as BitLevelFormatItem).bitOffset || 0; 
        
        // 第五步：處理 type 屬性
        // 如果有 subFormat，type 可以省略
        // 如果沒有 subFormat 且沒有指定 type，默認為 'int'
        let type = fieldData.type;
        if (!type) {
            if (subFormat) {
                // 有子格式時，type 可以省略
                type = 'int'; // 給一個默認值，但實際上不會被使用
            } else {
                // 沒有子格式時，默認 type 為 'int'
                type = 'int';
            }
        }
        
        // 第六步：檢查布爾類型的特殊限制 - 必須為1位元
        // 布爾值只需要1個位元來表示（0或1），所以長度必須為1
        if (type === 'boolean' && (fieldData as BitLevelFormatItem).bitLength !== undefined && (fieldData as BitLevelFormatItem).bitLength !== 1) {
            throw new Error(`Boolean field '${fieldName}' must have bitLength = 1.`);
        }
        
        // 第七步：檢查字符串和ArrayBuffer類型的限制 - 必須使用ByteAlignedFormatItem
        // 字符串和ArrayBuffer必須從位元組邊界開始，不能從位元組中間開始
        if ((type === 'string' || type === 'arraybuffer')) {
            // 檢查是否有人嘗試在字節對齊類型上使用位元級屬性
            const item = fieldData as ByteAlignedFormatItem;
            if ('bitOffset' in fieldData || 'bitLength' in fieldData) {
                throw new Error(`\`bitOffset\` or \`bitLength\` cannot be used with ${type} type. (field: ${fieldName})`);
            }
            // 檢查是否有設置length
            if (item.length === undefined) {
                throw new Error(`\`length\` must be defined for ${type} type. (field: ${fieldName})`);
            }
        }
        
        // 第八步：處理位元偏移，調整 offset 同 bitOffset
        // 如果 bitOffset 大於等於8，需要調整 offset 和 bitOffset
        if (bitOffset !== 0) {
            if (typeof bitOffset !== 'number') {
                throw new Error(`Incorrect type of \`bitOffset\` for field '${fieldName}'.`);
            }
            
            // 將過大嘅位元偏移轉換為位元組偏移
            // 例如：bitOffset=9 會轉換為 offset+1, bitOffset=1
            offset += Math.floor(bitOffset / 8);
            bitOffset = bitOffset % 8; // 保留剩餘嘅位元偏移（0-7）
        }
        
        // 第九步：處理長度相關參數 - length 同 bitLength 不能同時定義
        let bitLength = 0; // 初始化為數字，避免類型問題
        if (fieldData.length !== undefined) {
            // 如果定義了位元組長度，轉換為位元長度
            bitLength = fieldData.length * 8;
        } else if ((fieldData as BitLevelFormatItem).bitLength !== undefined) {
            // 如果定義了位元長度，直接使用
            const definedBitLength = (fieldData as BitLevelFormatItem).bitLength;
            if (typeof definedBitLength !== 'number' || isNaN(definedBitLength)) {
                throw new Error(`Invalid bitLength for field '${fieldName}': must be a number.`);
            }
            bitLength = definedBitLength;
        } else {
            // 兩者都未定義，報錯
            // 必須指定字段嘅長度，否則無法確定讀取/寫入多少數據
            throw new Error(`Neither \`length\` nor \`bitLength\` defined for field '${fieldName}'.`);
        }
        
        // 確保 bitLength 一定有值，不會是 undefined
        if (typeof bitLength !== 'number' || isNaN(bitLength)) {
            throw new Error(`Failed to determine valid bit length for field '${fieldName}'.`);
        }
        
        // 第十步：設置其他可選參數嘅默認值
        const arrayLength = fieldData.arrayLength; // 數組長度
        
        // 直接使用用戶提供嘅 transform，如果冇就係 undefined
        const readTransform = fieldData.readTransform;
        const writeTransform = fieldData.writeTransform;
        
        // 第十一步：創建解析後的格式項，包含所有必要信息
        const parsedItem: ParsedFormatItem = {
            key: fieldName,
            offset,
            bitOffset,  // 更新為bitOffset
            bitLength,
            arrayLength,
            type: type as 'boolean' | 'uint' | 'int' | 'string' | 'bigint' | 'arraybuffer',
            subFormat,
            readTransform,
            writeTransform
        };
        
        // 第十二步：將解析後的格式項添加到結果集同映射表中
        parsedItems.push(parsedItem);
        keyMap.set(fieldName, parsedItem);
    }
    
    // 第十三步：按 offset 同 bitOffset 排序，確保按數據在二進制中嘅順序處理
    // 呢個排序確保了讀寫操作按照字段在二進制數據中嘅實際順序進行
    parsedItems.sort((a, b) => {
        if (a.offset !== b.offset) {
            return a.offset - b.offset;  // 先按位元組排序
        }
        return a.bitOffset - b.bitOffset;  // 同一位元組內按位元排序
    });
    
    // 返回解析結果，包括格式項列表同名稱映射
    // items: 按二進制順序排序嘅格式項列表
    // keyMap: 字段名到格式項嘅映射，方便快速查找
    return { items: parsedItems, keyMap };
}

/**
 * 使用示例：
 * 
 * // 使用對象格式
 * const objectFormat: ObjectFormat = {
 *   id: { offset: 0, bitLength: 16, isSigned: false },
 *   name: { offset: 2, length: 10, isString: true },
 *   age: { offset: 12, bitLength: 8, isSigned: false }
 * };
 * 
 * // 解析二進制數據
 * const buffer = Buffer.from('...'); // 某些二進制數據
 * type Person = { id: number; name: string; age: number };
 * 
 * // 使用對象格式
 * const people = toJS<typeof objectFormat>(buffer, 13, objectFormat);
 * console.log(people[0].id, people[0].name, people[0].age);
 * 
 * // 將對象轉回二進制
 * const newPerson = { id: 1, name: 'John', age: 30 };
 * const newBuffer = fromJS([newPerson], 13, objectFormat);
 * 
 * // 復雜範例：嵌套對象
 * const nestedObjectFormat: ObjectFormat = {
 *   header: { 
 *     offset: 0, 
 *     length: 8,
 *     subFormat: {
 *       version: { offset: 0, bitLength: 8 },
 *       type: { offset: 1, bitLength: 8 },
 *       reserved: { offset: 2, length: 6 }
 *     }
 *   },
 *   data: { 
 *     offset: 8, 
 *     length: 20,
 *     subFormat: {
 *       id: { offset: 0, bitLength: 16 },
 *       value: { offset: 2, bitLength: 32, isSigned: true },
 *       text: { offset: 6, length: 14, isString: true }
 *     }
 *   }
 * };
 * 
 * // 能夠自動推導嵌套類型
 * const complexData = toJS(buffer, 28, nestedObjectFormat);
 * console.log(complexData[0].header.version, complexData[0].data.text);
 */

/**
 * 將二進制數據轉換為JavaScript對象
 * @param buf 包含二進制數據的Buffer或ArrayBuffer
 * @param recordLength 每個記錄的長度(位元組)
 * @param format 格式定義
 * @param keepBase64 是否在結果中保留原始數據的base64編碼
 * @param isBigEndian 是否使用大端序讀取(默認小端序)
 * @returns 解析後的JavaScript對象數組
 */
export function toJS<T extends ObjectFormat>(
  buf: Buffer | ArrayBuffer, 
  recordLength: number, 
  format: T, 
  keepBase64?: boolean, 
  isBigEndian = false
): Array<InferObjectFormat<T>> {
    // 如果輸入是 ArrayBuffer，轉換為 Buffer
    const buffer = buf instanceof ArrayBuffer ? Buffer.from(new Uint8Array(buf)) : buf;
    
    // 第一步：解析格式定義，獲取經過驗證和處理嘅格式項列表
    // 呢一步會將原始格式定義轉換成標準化嘅內部格式，以便後續嘅解析工作
    const { items: parsedItems } = parseFormat(format);
    
    // 第二步：計算數據中包含的記錄數量
    // 將緩衝區總長度除以每條記錄嘅長度，得出有幾多條記錄
    const numRecords = Math.floor(buffer.length / recordLength);
    
    // 第三步：初始化結果數組，用嚟存放解析後嘅 JavaScript 對象
    const records: Record<string, any>[] = [];
    
    // 第四步：根據大小端選擇適合嘅讀取函數
    // 小端序（先低位後高位）係默認值，適用於大多數系統
    // 大端序（先高位後低位）係某些特殊系統使用嘅格式
    const readBitsFn = isBigEndian ? readBitsBE : readBitsLE;

    // 第五步：循環處理每一條記錄
    for (let j = 0; j < numRecords; j++) {
        // 創建一個新嘅記錄對象，將存放解析出嚟嘅所有字段值
        const record: Record<string, any> = {};

        // 提取當前記錄嘅二進制數據
        // 使用 slice 方法從主緩衝區切割出當前記錄嘅數據部分
        const recordBuf = buffer.slice(recordLength * j, recordLength * (j + 1));

        // 如果需要保留原始數據，將 buffer 轉換為 base64 並添加到記錄
        // 呢個功能對於調試或者需要保留原始數據嘅場景非常有用
        if (keepBase64) {
            record.base64 = recordBuf.toString('base64');
        }

        // 第六步：循環處理每個字段
        for (let z = 0; z < parsedItems.length; z++) {
            // 解構獲取當前字段嘅所有屬性
            const {
                key,            // 字段名稱
                arrayLength,    // 數組長度（如果是數組）
                bitLength,      // 位元長度
                type,           // 數據類型（布爾、整數、字符串等）
                offset,      // 起始位元組
                bitOffset,      // 起始位元
                subFormat,      // 子格式（如果有）
                readTransform,  // 自定義讀取函數
            } = parsedItems[z];

            // 初始化結果數組，用於存放字段嘅值（單值或數組）
            const results: any[] = [];
            
            // 確定需要讀取嘅元素數量
            // 如果字段係數組類型，使用 arrayLength；否則讀取一個值
            const numRead = arrayLength || 1;

            // 第七步：循環讀取每個元素
            for (let i = 0; i < numRead; i++) {
                let result: any;

                // 根據不同數據類型處理
                
                // 情況 1：處理子格式（嵌套對象）
                if (subFormat) {
                    // 計算子記錄嘅長度（位元轉位元組）
                    // 子記錄通常佔據當前記錄嘅一部分空間
                    const resultLength = (bitLength / 8);
                    
                    // 從當前記錄中提取子記錄嘅數據
                    // 使用 slice 方法切割出子記錄嘅部分
                    const subRecordBuf = recordBuf.slice(offset + resultLength * i, offset + resultLength * (i + 1));

                    // 遞歸處理子格式
                    // 呼叫 toJS 自身處理子格式，實現了嵌套對象嘅解析
                    const subResults = toJS(
                        subRecordBuf,    // 子記錄數據
                        resultLength,    // 子記錄長度
                        subFormat,       // 子格式定義
                        false,           // 不保留 base64
                        isBigEndian,     // 保持同樣嘅字節序
                    );

                    // 獲取子格式解析結果
                    result = subResults[0];
                } 
                // 情況 2：處理字符串
                else if (type === 'string') {
                    // 讀取字符串，計算偏移和長度
                    // 呼叫 readString 函數從緩衝區讀取 UTF-8 編碼嘅字符串
                    result = readString(
                        recordBuf,
                        offset + (bitLength / 8) * i, // 起始位置
                        bitLength / 8,                    // 字符串長度（位元轉位元組）
                    );
                }
                // 情況 3：處理 ArrayBuffer 類型
                else if (type === 'arraybuffer') {
                    // 從記錄緩衝區中提取相應區域
                    const startOffset = offset + (bitLength / 8) * i;
                    const length = bitLength / 8;
                    
                    // 切割出需要的部分
                    const bufferSlice = recordBuf.slice(startOffset, startOffset + length);
                    
                    // 將 Buffer 轉換為 ArrayBuffer
                    result = bufferSlice.buffer.slice(
                        bufferSlice.byteOffset, 
                        bufferSlice.byteOffset + bufferSlice.length
                    );
                } 
                // 情況 4：處理數字和布爾值
                else {
                    // 計算起始位元組位置（考慮位元偏移）
                    // 對於位元級操作，需要精確計算每個位元嘅位置
                    const correctedStartByte = Math.trunc((offset * 8 + (bitOffset + i * bitLength)) / 8);
                    // 計算起始位元位置
                    const correctedBitOffset = (bitOffset + i * bitLength) % 8;

                    // 讀取原始值
                    const rawValue = readBitsFn(
                        recordBuf,
                        correctedStartByte,
                        correctedBitOffset,
                        bitLength,
                        type === 'int'  // 如果係 int 類型，就係有符號整數
                    );

                    // 根據類型轉換值
                    let typedValue: any;
                    if (type === 'boolean') {
                        typedValue = rawValue === 1;
                    } else if (type === 'bigint') {
                        typedValue = BigInt(rawValue);
                    } else {
                        typedValue = rawValue;
                    }
                    
                    result = typedValue;
                }

                // 添加到結果數組
                results.push(result);
            }

            // 第九步：根據是否為數組，設置字段值
            if (arrayLength) {
                // 如果是數組，直接使用結果數組，並應用 readTransform
                record[key] = readTransform ? readTransform(results) : results;
            } else {
                // 如果不是數組，使用第一個（也是唯一）結果，並應用 readTransform
                record[key] = readTransform ? readTransform(results[0]) : results[0];
            }
        }

        // 將當前解析完嘅記錄添加到記錄列表
        records.push(record);
    }

    // 第十步：返回結果，同時進行類型轉換，確保類型正確
    // TypeScript 會根據 InferObjectFormat<T> 類型自動推導出對象嘅類型
    return records as Array<InferObjectFormat<T>>;
}

/**
 * 將JavaScript對象轉換為二進制數據
 * @param arr JavaScript對象數組
 * @param recordLength 每個記錄的長度(位元組)
 * @param format 格式定義
 * @param isBigEndian 是否使用大端序寫入(默認小端序)
 * @param returnType 指定返回類型，'buffer' 或 'arraybuffer'
 * @returns 包含二進制數據的Buffer或ArrayBuffer
 */
export function fromJS<T extends ObjectFormat>(
  arr: Array<InferObjectFormat<T>>, 
  recordLength: number, 
  format: T, 
  isBigEndian = false,
  returnType: 'buffer' | 'arraybuffer' = 'buffer'
): Buffer | ArrayBuffer {
    // 第一步：解析格式定義，獲取經過驗證和處理嘅格式項列表
    // 呢一步確保格式定義係有效嘅，並將其轉換為內部使用嘅標準格式
    const { items: parsedItems } = parseFormat(format);
    
    // 第二步：初始化 Buffer 數組，用於存儲每個記錄嘅二進制數據
    // 每個 JavaScript 對象會轉換成一個 Buffer，最後合併
    const bufs: Buffer[] = [];
    
    // 第三步：根據大小端選擇適合嘅寫入函數
    // 小端序（先低位後高位）係默認值，適用於大多數系統
    // 大端序（先高位後低位）係某些特殊系統使用嘅格式
    const writeBitsFn = isBigEndian ? writeBitsBE : writeBitsLE;

    // 第四步：循環處理每個 JavaScript 對象
    for (let i = 0; i < arr.length; i++) {
        // 獲取當前對象
        const record = arr[i];

        // 第五步：創建一個新的 Buffer，大小為指定嘅記錄長度
        // 呢個 Buffer 初始化為全零，將用嚟存放轉換後嘅二進制數據
        const recordBuf = Buffer.alloc(recordLength);

        // 第六步：如果對象有 base64 屬性，將其轉換為二進制並複製到 buffer
        // 呢個功能允許用戶保留原始二進制數據嘅某些部分不變
        if (record.base64) {
            const data = Buffer.from(record.base64, 'base64');
            data.copy(recordBuf, 0, 0, Math.min(recordLength, data.length));
        }

        // 第七步：循環處理每個字段
        for (let z = 0; z < parsedItems.length; z++) {
            // 解構獲取當前字段嘅所有屬性
            const {
                key,            // 字段名稱
                arrayLength,    // 數組長度（如果是數組）
                bitLength,      // 位元長度
                type,           // 數據類型（布爾、整數、字符串等）
                offset,         // 起始位元組
                bitOffset,      // 起始位元
                subFormat,      // 子格式（如果有）
                writeTransform, // 自定義寫入函數
            } = parsedItems[z];

            // 第八步：獲取字段數據，處理數組情況
            let fieldData = record[key];
            
            // 如果 arrayLength 為 0（表示單個元素作為數組處理），但 fieldData 不是數組，則將其轉換為數組
            // 呢個處理確保後續操作可以統一處理數組形式嘅數據
            if (arrayLength === 0 && !Array.isArray(fieldData)) {
                // 使用類型斷言解決類型不匹配問題
                fieldData = [fieldData] as any;
            }
            
            // 第九步：確保數據是數組形式，方便統一處理
            // 無論原始數據係單值還是數組，都轉換為數組形式處理
            const dataArray = Array.isArray(fieldData) ? fieldData : [fieldData];
            const numWrites = arrayLength || 1; // 需要寫入嘅元素數量

            // 先應用 writeTransform
            const transformedArray = writeTransform ? writeTransform(dataArray) : dataArray;

            // 第十步：循環寫入每個元素
            for (let i = 0; i < numWrites && i < transformedArray.length; i++) {
                const currentValue = transformedArray[i];
                
                // 跳過未定義的值
                // 如果某個元素未定義，保持該位置嘅二進制數據不變
                if (currentValue === undefined) {
                    continue;
                }
                
                // 根據不同數據類型處理
                
                // 情況 1：處理子格式（嵌套對象）
                if (subFormat) {
                    // 計算子記錄嘅長度（位元轉位元組）
                    // 子記錄通常佔據當前記錄嘅一部分空間
                    const resultLength = (bitLength / 8);
                    
                    // 遞歸處理子格式數據，轉換為 Buffer
                    // 呼叫 fromJS 自身處理子格式，實現了嵌套對象嘅轉換
                    const subRecordBuf = fromJS([currentValue], resultLength, subFormat, isBigEndian, 'buffer') as Buffer;
                    
                    // 將子記錄 Buffer 複製到主記錄 Buffer 中
                    // 使用 copy 方法將子記錄嘅二進制數據複製到正確嘅位置
                    subRecordBuf.copy(recordBuf, (offset + resultLength * i));
                }
                // 情況 2：處理字符串
                else if (type === 'string') {
                    // 將字符串寫入 Buffer
                    // 呼叫 writeString 函數將字符串轉換為 UTF-8 編碼並寫入緩衝區
                        writeString(
                            recordBuf,
                        offset + (i * (bitLength / 8)), // 計算起始位置
                        (bitLength / 8),                   // 計算長度（位元轉位元組）
                        writeTransform ? String(writeTransform(currentValue)) : String(currentValue)  // 如果有 writeTransform 就轉換，冇就直接用原始值
                    );
                }
                // 情況 3：處理 ArrayBuffer 類型
                else if (type === 'arraybuffer') {
                    // 應用 writeTransform 轉換值（確保是 Buffer）
                    const bufferValue = writeTransform ? writeTransform(currentValue) : currentValue;
                    
                    // 計算目標位置和長度
                    const targetStart = offset + (i * (bitLength / 8));
                    const length = bitLength / 8;
                    
                    // 將 Buffer 複製到記錄緩衝區
                    bufferValue.copy(
                        recordBuf,
                        targetStart,
                        0,
                        Math.min(length, bufferValue.length)
                    );
                    
                    // 如果源緩衝區小於目標長度，填充零
                    if (bufferValue.length < length) {
                        recordBuf.fill(0, targetStart + bufferValue.length, targetStart + length);
                    }
                } 
                // 情況 4：處理數字、布爾值和 BigInt
                else {
                    // 計算起始位元組位置（考慮位元偏移）
                    // 對於位元級操作，需要精確計算每個位元嘅位置
                    const correctedStartByte = Math.trunc((offset * 8 + (bitOffset + i * bitLength)) / 8);
                    // 計算起始位元位置
                    const correctedBitOffset = (bitOffset + i * bitLength) % 8;

                    // 通過 writeTransform 轉換值
                    const transformedValue = writeTransform ? writeTransform(currentValue) : currentValue;
                    
                    // 根據類型進行適當的處理
                    // 布爾類型：轉換為 0 或 1
                    if (type === 'boolean') {
                        const boolValue = transformedValue ? 1 : 0;
                        // 寫入數值到 Buffer
                    writeBitsFn(
                        recordBuf,
                        correctedStartByte,
                            correctedBitOffset,
                            bitLength,
                            boolValue
                        );
                    }
                    // BigInt 類型：使用專門的 BigInt 寫入函數
                    else if (type === 'bigint') {
                        // 如果 transformedValue 不是 BigInt 類型，轉換為 BigInt
                        const bigintValue = typeof transformedValue === 'bigint' 
                            ? transformedValue 
                            : BigInt(transformedValue);
                        
                        // 使用專門的 BigInt 寫入函數
                        // bitOffset 必須是 8 的整數倍，否則無法正確寫入 64 位整數
                        if (bitOffset % 8 !== 0) {
                            throw new Error(`BigInt fields must start at byte boundaries (bitOffset must be a multiple of 8). Field: "${key}"`);
                        }
                        
                        writeBigInt64(
                            recordBuf,
                            offset,
                            bigintValue,
                            !isBigEndian  // writeBigInt64 的 littleEndian 參數與 isBigEndian 相反
                        );
                    }
                    // 其他數字類型：使用通用的位元寫入函數
                    else {
                        // 寫入數值到 Buffer
                        writeBitsFn(
                            recordBuf,
                            correctedStartByte,
                            correctedBitOffset,
                            bitLength,
                            Number(transformedValue) // 確保是數字類型
                        );
                    }
                }
            }
        }

        // 第十一步：將當前記錄的 Buffer 添加到結果數組
        // 每個 JavaScript 對象轉換完成後，將對應嘅 Buffer 添加到結果列表
        bufs.push(recordBuf);
    }

    // 第十二步：將所有記錄嘅 Buffer 合併成一個
    const result = Buffer.concat(bufs);
    
    // 根據指定的返回類型返回相應的數據結構
    if (returnType === 'arraybuffer') {
        // 將 Buffer 轉換為 ArrayBuffer
        return result.buffer.slice(result.byteOffset, result.byteOffset + result.length);
    }
        return result;
}

/**
 * 查詢格式中特定字段的信息
 * @param format 格式定義
 * @param fieldName 要查詢的字段名
 * @returns 該字段的解析後格式項
 */
export function getField(format: ObjectFormat, fieldName: string): ParsedFormatItem | undefined {
    const { keyMap } = parseFormat(format);
    return keyMap.get(fieldName);
}

/**
 * 獲取格式定義中所有字段的名稱列表
 * @param format 格式定義
 * @returns 字段名稱列表
 */
export function getFieldNames(format: ObjectFormat): string[] {
    const { keyMap } = parseFormat(format);
    return Array.from(keyMap.keys());
}

/**
 * 計算格式定義的總字節長度
 * @param format 格式定義
 * @returns 總字節長度
 */
export function calculateLength(format: ObjectFormat): number {
    const { items } = parseFormat(format);
    if (items.length === 0) return 0;
    
    let maxEndByte = 0;
    
    for (const item of items) {
        const itemBits = item.offset * 8 + item.bitOffset + item.bitLength;
        const itemEndByte = Math.ceil(itemBits / 8);
        maxEndByte = Math.max(maxEndByte, itemEndByte);
    }
    
    return maxEndByte;
}

/**
 * 使用對象格式快速創建二進制數據
 * @param data JavaScript對象
 * @param format 格式定義
 * @param isBigEndian 是否使用大端序
 * @param returnType 指定返回類型，'buffer' 或 'arraybuffer'
 * @returns 二進制數據Buffer或ArrayBuffer
 */
export function createBuffer<T extends ObjectFormat>(
    data: InferObjectFormat<T>,
    format: T,
    isBigEndian = false,
    returnType: 'buffer' | 'arraybuffer' = 'buffer'
): Buffer | ArrayBuffer {
    // 計算所需的緩衝區長度
    const length = calculateLength(format);
    // 調用 fromJS 函數將數據轉換為二進制
    return fromJS([data], length, format, isBigEndian, returnType);
}

/**
 * 將 BigInt 值寫入 Buffer 的指定位置
 * @param buf 目標 Buffer
 * @param offset 起始位元組偏移
 * @param value BigInt 值
 * @param littleEndian 是否使用小端序 (默認 true)
 */
export function writeBigInt64(buf: Buffer, offset: number, value: bigint, littleEndian = true): void {
    // 處理負數，使用二補數表示
    let val = value;
    const negative = val < 0n;
    if (negative) {
        // 如果是負數，取其二補數表示 (2^64 + value)
        val = (1n << 64n) + val;
    }
    
    if (littleEndian) {
        // 按小端序寫入（低位在前）
        for (let i = 0; i < 8; i++) {
            buf[offset + i] = Number(val & 0xFFn);
            val >>= 8n;
        }
    } else {
        // 按大端序寫入（高位在前）
        for (let i = 0; i < 8; i++) {
            buf[offset + 7 - i] = Number(val & 0xFFn);
            val >>= 8n;
        }
    }
}

/**
 * 從 Buffer 的指定位置讀取 BigInt 值
 * @param buf 源 Buffer
 * @param offset 起始位元組偏移
 * @param littleEndian 是否使用小端序 (默認 true)
 * @returns 讀取的 BigInt 值
 */
export function readBigInt64(buf: Buffer, offset: number, littleEndian = true): bigint {
    let val = 0n;
    
    if (littleEndian) {
        // 按小端序讀取（低位在前）
        for (let i = 7; i >= 0; i--) {
            val = (val << 8n) | BigInt(buf[offset + i]);
        }
    } else {
        // 按大端序讀取（高位在前）
        for (let i = 0; i < 8; i++) {
            val = (val << 8n) | BigInt(buf[offset + i]);
        }
    }
    
    // 處理負數（檢查最高位）
    if (val > (1n << 63n) - 1n) {
        // 如果最高位是1，表示這是一個負數，需要轉換回負數表示
        val = val - (1n << 64n);
    }
    
    return val;
}

/**
 * Bitten 類 - OOP 風格嘅二進制數據處理
 * 
 * 相比原本嘅函數式風格，類式 API 提供更好嘅使用體驗：
 * - 更好嘅封裝：一次設定格式，重複使用
 * - 更直觀嘅 API：對象化嘅接口，方便使用
 * - 實例狀態：保存設定（如 endianness、record length）喺實例內
 * - 更好嘅集成體驗：同其他 OOP 代碼更容易集成
 */
export class Bitten<T extends ObjectFormat = ObjectFormat, D = InferObjectFormat<T>> {
  private format: T;
  private recordLength: number;
  private isBigEndian: boolean;
  private parsedFormat: ParsedFormat;
  
  /**
   * 創建一個二進制格式處理器
   * @param format 格式定義
   * @param options 附加選項，包括記錄長度和大小端序
   */
  constructor(format: T, options?: { 
    recordLength?: number, 
    isBigEndian?: boolean 
  }) {
    this.format = format as T; // 使用类型断言处理非const格式
    this.parsedFormat = parseFormat(this.format);
    
    // 計算或使用提供嘅記錄長度
    if (options?.recordLength !== undefined) {
      this.recordLength = options.recordLength;
    } else {
      let maxEndByte = 0;
      for (const item of this.parsedFormat.items) {
        const itemBits = item.offset * 8 + item.bitOffset + item.bitLength;
        const itemEndByte = Math.ceil(itemBits / 8);
        maxEndByte = Math.max(maxEndByte, itemEndByte);
      }
      this.recordLength = maxEndByte;
    }
    
    // 設置大小端序
    this.isBigEndian = options?.isBigEndian ?? false;
  }
  
  /**
   * 從二進制數據解析為 JavaScript 對象
   * @param buffer 二進制數據（Buffer 或 ArrayBuffer）
   * @param options 選項，例如是否保留 base64 數據
   * @returns 解析後嘅對象
   */
  fromBuffer<R = D>(buffer: Buffer | ArrayBuffer, options?: {
    keepBase64?: boolean
  }): R {
    const result = toJS(
      buffer, 
      this.recordLength, 
      this.format, 
      options?.keepBase64, 
      this.isBigEndian
    );
    
    // toJS 始終返回陣列，我們只返回陣列嘅第一個元素
    if (result.length === 0) {
      throw new Error('Buffer 無法解析為有效對象');
    }
    
    // 使用泛型回傳類型，確保類型安全
    return result[0] as R;
  }
  
  /**
   * 將 JavaScript 對象轉換為二進制數據
   * @param data 要轉換嘅對象
   * @param returnType 返回類型：'buffer' 或 'arraybuffer'
   * @returns 二進制數據（Buffer 或 ArrayBuffer）
   */
  toBuffer(data: D, returnType: 'buffer' | 'arraybuffer' = 'buffer'): Buffer | ArrayBuffer {
    // 將單個對象包裝為陣列，因為 fromJS 需要陣列作為輸入
    return fromJS(
      [data as InferObjectFormat<T>], 
      this.recordLength, 
      this.format, 
      this.isBigEndian,
      returnType
    );
  }
}
