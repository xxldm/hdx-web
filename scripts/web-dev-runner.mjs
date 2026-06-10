import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadWebConfig } from './web-config-loader.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(scriptDirectory, '..')
const command = process.argv[2]
const args = process.argv.slice(3)
const supportedCommands = new Set(['dev', 'build', 'preview'])

if (!supportedCommands.has(command)) {
  console.error('Web 命令无效。支持：dev、build、preview。')
  process.exit(1)
}

const nodeEnv = command === 'dev' ? 'development' : 'production'
const { env, configPath, configExists } = loadWebConfig({
  rootDirectory,
  defaultConfigNames: ['config.local.yml', 'config.yml'],
  nodeEnv,
  strictProductionSecret: false
})

if (configExists) {
  console.log(`Web 配置：${configPath}`)
} else {
  console.log('Web 配置：未找到 config.local.yml 或 config.yml，使用环境变量和默认值。')
}

const nuxtExecutable = path.join(
  rootDirectory,
  'node_modules',
  'nuxt',
  'bin',
  'nuxt.mjs'
)
const nuxtPackageRoot = fs.realpathSync(path.join(rootDirectory, 'node_modules', 'nuxt'))
const nodePathEntries = [
  path.join(nuxtPackageRoot, 'bin', 'node_modules'),
  path.join(nuxtPackageRoot, 'node_modules'),
  path.dirname(nuxtPackageRoot),
  path.join(rootDirectory, 'node_modules', '.pnpm', 'node_modules')
]
const runnerEnv = {
  ...env,
  NODE_PATH: [
    ...nodePathEntries,
    env.NODE_PATH
  ].filter(Boolean).join(path.delimiter)
}

const child = spawn(process.execPath, [nuxtExecutable, command, ...args], {
  cwd: rootDirectory,
  env: runnerEnv,
  stdio: 'inherit'
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Web 命令被信号中断：${signal}`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})
