const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconSvg = `
<svg width="1024" height="1024" 
  viewBox="0 0 1024 1024" 
  xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" 
    fill="#1A73E8"/>
  <rect x="192" y="320" width="640" 
    height="448" rx="48" 
    stroke="white" stroke-width="40" 
    fill="none"/>
  <path d="M192 448 L512 576 L832 448" 
    stroke="white" stroke-width="40" 
    stroke-linecap="round"/>
  <path d="M512 320 L512 768" 
    stroke="white" stroke-width="40" 
    stroke-linecap="round" 
    opacity="0.5"/>
</svg>`;

const splashSvg = `
<svg width="1284" height="2778" 
  viewBox="0 0 1284 2778" 
  xmlns="http://www.w3.org/2000/svg">
  <rect width="1284" height="2778" 
    fill="#1A73E8"/>
  <rect x="542" y="1109" width="200" 
    height="140" rx="16" 
    stroke="white" stroke-width="10" 
    fill="none"/>
  <path d="M542 1149 L642 1189 L742 1149" 
    stroke="white" stroke-width="10" 
    stroke-linecap="round"/>
  <path d="M642 1109 L642 1249" 
    stroke="white" stroke-width="10" 
    stroke-linecap="round" 
    opacity="0.5"/>
  <text x="642" y="1340" 
    font-family="Arial, sans-serif" 
    font-size="80" 
    font-weight="700" 
    fill="white" 
    text-anchor="middle">SwiftDrop</text>
  <text x="642" y="1420" 
    font-family="Arial, sans-serif" 
    font-size="36" 
    fill="rgba(255,255,255,0.75)" 
    text-anchor="middle">
    Deliver Anything. Same Day.
  </text>
</svg>`;

async function generate() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  await sharp(Buffer.from(iconSvg))
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('icon.png generated');

  await sharp(Buffer.from(splashSvg))
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
  console.log('splash.png generated');
}

generate().catch(console.error);
