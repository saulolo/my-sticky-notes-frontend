// Genera los recursos gráficos del instalador (SPEC 06) con Electron, sin dependencias nuevas:
//   build/author-logo.ico       24–128 px, logo del autor en círculo (lateral nativo del asistente)
//   build/installer-header.bmp  150 × 57  (cabecera de las pantallas intermedias: solo el icono)
// Uso: `npm run art`. Dibuja en un <canvas> de una ventana oculta (texto con Inter) y codifica
// BMP/ICO aquí. El lateral de Bienvenida y Final no es una imagen: lo dibuja build/installer.nsh.
// Los archivos generados van a git; se pueden reemplazar a mano después. El icono de la app no se
// genera: build/icon.ico lo aporta el usuario y resources/icon.png es su imagen de 256 px.
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JavaScript plano, sin tipos */
import { app, BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const at = (...parts) => join(root, ...parts)

// Logo de la tarjeta "Creado por" del instalador: hasta 128 px (el PNG del autor mide 173 × 180).
const LOGO_SIZES = [24, 32, 40, 48, 64, 80, 96, 128]
const HEADER = { width: 150, height: 57 }

const dataUrl = (file, mime) => `data:${mime};base64,${readFileSync(file).toString('base64')}`

function inputs() {
  const logoFile = at('build', 'author-logo.png')
  if (!existsSync(logoFile)) {
    console.warn('Falta build/author-logo.png: se dibuja un círculo con las iniciales "SE".')
  }
  return {
    version: JSON.parse(readFileSync(at('package.json'), 'utf8')).version,
    icon: dataUrl(at('resources', 'icon.png'), 'image/png'),
    logo: existsSync(logoFile) ? dataUrl(logoFile, 'image/png') : null,
    inter400: dataUrl(
      at('node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2'),
      'font/woff2'
    ),
    inter600: dataUrl(
      at('node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2'),
      'font/woff2'
    ),
    logoSizes: LOGO_SIZES,
    header: HEADER
  }
}

// Se ejecuta dentro de la ventana oculta: devuelve píxeles RGBA.
async function draw(input) {
  const BG = '#252526'
  const LOGO_BG = '#F5C451'
  const FONT = 'Inter, system-ui, sans-serif'

  for (const [weight, src] of [
    [400, input.inter400],
    [600, input.inter600]
  ]) {
    const face = new FontFace('Inter', `url(${src})`, { weight: String(weight) })
    document.fonts.add(await face.load())
  }

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  const icon = await loadImage(input.icon)
  const logo = input.logo ? await loadImage(input.logo) : null

  const canvasOf = (width, height) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    return { canvas, ctx }
  }
  const pixels = ({ canvas, ctx }) =>
    Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data)

  // Reduce a la mitad mientras se pueda: escalar 512 → 16 de una vez queda borroso.
  const scaled = (img, size) => {
    let source = img
    let current = img.width
    while (current / 2 >= size) {
      current = Math.round(current / 2)
      const step = canvasOf(current, current)
      step.ctx.drawImage(source, 0, 0, current, current)
      source = step.canvas
    }
    const out = canvasOf(size, size)
    out.ctx.drawImage(source, 0, 0, size, size)
    return out
  }

  const drawLogo = (ctx, cx, cy, radius) => {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fillStyle = LOGO_BG
    ctx.fill()
    ctx.clip()
    if (logo) {
      // Recorte cuadrado centrado ("cover") dentro del círculo.
      const side = Math.min(logo.width, logo.height)
      const sx = (logo.width - side) / 2
      const sy = (logo.height - side) / 2
      const small = scaled(
        (() => {
          const square = canvasOf(side, side)
          square.ctx.drawImage(logo, sx, sy, side, side, 0, 0, side, side)
          return square.canvas
        })(),
        radius * 2
      )
      ctx.drawImage(small.canvas, cx - radius, cy - radius)
    } else {
      ctx.fillStyle = BG
      ctx.font = `600 ${Math.round(radius * 0.8)}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('SE', cx, cy + 1)
    }
    ctx.restore()
  }

  // Logo del autor en círculo, fondo transparente: lo carga el lateral nativo del instalador.
  const logos = input.logoSizes.map((size) => {
    const c = canvasOf(size, size)
    drawLogo(c.ctx, size / 2, size / 2, size / 2)
    return { size, rgba: pixels(c), png: null }
  })
  // Cabecera de las pantallas intermedias: solo el icono, a la derecha, sobre el blanco de la
  // franja de Windows (sin bloque oscuro).
  const head = canvasOf(input.header.width, input.header.height)
  {
    const { ctx } = head
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, input.header.width, input.header.height)
    const size = 44
    const margin = (input.header.height - size) / 2
    ctx.drawImage(scaled(icon, size).canvas, input.header.width - size - margin, margin)
  }

  return { logos, header: pixels(head) }
}

// BMP de 24 bits, de abajo arriba (lo que piden las imágenes de NSIS).
function bmp24(rgba, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const dataSize = rowSize * height
  const buf = Buffer.alloc(54 + dataSize)
  buf.write('BM', 0, 'ascii')
  buf.writeUInt32LE(54 + dataSize, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(dataSize, 34)
  buf.writeInt32LE(2835, 38) // 72 ppp
  buf.writeInt32LE(2835, 42)
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      buf[row + x * 3] = rgba[i + 2]
      buf[row + x * 3 + 1] = rgba[i + 1]
      buf[row + x * 3 + 2] = rgba[i]
    }
  }
  return buf
}

// Entrada DIB de 32 bits (BGRA, de abajo arriba, con máscara AND vacía) para un .ico.
function icoDib(rgba, size) {
  const maskRow = Math.ceil(size / 32) * 4
  const buf = Buffer.alloc(40 + size * size * 4 + maskRow * size)
  buf.writeUInt32LE(40, 0)
  buf.writeInt32LE(size, 4)
  buf.writeInt32LE(size * 2, 8)
  buf.writeUInt16LE(1, 12)
  buf.writeUInt16LE(32, 14)
  buf.writeUInt32LE(size * size * 4 + maskRow * size, 20)
  for (let y = 0; y < size; y++) {
    const row = 40 + (size - 1 - y) * size * 4
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      buf[row + x * 4] = rgba[i + 2]
      buf[row + x * 4 + 1] = rgba[i + 1]
      buf[row + x * 4 + 2] = rgba[i]
      buf[row + x * 4 + 3] = rgba[i + 3]
    }
  }
  return buf
}

// .ico: tamaños pequeños como DIB (compatibles con todo) y 256 como PNG.
function ico(icons) {
  const images = icons.map(({ size, rgba, png }) => ({
    size,
    data: png ? Buffer.from(png.split(',')[1], 'base64') : icoDib(rgba, size)
  }))
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16
    header[entry] = size >= 256 ? 0 : size
    header[entry + 1] = size >= 256 ? 0 : size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(data.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map(({ data }) => data)])
}

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    await win.loadURL('data:text/html;charset=utf-8,<!doctype html><html><body></body></html>')
    const result = await win.webContents.executeJavaScript(
      `(${draw.toString()})(${JSON.stringify(inputs())})`
    )
    writeFileSync(at('build', 'author-logo.ico'), ico(result.logos))
    writeFileSync(
      at('build', 'installer-header.bmp'),
      bmp24(result.header, HEADER.width, HEADER.height)
    )
    console.log('Generados: build/author-logo.ico, build/installer-header.bmp')
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
