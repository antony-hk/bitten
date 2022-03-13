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
    const firstByteDataMask = ((Math.pow(2, 8) - 1) - (Math.pow(2, startBitOffset) - 1)) & firstByteLengthMask;
    const firstByteNeededData = (firstByte & firstByteDataMask) >> startBitOffset;

    let ret = firstByteNeededData;
    if (firstByteBitLength < lengthInBit) {
        let currentBitLength = firstByteBitLength;
        let currentByteOffset = 0;
        let remainingBitLength = lengthInBit - currentBitLength;

        while (remainingBitLength > 0) {
            currentByteOffset += 1;

            let byteData = readBitsLE(buf, startByteOffset + currentByteOffset, 0, Math.min(remainingBitLength, 8));
            ret = ret + (byteData << currentBitLength);

            const delta = Math.min(remainingBitLength, 8);
            remainingBitLength -= delta;
            currentBitLength += delta;
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
        writeBitsLE(buf, startByteOffset + 1, 0, remainingBitLength, remainingData);
    }
}

export function readBitsBE(buf, startByteOffset, startBitOffset, lengthInBit, signed = false) {
    startByteOffset += Math.floor(startBitOffset / 8);
    startBitOffset %= 8;
    const endByteOffset = Math.ceil((startByteOffset * 8 + startBitOffset + lengthInBit) / 8);
    const endBitOffset = (startBitOffset + lengthInBit) % 8 || 8;

    let ret = 0;

    for (let i = startByteOffset; i < endByteOffset; i++) {
        const isFirstByte = (i === startByteOffset);
        const isLastByte = (i === endByteOffset - 1);
        ret <<= 8;
        ret |= buf.readUInt8(i);

        if (isFirstByte) {
            const mask = (0xFF >> startBitOffset);
            ret &= mask;
        }

        if (isLastByte) {
            ret >>= (8 - endBitOffset);
        }
    }

    return ret;
}

export function writeBitsBE(buf, startByteOffset, startBitOffset, lengthInBit, value) {
    startByteOffset += Math.floor(startBitOffset / 8);
    startBitOffset %= 8;
    const endByteOffset = Math.ceil((startByteOffset * 8 + startBitOffset + lengthInBit) / 8);
    const endBitOffset = (startBitOffset + lengthInBit) % 8 || 8;

    for (let i = startByteOffset; i < endByteOffset; i++) {
        const isFirstByte = (i === startByteOffset);
        const isLastByte = (i === endByteOffset - 1);

        const startBitOffsetInThisByte = isFirstByte ? startBitOffset : 0;
        const endBitOffsetInThisByte = isLastByte ? endBitOffset : 8;

        const startBitMask = (0xFF >> startBitOffsetInThisByte);
        const endBitMask = (0xFF >> endBitOffsetInThisByte);

        const byte = buf.readUInt8(i);
        const clearedByte = byte & ~(startBitMask ^ endBitMask);

        const j = 8 - startBitOffsetInThisByte;
        const k = endByteOffset - 1 - i;

        let dataToWrite = value;
        dataToWrite >>= isLastByte ? 0 : ((k - 1) * 8 + endBitOffset);
        dataToWrite <<= (8 - endBitOffsetInThisByte);
        dataToWrite &= 0xFF;

        const resultantByte = clearedByte | dataToWrite;

        buf.writeUInt8(resultantByte, i);
    }
}

function parseFormat(format) {
    if (!Array.isArray(format)) {
        throw new Error('`format` is not an array.');
    }
    let parsedFormat = [];

    for (let i = 0; i < format.length; i++) {
        const data = format[i];
        let usedKeys = new Set();

        let key = data.key;
        if (key === undefined) {
            throw new Error(`\`key\` is missing. (format with index = ${i})`);
        }
        if (usedKeys.has(key)) {
            throw new Error(`\`key\` value is defined before. (format with index = ${i})`)
        }
        usedKeys.add(key);

        let subFormat = data.subFormat;
        if (subFormat !== undefined && !Array.isArray(subFormat)) {
            throw new Error('`subFormat` is provided but it is not an array.');
        }

        let startByte = data.startByte;
        if (typeof startByte !== 'number') {
            throw new Error(`Incorrect type of \`startByte\`. (format with key = ${data.key})`);
        }

        let arrayLength = data.arrayLength || 0;
        let isSigned = data.isSigned;
        let isString = data.isString || false;
        let isStringWithInitialNull = data.isStringWithInitialNull || false;
        let startBit = data.startBit;
        if (isSigned !== undefined) {
            if (isString) {
                throw new Error(`\`isSigned\` is defined when the data is a string. (format with key = ${data.key})`);
            }
        }
        if (startBit !== undefined) {
            if (isString) {
                throw new Error(`\`startBit\` is defined when the data is a string. (format with key = ${data.key})`);
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
            isSigned,
            isString,
            isStringWithInitialNull,
            startByte,
            startBit,
            subFormat,
            getter,
            setter,
        });
    }

    return parsedFormat;
}

