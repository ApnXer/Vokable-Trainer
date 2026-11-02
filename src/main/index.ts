import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import * as store from '@shared/store'
import * as excel from '@shared/excel'
import type { CardInput, ExportFormat, ProgressResult, SetInput } from '@shared/types'

app.setName('Vokabeltrainer')
let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    title: 'Vocab Trainer',
    backgroundColor: '#f6f7fb',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  win.setMenuBarVisibility(false)
  // Externe Links im Standardbrowser öffnen, nie im App-Fenster
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:') && !url.startsWith(process.env.ELECTRON_RENDERER_URL ?? '\0')) e.preventDefault()
  })
  // Rauchtest: VT_CAPTURE=<datei.png> speichert ein Bildschirmfoto und beendet die App
  const capture = process.env.VT_CAPTURE
  if (capture) {
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      fs.writeFileSync(capture, (await win!.webContents.capturePage()).toPNG())
      app.quit()
    }, 2500))
  }
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

/* Änderungen von außen (z. B. MCP-Server) an die Oberfläche melden */
let ownWrite = 0
function watchData(): void {
  const dir = path.dirname(store.DATA_FILE)
  fs.mkdirSync(dir, { recursive: true })
  let timer: NodeJS.Timeout | undefined
  fs.watch(dir, (_ev, file) => {
    if (file !== path.basename(store.DATA_FILE)) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (Date.now() - ownWrite < 800) return
      win?.webContents.send('data-changed')
    }, 250)
  })
}

/** Registriert einen IPC-Handler; schreibende Aufrufe markieren sich, damit der Watcher sie ignoriert. */
function handle<A extends unknown[], R>(name: string, fn: (...args: A) => R, writes = false): void {
  ipcMain.handle(name, (_e, ...args) => {
    if (writes) ownWrite = Date.now()
    return fn(...(args as A))
  })
}

async function saveFile(defaultName: string, data: Buffer | string, filters: Electron.FileFilter[]): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters
  })
  if (canceled || !filePath) return null
  fs.writeFileSync(filePath, data)
  return filePath
}

const FILTERS: Record<ExportFormat, Electron.FileFilter> = {
  xlsx: { name: 'Excel', extensions: ['xlsx'] },
  csv: { name: 'CSV', extensions: ['csv'] },
  txt: { name: 'Text', extensions: ['txt'] },
  json: { name: 'JSON', extensions: ['json'] }
}

function registerIpc(): void {
  handle('listSets', () => store.listSets())
  handle('getSet', (id: string) => store.getSet(id))
  handle('createSet', (data: SetInput) => store.createSet(data), true)
  handle('updateSet', (id: string, data: SetInput) => store.updateSet(id, data), true)
  handle('deleteSet', (id: string) => store.deleteSet(id), true)
  handle('addCards', (id: string, cards: CardInput[]) => store.addCards(id, cards)?.added ?? 0, true)
  handle('updateCard', (id: string, cardId: string, patch: Partial<CardInput>) => store.updateCard(id, cardId, patch), true)
  handle('recordProgress', (id: string, results: ProgressResult[], test?: { score: number; total: number }) => {
    store.recordProgress(id, results, test)
  }, true)
  handle('resetProgress', (id: string) => { store.resetProgress(id) }, true)
  handle('dataFile', () => store.DATA_FILE)
  handle('readSpreadsheet', (name: string, data: ArrayBuffer) => excel.readSpreadsheet(name, Buffer.from(data)))
  handle('pickSpreadsheet', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'xlsm', 'ods', 'csv', 'tsv', 'txt'] }]
    })
    if (canceled || !filePaths[0]) return null
    const name = path.basename(filePaths[0])
    return { name, sheets: excel.readSpreadsheet(name, fs.readFileSync(filePaths[0])) }
  })
  handle('exportSet', async (id: string, format: ExportFormat) => {
    const s = store.getSet(id)
    if (!s) return null
    const base = s.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'study-set'
    const data =
      format === 'xlsx' ? excel.setToXlsx(s) : format === 'csv' ? excel.setToCsv(s) : format === 'txt' ? excel.setToTxt(s) : JSON.stringify(s, null, 2)
    return saveFile(`${base}.${format}`, data, [FILTERS[format]])
  })
  handle('exportTemplate', () => saveFile('vocabulary-template.xlsx', excel.templateXlsx(), [FILTERS.xlsx]))
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
  })
  app.whenReady().then(() => {
    registerIpc()
    createWindow()
    watchData()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
