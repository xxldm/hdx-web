import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(scriptDirectory, '..')
const outputDirectory = path.join(rootDirectory, '.output-desktop-static')
const defaultOutDirectory = path.join(rootDirectory, 'dist', 'desktop-static')

function parseArguments(argv) {
  const options = {
    outDir: defaultOutDirectory
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--out-dir') {
      if (!argv[index + 1]) {
        throw new Error('--out-dir 必须提供目录。')
      }
      options.outDir = path.resolve(rootDirectory, argv[index + 1])
      index += 1
    } else {
      throw new Error(`未知参数：${arg}`)
    }
  }

  assertInsideRoot(options.outDir)
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

function copyDirectoryContents(sourceDirectory, targetDirectory) {
  fs.mkdirSync(targetDirectory, { recursive: true })

  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name)
    const targetPath = path.join(targetDirectory, entry.name)

    if (entry.isSymbolicLink()) {
      throw new Error(`Desktop 静态输出不允许包含链接项：${sourcePath}`)
    }

    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath)
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath)
    } else {
      throw new Error(`Desktop 静态输出包含不支持的文件类型：${sourcePath}`)
    }
  }
}

function runNuxtGenerate() {
  removeDirectory(outputDirectory)

  const nuxtExecutable = path.join(rootDirectory, 'node_modules', 'nuxt', 'bin', 'nuxt.mjs')
  const nuxtPackageRoot = fs.realpathSync(path.join(rootDirectory, 'node_modules', 'nuxt'))
  const nodePathEntries = [
    path.join(nuxtPackageRoot, 'bin', 'node_modules'),
    path.join(nuxtPackageRoot, 'node_modules'),
    path.dirname(nuxtPackageRoot),
    path.join(rootDirectory, 'node_modules', '.pnpm', 'node_modules')
  ]
  const result = spawnSync(process.execPath, [nuxtExecutable, 'generate'], {
    cwd: rootDirectory,
    env: {
      ...process.env,
      HDX_WEB_BUILD_TARGET: 'desktop-static',
      NODE_PATH: [
        ...nodePathEntries,
        process.env.NODE_PATH
      ].filter(Boolean).join(path.delimiter)
    },
    stdio: 'inherit',
    windowsHide: true
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`Nuxt desktop-static generate 失败，退出码 ${result.status}`)
  }
}

function copyStaticOutput(outDir) {
  const publicDirectory = path.join(outputDirectory, 'public')

  if (!fs.existsSync(path.join(publicDirectory, 'index.html'))) {
    throw new Error(`Desktop 静态输出缺少 index.html：${publicDirectory}`)
  }

  removeDirectory(outDir)
  copyDirectoryContents(publicDirectory, outDir)

  const publicMaps = listFiles(outDir).filter((file) => file.endsWith('.map'))

  if (publicMaps.length > 0) {
    throw new Error(`Desktop 静态输出不允许包含 sourcemap：${publicMaps.join(', ')}`)
  }
}

try {
  const options = parseArguments(process.argv.slice(2))
  runNuxtGenerate()
  copyStaticOutput(options.outDir)
  console.log(`Desktop 静态 Web 资源已生成：${options.outDir}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
