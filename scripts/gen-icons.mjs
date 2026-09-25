// Generate MapLab Studio PWA icons (192/512/maskable) from the SVG source.
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

const svg = readFileSync('./public/icon.svg')

// Standard icons (the SVG already has a circle clip so they work at any size).
await sharp(svg).resize(192, 192).png().toFile('./public/icon-192.png')
await sharp(svg).resize(512, 512).png().toFile('./public/icon-512.png')

// Maskable variant: pad with the dark background so the safe area is intact.
// Maskable icons should have ~10% safe area padding around the central mark.
const inner = svg.toString('utf-8')
  .replace(/<\?xml[^>]*\?>\s*/g, '')
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0f172a"/>
  <g transform="translate(72 72) scale(0.72)">
    ${inner}
  </g>
</svg>`
writeFileSync('./public/icon-maskable-source.svg', maskableSvg)
await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile('./public/icon-maskable-512.png')

console.log('Icons generated: icon-192.png, icon-512.png, icon-maskable-512.png')
