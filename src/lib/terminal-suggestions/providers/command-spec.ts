import type { SuggestionProvider } from './base'
import type { SuggestionCandidate, SuggestionRequest } from '../types'

interface CommandSpecFlag {
  name: string
  description: string
}

interface CommandSpec {
  command: string
  description?: string
  subcommands?: Array<{ name: string; description?: string }>
  flags?: CommandSpecFlag[]
}

const COMMAND_SPECS: CommandSpec[] = [
  {
    command: 'ls',
    description: '列出目录内容',
    flags: [
      { name: '-a', description: '显示隐藏文件' },
      { name: '-l', description: '使用长列表格式' },
      { name: '-h', description: '配合 -l 显示易读文件大小' },
    ],
  },
  {
    command: 'll',
    description: 'ls -l 的别名，长格式列出目录内容',
  },
  {
    command: 'ln',
    description: '创建链接',
  },
  {
    command: 'lvm',
    description: '逻辑卷管理',
  },
  {
    command: 'less',
    description: '分页显示文件内容',
  },
  {
    command: 'lsof',
    description: '列出打开的文件',
  },
  {
    command: 'lsblk',
    description: '列出所有可用块设备的信息',
  },
  {
    command: 'lscpu',
    description: '显示 CPU 架构信息',
  },
  {
    command: 'locate',
    description: '快速查找文件',
  },
  {
    command: 'loginctl',
    description: '用户会话管理',
  },
  {
    command: 'grep',
    description: '文本匹配搜索',
    flags: [
      { name: '-i', description: '忽略大小写' },
      { name: '-n', description: '显示行号' },
      { name: '-r', description: '递归搜索目录' },
    ],
  },
  {
    command: 'find',
    description: '查找文件',
    flags: [
      { name: '-name', description: '按文件名匹配' },
      { name: '-type', description: '按类型过滤（f/d）' },
      { name: '-maxdepth', description: '限制递归深度' },
    ],
  },
  {
    command: 'tar',
    description: '打包与解包',
    flags: [
      { name: '-c', description: '创建归档' },
      { name: '-x', description: '解压归档' },
      { name: '-z', description: '使用 gzip' },
      { name: '-f', description: '指定归档文件名' },
    ],
  },
  {
    command: 'ssh',
    description: '远程连接',
    flags: [
      { name: '-p', description: '指定端口' },
      { name: '-i', description: '指定私钥文件' },
      { name: '-J', description: '指定跳板机' },
    ],
  },
  {
    command: 'git',
    description: 'Git 版本管理',
    subcommands: [
      { name: 'checkout', description: '切换分支或恢复文件' },
      { name: 'cherry-pick', description: '挑选提交应用到当前分支' },
      { name: 'commit', description: '提交改动' },
      { name: 'status', description: '查看工作区状态' },
      { name: 'pull', description: '拉取并合并远端改动' },
      { name: 'push', description: '推送本地提交' },
    ],
    flags: [
      { name: '--amend', description: '修改最近一次提交' },
      { name: '--no-verify', description: '跳过提交钩子' },
    ],
  },
  {
    command: 'docker',
    description: '容器运行时',
    subcommands: [
      { name: 'compose', description: 'Compose 子命令入口' },
      { name: 'ps', description: '查看容器列表' },
      { name: 'logs', description: '查看日志' },
      { name: 'exec', description: '进入容器执行命令' },
    ],
  },
  {
    command: 'docker compose',
    description: 'Compose 编排',
    subcommands: [
      { name: 'up', description: '创建并启动服务' },
      { name: 'down', description: '停止并移除资源' },
      { name: 'pull', description: '拉取服务镜像' },
      { name: 'logs', description: '查看服务日志' },
      { name: 'ps', description: '查看服务状态' },
    ],
    flags: [
      { name: '-d', description: '后台启动（常用于 up）' },
      { name: '--build', description: '启动前先构建镜像' },
      { name: '--no-deps', description: '不启动依赖服务' },
    ],
  },
]

function startsWithToken(value: string, token: string): boolean {
  if (!token) return true
  return value.toLowerCase().startsWith(token.toLowerCase())
}

