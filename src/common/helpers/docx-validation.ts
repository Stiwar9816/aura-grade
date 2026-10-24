import { inflateRawSync } from 'zlib';

const MAX_DOCX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024;

export function hasValidDocxDirectory(content: Buffer): boolean {
  if (content.length < 22 || content.readUInt32LE(0) !== 0x04034b50) return false;

  const searchStart = Math.max(0, content.length - 65557);
  let endOfCentralDirectory = -1;
  for (let offset = content.length - 22; offset >= searchStart; offset -= 1) {
    if (content.readUInt32LE(offset) === 0x06054b50) {
      endOfCentralDirectory = offset;
      break;
    }
  }
  if (endOfCentralDirectory < 0) return false;

  const totalEntries = content.readUInt16LE(endOfCentralDirectory + 10);
  const centralDirectorySize = content.readUInt32LE(endOfCentralDirectory + 12);
  const centralDirectoryOffset = content.readUInt32LE(endOfCentralDirectory + 16);
  const directoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (
    totalEntries === 0 ||
    content.readUInt16LE(endOfCentralDirectory + 4) !== 0 ||
    content.readUInt16LE(endOfCentralDirectory + 6) !== 0 ||
    content.readUInt16LE(endOfCentralDirectory + 8) !== totalEntries ||
    endOfCentralDirectory + 22 + content.readUInt16LE(endOfCentralDirectory + 20) !==
      content.length ||
    directoryEnd !== endOfCentralDirectory
  )
    return false;

  const entries = new Set<string>();
  let totalUncompressedSize = 0;
  let cursor = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > directoryEnd || content.readUInt32LE(cursor) !== 0x02014b50) return false;

    const flags = content.readUInt16LE(cursor + 8);
    const compressionMethod = content.readUInt16LE(cursor + 10);
    const compressedSize = content.readUInt32LE(cursor + 20);
    const uncompressedSize = content.readUInt32LE(cursor + 24);
    const localOffset = content.readUInt32LE(cursor + 42);
    const fileNameLength = content.readUInt16LE(cursor + 28);
    const extraLength = content.readUInt16LE(cursor + 30);
    const commentLength = content.readUInt16LE(cursor + 32);
    const nextCursor = cursor + 46 + fileNameLength + extraLength + commentLength;
    if (
      (flags & 0x1) !== 0 ||
      ![0, 8].includes(compressionMethod) ||
      uncompressedSize === 0xffffffff ||
      nextCursor > directoryEnd
    )
      return false;

    if (
      localOffset + 30 > centralDirectoryOffset ||
      content.readUInt32LE(localOffset) !== 0x04034b50
    )
      return false;
    const dataStart =
      localOffset +
      30 +
      content.readUInt16LE(localOffset + 26) +
      content.readUInt16LE(localOffset + 28);
    if (dataStart + compressedSize > centralDirectoryOffset) return false;
    try {
      const compressed = content.subarray(dataStart, dataStart + compressedSize);
      const actual =
        compressionMethod === 0
          ? compressed
          : inflateRawSync(compressed, {
              maxOutputLength: Math.max(1, MAX_DOCX_UNCOMPRESSED_SIZE - totalUncompressedSize),
            });
      if (actual.length !== uncompressedSize) return false;
    } catch {
      return false;
    }
    totalUncompressedSize += uncompressedSize;
    if (totalUncompressedSize > MAX_DOCX_UNCOMPRESSED_SIZE) return false;
    entries.add(content.toString('utf8', cursor + 46, cursor + 46 + fileNameLength));
    cursor = nextCursor;
  }

  return (
    cursor === directoryEnd &&
    entries.has('[Content_Types].xml') &&
    entries.has('word/document.xml')
  );
}
