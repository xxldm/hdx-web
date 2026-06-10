import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { applyWebConfigToProcess } from './scripts/web-config-loader.mjs'

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))

process.chdir(rootDirectory)

applyWebConfigToProcess({
  rootDirectory,
  defaultConfigNames: ['config.yml'],
  nodeEnv: 'production',
  strictProductionSecret: true
})

await import(pathToFileURL(path.join(rootDirectory, 'server', 'index.mjs')).href)
