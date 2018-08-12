export function readString(buf, offset, length) {
    return buf.slice(offset, offset + length).toString('utf8').replace(/\0/g, '');
}

export function writeString(buf, offset, length, string) {
    buf.fill(0, offset, offset + length);
    string += '\u0000';
    return buf.write(string, offset, length, 'utf8');
}

export function readBitsLE(buf, startByteOffset, startBitOffset, lengthInBit, signed = false) {
    const firstByte = buf.readUInt8(startByteOffset);
    const firstByteBitLength = 8 - startBitOffset;
    const firstByteLengthMask = (Math.pow(2, Math.min(firstByteBitLength, lengthInBit)) - 1) << startBitOffset;
    const firstByteDataMask = ((Math.pow(2, 8) - 1) - (Math.pow(2, startBitOffset) - 1)) & firstByteLengthMask;    // LE (PS4, PC)
    const firstByteNeededData = (firstByte & firstByteDataMask) >> startBitOffset;

    let ret = firstByteNeededData;
    if (firstByteBitLength < lengthInBit) {
        let currentBitLength = firstByteBitLength;
        let currentByteOffset = 0;
        let remainingBitLength = lengthInBit - currentBitLength;

        while (remainingBitLength > 0) {
            currentByteOffset += 1;

            let byteData = readBitsLE(buf, startByteOffset + currentByteOffset, 0, Math.min(remainingBitLength, 8));
            ret = ret + (byteData << currentBitLength);    // LE (PS4, PC)
            remainingBitLength -= Math.min(remainingBitLength, 8);
            currentBitLength += Math.min(remainingBitLength, 8);
        }
    }

    if (signed) {
        let cutoff = 1 << (lengthInBit - 1);
        if (ret > cutoff) {
            ret -= (1 << lengthInBit);
        }
    }

    return ret;
}

export function writeBitsLE(buf, startByteOffset, startBit, lengthInBit, value) {
    const dataMask = ((Math.pow(2, lengthInBit) - 1) << startBit) & 0xFF;
    const firstByteClearedOldData = (buf.readUInt8(startByteOffset) | dataMask) ^ dataMask;
    const firstByteNewData = (value << startBit) & dataMask;
    buf.writeUInt8((firstByteClearedOldData | firstByteNewData), startByteOffset);

    const firstByteBitLength = 8 - startBit;

    if (firstByteBitLength < lengthInBit) {
        const remainingBitLength = lengthInBit - firstByteBitLength;
        const remainingData = value >> firstByteBitLength;
        writeBitsLE(buf, startByteOffset + 1, 0, remainingBitLength, remainingData);    // Do it recursively
    }
}

function parseFormat(format) {
    if (!Array.isArray(format)) {
        return;
    }
    let parsedFormat = [];

    for (let i = 0; i < format.length; i++) {
        const data = format[i];
        let usedKeys = new Set();

        let key = data.key;
        if (key === undefined) {
            throw new Error(```key`` is missing. (format with index = ${i})`);
        }
        if (usedKeys.has(key)) {
            throw new Error(```key`` value is defined before. (format with index = ${i})`)
        }
        usedKeys.add(key);

        let startByte = data.startByte;
        if (typeof startByte !== 'number') {
            throw new Error(`Incorrect type of ``startByte``. (format with key = ${data.key})`);
        }

        let arrayLength = data.arrayLength || 0;
        let isString = data.isString || false;
        let startBit = data.startBit;
        if (startBit !== undefined) {
            if (isString) {
                throw new Error(```startBit`` is defined when the data is a string. (format with key = ${data.key})`);
            }
            if (typeof startBit !== 'number') {
                throw new Error(`Incorrect type of ``startBit``. (format with key = ${data.key})`);
            }

            startByte += Math.floor(startBit / 8);
            startBit = startBit % 8;
        } else {
            startBit = 0;
        }

        let lengthInBit = data.lengthInBit;
        if (data.length !== undefined && lengthInBit !== undefined) {
            throw new Error(```length`` and ``lengthInBit`` defined at the same time. (format with key = ${data.key}).`);
        }
        if (data.length !== undefined) {
            lengthInBit = data.length * 8;
        }

        let getter = data.getter || function (input) { return input };
        let setter = data.setter || function (input) { return input };

        parsedFormat.push({
            key,
            arrayLength,
            lengthInBit,
            isString,
            startByte,
            startBit,
            getter,
            setter,
        });
    }

    return parsedFormat;
}

export function bin2obj(buf, recordLength, format, keepBase64) {
    const parsedFormat = parseFormat(format);
    const numRecords = Math.floor(buf.length / recordLength);
    let records = [];

    for (let j = 0; j < numRecords; j++) {
        let record = {};

        const recordBuf = buf.slice(recordLength * j, recordLength * (j + 1));

        if (keepBase64) {
            record.base64 = recordBuf.toString('base64');
        }

        for (let i = 0; i < parsedFormat.length; i++) {
            const {
                key,
                arrayLength,
                lengthInBit,
                isString,
                startByte,
                startBit,
                getter,
            } = parsedFormat[i];

            let results = [];
            let numRead = arrayLength || 1;

            for (let i = 0; i < numRead; i++) {
                let result;

                if (isString) {
                    result = readString(
                        recordBuf,
                        startByte + (i * (lengthInBit / 8)),
                        (lengthInBit / 8)
                    );
                } else {
                    const correctedStartByte = Math.trunc((startByte * 8 + (startBit + i * lengthInBit)) / 8);
                    const correctedStartBit = (startBit + i * lengthInBit) % 8;

                    result = readBitsLE(
                        recordBuf,
                        correctedStartByte,
                        correctedStartBit,
                        lengthInBit,
                        false
                    );
                }

                results.push(getter(result));
            }

            if (arrayLength) {
                record[key] = results;
            } else {
                record[key] = results[0];
            }
        }

        records.push(record);
    }

    return records;
}

export function obj2bin(arr, recordLength, format) {
    const parsedFormat = parseFormat(format);
    let bufs = [];

    for (let i = 0; i < arr.length; i++) {
        const record = arr[i];

        let recordBuf;

        if (record.base64) {
            recordBuf = Buffer.from(record.base64, 'base64');
        } else {
            recordBuf = Buffer.alloc(recordLength);
        }

        for (let i = 0; i < parsedFormat.length; i++) {
            const {
                key,
                lengthInBit,
                isString,
                startByte,
                startBit,
                setter,
            } = parsedFormat[i];

            if (isString) {
                writeString(recordBuf, startByte, (lengthInBit / 8), setter(record[key]));
            } else {
                writeBitsLE(recordBuf, startByte, startBit, lengthInBit, setter(record[key]));
            }
        }

        bufs.push(recordBuf);
    }

    return Buffer.concat(bufs);
}
