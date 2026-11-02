import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '@shared/types'

const call = (name: string) => (...args: unknown[]) => ipcRenderer.invoke(name, ...args)

const api: Api = {
  listSets: call('listSets'),
  getSet: call('getSet'),
  createSet: call('createSet'),
  updateSet: call('updateSet'),
  deleteSet: call('deleteSet'),
  addCards: call('addCards'),
  updateCard: call('updateCard'),
  recordProgress: call('recordProgress'),
  resetProgress: call('resetProgress'),
  pickSpreadsheet: call('pickSpreadsheet'),
  readSpreadsheet: call('readSpreadsheet'),
  exportSet: call('exportSet'),
  exportTemplate: call('exportTemplate'),
  dataFile: call('dataFile'),
  onDataChanged(cb) {
    const listener = () => cb()
    ipcRenderer.on('data-changed', listener)
    return () => ipcRenderer.removeListener('data-changed', listener)
  }
} as Api

contextBridge.exposeInMainWorld('api', api)
