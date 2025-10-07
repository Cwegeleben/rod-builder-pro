#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const env = { ...process.env }

// place Sqlite3 database on volume
const source = path.resolve('/dev.sqlite')
const target = '/data/' + path.basename(source)
if (!fs.existsSync(source) && fs.existsSync('/data')) fs.symlinkSync(target, source)

if (process.env.SKIP_MIGRATE === '1') {
  console.warn('[startup] SKIP_MIGRATE=1 set, skipping prisma migrate deploy')
} else {
  // prepare database (allow soft failure unless STRICT_MIGRATIONS=1)
  try {
    await exec('npx prisma migrate deploy')
  } catch (err) {
    if (process.env.STRICT_MIGRATIONS === '1') {
      throw err
    }
    console.warn(
      '[startup] prisma migrate deploy failed but continuing (set STRICT_MIGRATIONS=1 to enforce). Error:',
      err?.message || err,
    )
  }
}

// launch application
await exec(process.argv.slice(2).join(' '))

function exec(command) {
  const child = spawn(command, { shell: true, stdio: 'inherit', env })
  return new Promise((resolve, reject) => {
    child.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} failed rc=${code}`))
      }
    })
  })
}
