import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { create as createTar } from 'tar'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(scriptDirectory, '..')
const outputDirectory = path.join(rootDirectory, '.output')
const distDirectory = path.join(rootDirectory, 'dist')
const packageWorkDirectory = path.join(distDirectory, 'web-node-server-package')

function parseArguments(argv) {
  const options = {
    build: true,
    outDir: distDirectory,
    version: 'dev'
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--skip-build') {
      options.build = false
    } else if (arg === '--version') {
      options.version = argv[index + 1]
      index += 1
    } else if (arg === '--out-dir') {
      options.outDir = path.resolve(rootDirectory, argv[index + 1])
      index += 1
    } else {
      throw new Error(`未知参数：${arg}`)
    }
  }

  if (!options.version || !/^[0-9A-Za-z._+-]+$/.test(options.version)) {
    throw new Error('版本号只能包含字母、数字、点、下划线、加号和短横线。')
  }

  return options
}

function assertInsideRoot(targetPath) {
  const relative = path.relative(rootDirectory, path.resolve(targetPath))

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`路径超出 Web 工作目录：${targetPath}`)
  }
}

function removeDirectory(targetPath) {
  assertInsideRoot(targetPath)
  fs.rmSync(targetPath, { force: true, recursive: true })
}

function copyPath(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`缺少打包输入：${source}`)
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true })

  fs.cpSync(source, destination, {
    dereference: true,
    errorOnExist: false,
    force: true,
    preserveTimestamps: false,
    recursive: true
  })
}

function listFiles(directory) {
  const result = []

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        result.push(fullPath)
      }
    }
  }

  if (fs.existsSync(directory)) {
    walk(directory)
  }

  return result
}

function listReparsePoints(directory) {
  const result = []

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      const stat = fs.lstatSync(fullPath)

      if (stat.isSymbolicLink()) {
        result.push(fullPath)
        continue
      }

      if (entry.isDirectory()) {
        walk(fullPath)
      }
    }
  }

  walk(directory)
  return result
}

function formatRelative(filePath, baseDirectory = packageWorkDirectory) {
  return path.relative(baseDirectory, filePath).replaceAll(path.sep, '/')
}

function assertRequiredPackageLayout() {
  const requiredPaths = [
    'public',
    'server',
    'server/index.mjs',
    'nitro.json',
    'start.sh',
    'start-web.mjs',
    'config.example.yml',
    'scripts/web-config-loader.mjs',
    'node_modules/yaml/package.json'
  ]

  for (const relativePath of requiredPaths) {
    const target = path.join(packageWorkDirectory, relativePath)

    if (!fs.existsSync(target)) {
      throw new Error(`发布包缺少必要文件：${relativePath}`)
    }
  }

  const publicMaps = listFiles(path.join(packageWorkDirectory, 'public'))
    .filter((file) => file.endsWith('.map'))

  if (publicMaps.length > 0) {
    throw new Error(`public/ 不允许包含 sourcemap：${publicMaps.map((file) => formatRelative(file)).join(', ')}`)
  }

  const forbiddenFiles = listFiles(packageWorkDirectory).filter((file) => {
    const relativePath = formatRelative(file)
    const name = path.basename(file)

    return (
      relativePath.startsWith('.output/') ||
      relativePath.startsWith('.nuxt/') ||
      relativePath.startsWith('node_modules/.cache/') ||
      name === '.env' ||
      name.startsWith('.env.')
    )
  })

  if (forbiddenFiles.length > 0) {
    throw new Error(`发布包包含禁止文件：${forbiddenFiles.map((file) => formatRelative(file)).join(', ')}`)
  }

  const reparsePoints = listReparsePoints(packageWorkDirectory)

  if (reparsePoints.length > 0) {
    throw new Error(`发布包不允许包含符号链接或 Junction：${reparsePoints.map((file) => formatRelative(file)).join(', ')}`)
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDirectory,
    env: process.env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    windowsHide: true
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 执行失败，退出码 ${result.status}`)
  }

  return result
}

function buildPackageTree() {
  removeDirectory(packageWorkDirectory)
  fs.mkdirSync(packageWorkDirectory, { recursive: true })

  copyPath(path.join(outputDirectory, 'public'), path.join(packageWorkDirectory, 'public'))
  copyPath(path.join(outputDirectory, 'server'), path.join(packageWorkDirectory, 'server'))
  copyPath(path.join(outputDirectory, 'nitro.json'), path.join(packageWorkDirectory, 'nitro.json'))
  copyPath(path.join(rootDirectory, 'start.sh'), path.join(packageWorkDirectory, 'start.sh'))
  copyPath(path.join(rootDirectory, 'start-web.mjs'), path.join(packageWorkDirectory, 'start-web.mjs'))
  copyPath(path.join(rootDirectory, 'config.example.yml'), path.join(packageWorkDirectory, 'config.example.yml'))
  copyPath(path.join(scriptDirectory, 'web-config-loader.mjs'), path.join(packageWorkDirectory, 'scripts', 'web-config-loader.mjs'))
  copyPath(path.join(rootDirectory, 'node_modules', 'yaml'), path.join(packageWorkDirectory, 'node_modules', 'yaml'))

  fs.chmodSync(path.join(packageWorkDirectory, 'start.sh'), 0o755)
}

async function createArchive({ archivePath }) {
  removeDirectory(archivePath)
  fs.mkdirSync(path.dirname(archivePath), { recursive: true })

  const entries = fs.readdirSync(packageWorkDirectory)

  await createTar({
    cwd: packageWorkDirectory,
    file: archivePath,
    gzip: true,
    mtime: new Date('2026-01-01T00:00:00.000Z'),
    portable: true,
    filter(entryPath, stat) {
      const normalizedPath = entryPath.replaceAll('\\', '/').replace(/^\.\//, '')
      const permissions = stat.isDirectory()
        ? 0o755
        : normalizedPath === 'start.sh'
          ? 0o755
          : 0o644

      stat.mode = (stat.mode & ~0o777) | permissions

      return true
    }
  }, entries)
}

const options = parseArguments(process.argv.slice(2))
const archiveName = `hdx-web-node-server-${options.version}.tar.gz`
const archivePath = path.join(options.outDir, archiveName)

if (options.build) {
  run(process.execPath, [path.join(scriptDirectory, 'web-dev-runner.mjs'), 'build'])
}

if (!fs.existsSync(path.join(outputDirectory, 'server', 'index.mjs'))) {
  throw new Error('缺少 .output/server/index.mjs；请先运行 Web build。')
}

buildPackageTree()
assertRequiredPackageLayout()
await createArchive({ archivePath })

const serverMapCount = listFiles(path.join(packageWorkDirectory, 'server'))
  .filter((file) => file.endsWith('.map')).length

console.log(JSON.stringify({
  archive: archivePath,
  name: archiveName,
  publicMapCount: 0,
  serverMapCount
}, null, 2))
