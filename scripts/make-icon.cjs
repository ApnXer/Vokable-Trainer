// Renders the app icon (build/icon.png, 512×512) with Electron: npm run icon
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

// Same mark as the in-app logo (two offset flashcards with a check), in the default mint accent
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#3eb489"/>
  <rect x="4" y="8.5" width="17" height="13.5" rx="3" fill="#fff" opacity="0.45" transform="rotate(-8 12.5 15)"/>
  <rect x="9" y="10" width="18" height="13.5" rx="3" fill="#fff"/>
  <path d="M14 16.9l2.6 2.6 4.9-5.2" fill="none" stroke="#1f7a5a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, useContentSize: true })
  await win.loadURL('data:text/html,' + encodeURIComponent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`))
  await new Promise((r) => setTimeout(r, 300))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  const out = path.join(__dirname, '..', 'build', 'icon.png')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, img.resize({ width: 512, height: 512 }).toPNG())
  console.log('written:', out)
  app.quit()
})
