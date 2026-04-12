const fs = require('fs')
const path = require('path')

const SHM_DIR = '/dev/shm/ecom-cache'

try { fs.mkdirSync(SHM_DIR, { recursive: true }) } catch {}

const shmGet = (key) => {
  try {
    const file = path.join(SHM_DIR, key.replace(/[:/]/g, '_'))
    const raw = fs.readFileSync(file, 'utf8')
    const { data, expiresAt } = JSON.parse(raw)
    if (Date.now() > expiresAt) { fs.unlinkSync(file); return null }
    return data
  } catch { return null }
}

const shmSet = (key, data, ttlSeconds) => {
  try {
    const file = path.join(SHM_DIR, key.replace(/[:/]/g, '_'))
    fs.writeFileSync(file, JSON.stringify({ data, expiresAt: Date.now() + ttlSeconds * 1000 }))
  } catch {}
}

const shmDel = (key) => {
  try {
    const file = path.join(SHM_DIR, key.replace(/[:/]/g, '_'))
    fs.unlinkSync(file)
  } catch {}
}

const shmDelAll = () => {
  try {
    fs.readdirSync(SHM_DIR).forEach(f => fs.unlinkSync(path.join(SHM_DIR, f)))
  } catch {}
}

module.exports = { shmGet, shmSet, shmDel, shmDelAll }
