// Renders public/icon.svg into the PNGs the PWA manifest and Android launcher need.
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icon.svg')
const bg = '#1b1713'
await sharp(svg).resize(192).png().toFile('public/icon-192.png')
await sharp(svg).resize(512).png().toFile('public/icon-512.png')
// Maskable: full-bleed background with the glyph inside the safe zone.
const inner = await sharp(svg).resize(360).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: bg } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile('public/icon-maskable-512.png')
// Source images for `npx @capacitor/assets generate`.
await sharp(svg).resize(1024).png().toFile('assets/icon-only.png')
const fg = await sharp(svg).resize(600).png().toBuffer()
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fg, gravity: 'center' }])
  .png()
  .toFile('assets/icon-foreground.png')
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: bg } }).png().toFile('assets/icon-background.png')
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#100d0a' } })
  .composite([{ input: await sharp(svg).resize(600).png().toBuffer(), gravity: 'center' }])
  .png()
  .toFile('assets/splash.png')
await sharp('assets/splash.png').toFile('assets/splash-dark.png')
console.log('icons written')
