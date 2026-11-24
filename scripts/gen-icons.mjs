// 生成 PWA 图标（无第三方依赖，手写 PNG 编码）
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

const CRC = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return (buf) => {
    let c = -1
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ -1) >>> 0
  }
})()

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(CRC(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4)
  const r = size * 0.235 // 圆角半径
  const starR = size * 0.30
  const cx = size / 2
  const cy = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const px = x + 0.5
      const py = y + 0.5

      // 圆角矩形覆盖（用四角圆心距离判断）
      const dx = Math.max(r + 0.5 - px, 0, px - (size - r - 0.5))
      const dy = Math.max(r + 0.5 - py, 0, py - (size - r - 0.5))
      const d = Math.hypot(dx, dy)
      const inside = 1 - smooth(r - 0.7, r + 0.7, d)

      if (inside <= 0) {
        buf[i + 3] = 0
        continue
      }

      // 对角渐变 橙 → 玫红
      const t = (px / size) * 0.45 + (py / size) * 0.55
      let R = Math.round(255 * (1 - t) + 255 * t * 0.24)
      let G = Math.round(138 * (1 - t) + 61 * t)
      let B = Math.round(61 * (1 - t) + 110 * t)

      // 中央四角星（astroid）
      const nx = (px - cx) / starR
      const ny = (py - cy) / starR
      const s = Math.pow(Math.abs(nx), 2 / 3) + Math.pow(Math.abs(ny), 2 / 3)
      const star = 1 - smooth(0.94, 1.02, s)
      if (star > 0) {
        R = Math.round(R * (1 - star) + 255 * star)
        G = Math.round(G * (1 - star) + 250 * star)
        B = Math.round(B * (1 - star) + 245 * star)
      }

      buf[i] = R
      buf[i + 1] = G
      buf[i + 2] = B
      buf[i + 3] = Math.round(255 * inside)
    }
  }
  return encodePNG(size, size, buf)
}

const outDir = path.resolve('public')
fs.mkdirSync(outDir, { recursive: true })
for (const [name, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  fs.writeFileSync(path.join(outDir, name), render(size))
  console.log('wrote', name, size)
}
