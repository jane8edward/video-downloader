import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const rootDir = process.cwd()
const distDir = path.join(rootDir, 'dist')
const serverDir = path.join(distDir, 'server')
const indexPath = path.join(distDir, 'index.html')

const findServerEntry = () => {
  const files = fs.readdirSync(serverDir)
  return files.find(
    (file) => file.startsWith('entry-server') && (file.endsWith('.js') || file.endsWith('.mjs'))
  )
}

const template = fs.readFileSync(indexPath, 'utf8')
const serverEntry = findServerEntry()

if (!serverEntry) {
  throw new Error('Cannot find the SSR entry in dist/server.')
}

const { render } = await import(pathToFileURL(path.join(serverDir, serverEntry)).href)
const appHtml = render()
const html = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)

fs.writeFileSync(indexPath, html)
fs.rmSync(serverDir, { recursive: true, force: true })
