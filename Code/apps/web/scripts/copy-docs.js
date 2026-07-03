/**
 * Copies the docs app build output into the web app's dist/docs/ folder
 * so the docs site is served under /docs/ as part of the main deployment.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const src = path.resolve(__dirname, '../../docs/dist')
const dest = path.resolve(__dirname, '../dist/docs')

if (!fs.existsSync(src)) {
  console.error('❌ Docs build output not found at', src)
  process.exit(1)
}

fs.cpSync(src, dest, { recursive: true })
console.log('✅ Docs copied to dist/docs/')