export function toJS(buf, recordLength, format, keepBase64, isBigEndian = false) {
    const parsedFormat = parseFormat(format);
    const numRecords = Math.floor(buf.length / recordLength);
    let records = [];
    const readBitsFn = isBigEndian ? readBitsBE : readBitsLE;

    for (let j = 0; j < numRecords; j++) {
        let record = {};

        const recordBuf = buf.slice(recordLength * j, recordLength * (j + 1));

        if (keepBase64) {
            record.base64 = recordBuf.toString('base64');
        }

        for (let z = 0; z < parsedFormat.length; z++) {
            const {
                key,
                arrayLength,
                lengthInBit,
                isString,
                isSigned,
                startByte,
                startBit,
                subFormat,
                getter,
            } = parsedFormat[z];

            let results = [];
            let numRead = arrayLength || 1;

            for (let i = 0; i < numRead; i++) {
                let result;

                if (subFormat) {
                    const resultLength = (lengthInBit / 8);
                    const resultBuf = recordBuf.slice(startByte + resultLength * i, (startByte + resultLength * (i+1)));

                    result = toJS(resultBuf, resultLength, subFormat, keepBase64, isBigEndian)[0];
                } else if (isString) {
                    result = readString(
                        recordBuf,
                        startByte + (i * (lengthInBit / 8)),
                        (lengthInBit / 8)
                    );
                } else {
                    const correctedStartByte = Math.trunc((startByte * 8 + (startBit + i * lengthInBit)) / 8);
                    const correctedStartBit = (startBit + i * lengthInBit) % 8;

                    result = readBitsFn(
                        recordBuf,
                        correctedStartByte,
                        correctedStartBit,
                        lengthInBit,
                        isSigned,
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

export function fromJS(arr, recordLength, format, isBigEndian = false) {
    const parsedFormat = parseFormat(format);
    let bufs = [];
    const writeBitsFn = isBigEndian ? writeBitsBE : writeBitsLE;

    for (let i = 0; i < arr.length; i++) {
        const record = arr[i];

        let recordBuf = Buffer.alloc(recordLength);

        if (record.base64) {
            const data = Buffer.from(record.base64, 'base64');
            data.copy(recordBuf, 0, 0, Math.min(recordLength, data.length));
        }

        for (let z = 0; z < parsedFormat.length; z++) {
            const {
                key,
                arrayLength,
                lengthInBit,
                isString,
                startByte,
                startBit,
                subFormat,
                setter,
            } = parsedFormat[z];

            // Put the data into an array if the arrayLength is 0
            const data = ((arrayLength === 0) ? [record[key]] : record[key]);

            const numWrites = (arrayLength || 1);

            for (let i = 0; i < numWrites; i++) {
                if (subFormat) {
                    if (data[i] !== undefined) {
                        const resultLength = (lengthInBit / 8);
                        const subRecordBuf = fromJS([data[i]], resultLength, subFormat, isBigEndian);
                        subRecordBuf.copy(recordBuf, (startByte + resultLength * i));
                    }
                } else if (isString) {
                    if (data[i] !== undefined) {
                        writeString(
                            recordBuf,
                            startByte + (i * (lengthInBit / 8)),
                            (lengthInBit / 8),
                            setter(data[i])
                        );
                    }
                } else {
                    const correctedStartByte = Math.trunc((startByte * 8 + (startBit + i * lengthInBit)) / 8);
                    const correctedStartBit = (startBit + i * lengthInBit) % 8;

                    writeBitsFn(
                        recordBuf,
                        correctedStartByte,
                        correctedStartBit,
                        lengthInBit,
                        setter(data[i])
                    );
                }
            }
        }

        bufs.push(recordBuf);
    }

    return Buffer.concat(bufs);
}