function splitInput(input: string): string[] {
  return input.trimStart().split(/\s+/).filter(Boolean)
}

function buildCommandCandidate(spec: CommandSpec, request: SuggestionRequest): SuggestionCandidate {
  return {
    id: `command:${spec.command}`,
    text: spec.command,
    displayText: spec.command,
    kind: 'command',
    source: 'command-spec',
    score: 0,
    insertMode: 'replace-token',
    match: {
      from: 0,
      to: request.context.input.length,
    },
    description: spec.description,
    meta: { command: spec.command },
  }
}

function buildSubcommandCandidate(
  command: string,
  subcommand: { name: string; description?: string },
  request: SuggestionRequest,
): SuggestionCandidate {
  return {
    id: `subcommand:${command}:${subcommand.name}`,
    text: `${command} ${subcommand.name}`,
    displayText: subcommand.name,
    kind: 'subcommand',
    source: 'command-spec',
    score: 0,
    insertMode: 'replace-line',
    match: {
      from: 0,
      to: request.context.input.length,
    },
    description: subcommand.description,
    meta: { command },
  }
}

function buildFlagCandidate(command: string, flag: CommandSpecFlag, request: SuggestionRequest): SuggestionCandidate {
  const base = request.context.input.trimEnd()
  const text = base.endsWith('-') || base.endsWith('--') ? `${base}${flag.name.replace(/^-+/, '')}` : `${command} ${flag.name}`
  return {
    id: `flag:${command}:${flag.name}`,
    text,
    displayText: flag.name,
    kind: 'flag',
    source: 'command-spec',
    score: 0,
    insertMode: 'replace-line',
    match: {
      from: 0,
      to: request.context.input.length,
    },
    description: flag.description,
    meta: { command },
  }
}

function provideRootCommandSuggestions(request: SuggestionRequest): SuggestionCandidate[] {
  const token = splitInput(request.context.input)[0] ?? ''
  return COMMAND_SPECS
    .filter((spec) => !spec.command.includes(' '))
    .filter((spec) => startsWithToken(spec.command, token))
    .map((spec) => buildCommandCandidate(spec, request))
}

function provideSubcommandSuggestions(spec: CommandSpec, request: SuggestionRequest): SuggestionCandidate[] {
  const inputTokens = splitInput(request.context.input)
  const subToken = inputTokens[1] ?? ''
  return (spec.subcommands ?? [])
    .filter((subcommand) => startsWithToken(subcommand.name, subToken))
    .map((subcommand) => buildSubcommandCandidate(spec.command, subcommand, request))
}

function provideFlagSuggestions(spec: CommandSpec, request: SuggestionRequest): SuggestionCandidate[] {
  const token = splitInput(request.context.input).at(-1) ?? ''
  const filterToken = token.startsWith('-') ? token : ''
  return (spec.flags ?? [])
    .filter((flag) => startsWithToken(flag.name, filterToken))
    .map((flag) => buildFlagCandidate(spec.command, flag, request))
}

export function createCommandSpecSuggestionProvider(): SuggestionProvider {
  return {
    source: 'command-spec',
    provideSuggestions(request) {
      const input = request.context.input.trim()
      if (!input) return []

      const suggestions: SuggestionCandidate[] = []
      const dockerComposeSpec = COMMAND_SPECS.find((item) => item.command === 'docker compose')
      if (dockerComposeSpec && (input === 'docker compose' || input.startsWith('docker compose '))) {
        suggestions.push(...provideSubcommandSuggestions(dockerComposeSpec, request))
        suggestions.push(...provideFlagSuggestions(dockerComposeSpec, request))
        return suggestions
      }

      const commandToken = splitInput(input)[0] ?? ''
      const commandSpec = COMMAND_SPECS.find((item) => item.command === commandToken)

      if (!commandSpec) {
        return provideRootCommandSuggestions(request)
      }

      suggestions.push(...provideSubcommandSuggestions(commandSpec, request))
      suggestions.push(...provideFlagSuggestions(commandSpec, request))
      if (suggestions.length === 0) {
        suggestions.push(buildCommandCandidate(commandSpec, request))
      }
      return suggestions
    },
  }
}
