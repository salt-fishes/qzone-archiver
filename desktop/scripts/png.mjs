/**
 * 最小 PNG 解码/编码（v4.7）
 *
 * 背景：应用图标只有 128×128，而 electron-builder 要求 Windows 图标 ≥256×256；
 * 环境不便引入 sharp/canvas 等原生依赖，故用 zlib + 手写实现做纯 JS 放大。
 *
 * 支持范围（足够覆盖本项目所有 PNG 资产）：
 *   - 位深 8、颜色类型 6（RGBA）/ 2（RGB）/ 0（灰度）/ 4（灰度+Alpha）
 *   - 无隔行（interlace=0）
 * 不支持：位深 1/2/4/16、调色板（类型 3）、Adam7 隔行 —— 遇到时明确抛错，不静默出错图。
 */
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 4: 2, 6: 4 };

/**
 * 解码 PNG → { width, height, data: Buffer(RGBA) }
 * @param {Buffer} buf
 */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('不是 PNG 文件（签名不匹配）');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const data = buf.subarray(dataStart, dataStart + length);
    offset = dataStart + length + 4; // 跳过 CRC

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatParts.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!width || !height) throw new Error('PNG 缺少 IHDR');
  if (bitDepth !== 8) throw new Error(`暂不支持位深 ${bitDepth}（仅支持 8）`);
  if (interlace !== 0) throw new Error('暂不支持隔行（Adam7）PNG');
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!channels) throw new Error(`暂不支持的颜色类型 ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  // 上一行（已反滤波）用于 Up/Average/Paeth 预测
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const lineStart = y * (stride + 1) + 1;
    const line = Buffer.from(raw.subarray(lineStart, lineStart + stride));

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let value = line[x];
      switch (filter) {
        case 0: break;
        case 1: value = (value + a) & 0xff; break;
        case 2: value = (value + b) & 0xff; break;
        case 3: value = (value + ((a + b) >> 1)) & 0xff; break;
        case 4: value = (value + paeth(a, b, c)) & 0xff; break;
        default: throw new Error(`未知的 PNG 滤波器类型 ${filter}`);
      }
      line[x] = value;
    }

    // 转成 RGBA
    for (let x = 0; x < width; x++) {
      const si = x * channels;
      const di = (y * width + x) * 4;
      if (channels === 4) {
        out[di] = line[si];
        out[di + 1] = line[si + 1];
        out[di + 2] = line[si + 2];
        out[di + 3] = line[si + 3];
      } else if (channels === 3) {
        out[di] = line[si];
        out[di + 1] = line[si + 1];
        out[di + 2] = line[si + 2];
        out[di + 3] = 255;
      } else if (channels === 2) {
        out[di] = out[di + 1] = out[di + 2] = line[si];
        out[di + 3] = line[si + 1];
      } else {
        out[di] = out[di + 1] = out[di + 2] = line[si];
        out[di + 3] = 255;
      }
    }
    prev = line;
  }

  return { width, height, data: out };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * 双线性放大 RGBA 位图
 * @param {{width:number,height:number,data:Buffer}} img
 * @param {number} targetW
 * @param {number} targetH
 */
export function resizeBilinear(img, targetW, targetH) {
  const { width: sw, height: sh, data: src } = img;
  const dst = Buffer.alloc(targetW * targetH * 4);
  const xRatio = sw / targetW;
  const yRatio = sh / targetH;

  for (let y = 0; y < targetH; y++) {
    // 采样点对齐像素中心，避免整体偏移
    const sy = Math.min(sh - 1, Math.max(0, (y + 0.5) * yRatio - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = sy - y0;

    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(sw - 1, Math.max(0, (x + 0.5) * xRatio - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = sx - x0;

      const di = (y * targetW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const p00 = src[(y0 * sw + x0) * 4 + c];
        const p10 = src[(y0 * sw + x1) * 4 + c];
        const p01 = src[(y1 * sw + x0) * 4 + c];
        const p11 = src[(y1 * sw + x1) * 4 + c];
        const top = p00 + (p10 - p00) * wx;
        const bottom = p01 + (p11 - p01) * wx;
        dst[di + c] = Math.round(top + (bottom - top) * wy);
      }
    }
  }
  return { width: targetW, height: targetH, data: dst };
}

/**
 * §F：Win11 图标圆角分档——<32px→2px、32px→4px、>32px→8px（用户拍板，非单一比例）。
 * Windows 的做法是同一张图在不同尺寸下圆角半径不同，故按输出尺寸查表。
 * @param {number} size 输出图标的边长（px）
 */
export function radiusForSize(size) {
  return size < 32 ? 2 : size === 32 ? 4 : 8;
}

/**
 * §F：圆角掩膜——alpha 乘以圆角覆盖率，4×4 超采样抗锯齿（纯 JS，小尺寸下圆角仍平滑）。
 * @param {{width:number,height:number,data:Buffer}} img RGBA 位图
 * @param {number} radiusPx 圆角半径（绝对像素，> 半边长时收敛到半边长）
 */
export function roundCorners(img, radiusPx) {
  const { width, height, data } = img;
  const out = Buffer.from(data);
  const r = Math.max(0, Math.min(radiusPx, Math.floor(Math.min(width, height) / 2)));
  if (r <= 0) return { width, height, data: out };
  const w = width;
  const h = height;
  const S = 4; // 每像素 4×4 超采样

  /** 点 (px,py) 是否在圆角矩形内部：四角按圆心距离判定，其余恒在内部 */
  function inside(px, py) {
    let cx = null;
    let cy = null;
    if (px < r && py < r) { cx = r; cy = r; }
    else if (px >= w - r && py < r) { cx = w - r; cy = r; }
    else if (px < r && py >= h - r) { cx = r; cy = h - r; }
    else if (px >= w - r && py >= h - r) { cx = w - r; cy = h - r; }
    if (cx === null) return true;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let count = 0;
      for (let sy = 0; sy < S; sy++) {
        const py = y + (sy + 0.5) / S;
        for (let sx = 0; sx < S; sx++) {
          if (inside(x + (sx + 0.5) / S, py)) count++;
        }
      }
      if (count === S * S) continue; // 完全在内部：保留原 alpha
      const di = (y * w + x) * 4 + 3;
      out[di] = Math.round(data[di] * (count / (S * S)));
    }
  }
  return { width, height, data: out };
}

/**
 * §F/R2：编码 24 位 BMP（electron-builder portable.splashImage 只接受 BMP）。
 * 自底向上行序 + 行宽按 4 字节对齐；alpha 丢弃（splash 自身为不透明底色合成图）。
 * @param {{width:number,height:number,data:Buffer}} img RGBA 位图
 */
export function encodeBmp24(img) {
  const { width, height, data } = img;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelArraySize = rowSize * height;
  const dataOffset = 54;
  const buf = Buffer.alloc(dataOffset + pixelArraySize);
  // BITMAPFILEHEADER（14 字节）
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(dataOffset, 10);
  // BITMAPINFOHEADER（40 字节）
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // 正数 = 自底向上
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  buf.writeUInt32LE(0, 30); // BI_RGB 不压缩
  buf.writeUInt32LE(pixelArraySize, 34);
  buf.writeInt32LE(2835, 38); // 72 dpi（水平）
  buf.writeInt32LE(2835, 42); // 72 dpi（垂直）
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const si = (srcY * width + x) * 4;
      const di = dataOffset + y * rowSize + x * 3;
      buf[di] = data[si + 2]; // B
      buf[di + 1] = data[si + 1]; // G
      buf[di + 2] = data[si]; // R
    }
  }
  return buf;
}

/** 编码 RGBA 位图为 PNG（颜色类型 6，位深 8） */
export function encodePng(img) {
  const { width, height, data } = img;
  const stride = width * 4;
  // 每行前缀 1 字节滤波器类型 0（None）
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const chunks = [SIGNATURE];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(makeChunk('IHDR', ihdr));
  chunks.push(makeChunk('IDAT', zlib.deflateSync(raw, { level: 9 })));
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * 打包多尺寸 ICO（v4.7）——NSIS 的 installerIcon/uninstallerIcon 只接受 .ico，
 * 传 PNG 会报 "invalid icon file"。这里用「PNG 压缩型 ICO」（Vista+ 支持）
 * 把多个尺寸的 PNG 装进一个 ico 容器。
 * @param {Array<{size:number, png:Buffer}>} images
 */
export function encodeIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const directory = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;

  images.forEach((img, i) => {
    const base = i * 16;
    // 256 在 ICO 目录里用 0 表示
    directory[base] = img.size >= 256 ? 0 : img.size;
    directory[base + 1] = img.size >= 256 ? 0 : img.size;
    directory[base + 2] = 0; // 调色板数量
    directory[base + 3] = 0; // reserved
    directory.writeUInt16LE(1, base + 4); // color planes
    directory.writeUInt16LE(32, base + 6); // bits per pixel
    directory.writeUInt32LE(img.png.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += img.png.length;
  });

  return Buffer.concat([header, directory, ...images.map((i) => i.png)]);
}
