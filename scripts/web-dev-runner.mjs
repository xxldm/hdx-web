import path from 'node:path'
import fs from 'node:fs'
import net from 'node:net'
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

if (command === 'dev') {
  await assertDevPortAvailable({
    args,
    env: runnerEnv
  })
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

async function assertDevPortAvailable({ args, env }) {
  const port = resolveDevPort(args, env)

  if (port === null || port === 0) {
    return
  }

  const host = resolveDevHost(args, env)
  const availabilityChecks = getPortAvailabilityChecks(host)
  const availabilityResults = await Promise.all(availabilityChecks.map(candidateHost => testPortAvailable(port, candidateHost)))
  const available = availabilityResults.every(Boolean)

  if (available) {
    return
  }

  console.error(`Web dev 端口已被占用：${host ?? 'localhost'}:${port}。`)
  console.error('已停止启动，避免 Nuxt 自动切换到 3001 等其他端口。')
  console.error('如果只是想复用已有服务，请运行根仓库脚本：pwsh -NoLogo -NoProfile -File scripts/start-web-dev.ps1 -StatusOnly')
  process.exit(1)
}

function resolveDevPort(args, env) {
  const portValue = getArgValue(args, ['--port', '-p'])
    ?? env.NUXT_PORT
    ?? env.NITRO_PORT
    ?? env.PORT
    ?? '3000'
  const port = Number(portValue)

  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : null
}

function resolveDevHost(args, env) {
  const hostValue = getArgValue(args, ['--host', '-h'])
    ?? env.NUXT_HOST
    ?? env.NITRO_HOST
    ?? env.HOST

  if (hostValue === true || hostValue === '') {
    return undefined
  }

  return hostValue || 'localhost'
}

function getArgValue(args, names) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    for (const name of names) {
      if (arg === name) {
        const next = args[index + 1]

        if (!next || next.startsWith('-')) {
          return true
        }

        return next
      }

      if (arg.startsWith(`${name}=`)) {
        return arg.slice(name.length + 1)
      }
    }
  }

  return undefined
}

function testPortAvailable(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}

function getPortAvailabilityChecks(host) {
  if (!host || host === 'localhost') {
    return ['localhost', '127.0.0.1', '::1']
  }

  return [host]
}
