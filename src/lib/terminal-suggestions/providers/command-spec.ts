import type { SuggestionProvider } from './base'
import type { SuggestionCandidate, SuggestionRequest } from '../types'

type CommandCategory =
  | 'filesystem'
  | 'text'
  | 'process'
  | 'system'
  | 'network'
  | 'vcs'
  | 'container'
  | 'package'

interface CommandSpecFlag {
  name: string
  description: string
}

interface CommandSubcommand {
  name: string
  description?: string
}

interface CommandSpec {
  command: string
  category: CommandCategory
  description?: string
  subcommands?: CommandSubcommand[]
  flags?: CommandSpecFlag[]
}

const COMMAND_SPECS: CommandSpec[] = [
  // 文件与目录
  { command: 'pwd', category: 'filesystem', description: '显示当前工作目录' },
  { command: 'ls', category: 'filesystem', description: '列出目录内容', flags: [{ name: '-a', description: '显示隐藏文件' }, { name: '-l', description: '使用长列表格式' }, { name: '-h', description: '配合 -l 显示易读文件大小' }] },
  { command: 'll', category: 'filesystem', description: 'ls -l 的别名，长格式列出目录内容' },
  { command: 'tree', category: 'filesystem', description: '树形显示目录结构', flags: [{ name: '-L', description: '限制目录层级深度' }, { name: '-a', description: '显示隐藏文件' }] },
  { command: 'cd', category: 'filesystem', description: '切换当前目录' },
  { command: 'mkdir', category: 'filesystem', description: '创建目录', flags: [{ name: '-p', description: '递归创建父目录' }] },
  { command: 'touch', category: 'filesystem', description: '创建文件或更新时间戳' },
  { command: 'cp', category: 'filesystem', description: '复制文件或目录', flags: [{ name: '-r', description: '递归复制目录' }, { name: '-a', description: '保留属性归档复制' }] },
  { command: 'mv', category: 'filesystem', description: '移动或重命名文件' },
  { command: 'rm', category: 'filesystem', description: '删除文件或目录', flags: [{ name: '-r', description: '递归删除目录' }, { name: '-f', description: '强制删除，不提示' }] },
  { command: 'ln', category: 'filesystem', description: '创建硬链接或符号链接', flags: [{ name: '-s', description: '创建符号链接' }] },
  { command: 'chmod', category: 'filesystem', description: '修改文件权限' },
  { command: 'chown', category: 'filesystem', description: '修改文件属主与属组', flags: [{ name: '-R', description: '递归应用到子目录' }] },
  { command: 'du', category: 'filesystem', description: '统计目录或文件占用空间', flags: [{ name: '-h', description: '显示易读大小' }, { name: '-s', description: '仅显示汇总' }] },
  { command: 'df', category: 'filesystem', description: '查看磁盘分区使用情况', flags: [{ name: '-h', description: '显示易读大小' }] },
  { command: 'find', category: 'filesystem', description: '查找文件', flags: [{ name: '-name', description: '按文件名匹配' }, { name: '-type', description: '按类型过滤（f/d）' }, { name: '-maxdepth', description: '限制递归深度' }] },
  { command: 'locate', category: 'filesystem', description: '基于索引快速查找文件' },
  { command: 'lsblk', category: 'filesystem', description: '列出块设备信息' },
  { command: 'lvm', category: 'filesystem', description: '逻辑卷管理工具集' },

  // 文本与内容处理
  { command: 'cat', category: 'text', description: '输出文件内容' },
  { command: 'less', category: 'text', description: '分页查看文件内容' },
  { command: 'head', category: 'text', description: '查看文件头部内容', flags: [{ name: '-n', description: '指定显示行数' }] },
  { command: 'tail', category: 'text', description: '查看文件尾部内容', flags: [{ name: '-n', description: '指定显示行数' }, { name: '-f', description: '持续跟踪文件追加输出' }] },
  { command: 'grep', category: 'text', description: '文本匹配搜索', flags: [{ name: '-i', description: '忽略大小写' }, { name: '-n', description: '显示行号' }, { name: '-r', description: '递归搜索目录' }] },
  { command: 'sed', category: 'text', description: '流式文本编辑' },
  { command: 'awk', category: 'text', description: '按字段处理文本' },
  { command: 'sort', category: 'text', description: '排序文本行', flags: [{ name: '-r', description: '倒序排序' }, { name: '-n', description: '按数字排序' }] },
  { command: 'uniq', category: 'text', description: '去重相邻重复行', flags: [{ name: '-c', description: '统计重复次数' }] },
  { command: 'cut', category: 'text', description: '按列截取文本' },
  { command: 'tr', category: 'text', description: '字符替换与删除' },
  { command: 'wc', category: 'text', description: '统计行数、单词数和字节数' },
  { command: 'tar', category: 'text', description: '打包与解包', flags: [{ name: '-c', description: '创建归档' }, { name: '-x', description: '解压归档' }, { name: '-z', description: '使用 gzip 压缩' }, { name: '-f', description: '指定归档文件名' }] },
  { command: 'zip', category: 'text', description: '创建 zip 压缩包' },
  { command: 'unzip', category: 'text', description: '解压 zip 压缩包' },

  // 进程与系统
  { command: 'ps', category: 'process', description: '查看进程列表', flags: [{ name: '-ef', description: '完整格式显示所有进程' }, { name: 'aux', description: 'BSD 风格显示所有进程' }] },
  { command: 'top', category: 'process', description: '实时查看系统进程' },
  { command: 'htop', category: 'process', description: '交互式进程查看器' },
  { command: 'kill', category: 'process', description: '向进程发送信号', flags: [{ name: '-9', description: '强制终止进程' }] },
  { command: 'killall', category: 'process', description: '按进程名终止进程' },
  { command: 'lsof', category: 'process', description: '列出打开的文件与端口占用' },
  { command: 'free', category: 'system', description: '查看内存使用情况', flags: [{ name: '-h', description: '显示易读大小' }] },
  { command: 'uptime', category: 'system', description: '查看系统运行时长和负载' },
  { command: 'uname', category: 'system', description: '显示系统内核和架构信息', flags: [{ name: '-a', description: '显示完整系统信息' }] },
  { command: 'whoami', category: 'system', description: '显示当前用户名' },
  { command: 'id', category: 'system', description: '显示用户 UID/GID 信息' },
  { command: 'systemctl', category: 'system', description: '管理 systemd 服务', subcommands: [{ name: 'status', description: '查看服务状态' }, { name: 'start', description: '启动服务' }, { name: 'stop', description: '停止服务' }, { name: 'restart', description: '重启服务' }, { name: 'enable', description: '设置开机自启' }, { name: 'disable', description: '取消开机自启' }] },
  { command: 'journalctl', category: 'system', description: '查看 systemd 日志', flags: [{ name: '-u', description: '按服务过滤日志' }, { name: '-f', description: '实时跟踪日志' }, { name: '-xe', description: '显示详细错误上下文' }] },
  { command: 'loginctl', category: 'system', description: '管理用户会话' },

  // 网络
  { command: 'ssh', category: 'network', description: '远程连接', flags: [{ name: '-p', description: '指定端口' }, { name: '-i', description: '指定私钥文件' }, { name: '-J', description: '指定跳板机' }] },
  { command: 'scp', category: 'network', description: '通过 SSH 复制文件', flags: [{ name: '-P', description: '指定远端端口' }, { name: '-r', description: '递归复制目录' }] },
  { command: 'rsync', category: 'network', description: '高效同步文件/目录', flags: [{ name: '-a', description: '归档模式，保留属性' }, { name: '-v', description: '显示详细输出' }, { name: '--delete', description: '删除目标中多余文件' }] },
  { command: 'curl', category: 'network', description: '发送 HTTP/HTTPS 请求', flags: [{ name: '-I', description: '仅显示响应头' }, { name: '-L', description: '跟随重定向' }, { name: '-H', description: '添加请求头' }, { name: '-X', description: '指定请求方法' }, { name: '-d', description: '发送请求体数据' }] },
  { command: 'wget', category: 'network', description: '下载文件', flags: [{ name: '-O', description: '指定输出文件名' }, { name: '-c', description: '断点续传' }] },
  { command: 'ping', category: 'network', description: '测试网络连通性', flags: [{ name: '-c', description: '指定探测次数' }] },
  { command: 'ip', category: 'network', description: '网络接口与路由管理', subcommands: [{ name: 'addr', description: '查看或管理地址' }, { name: 'link', description: '查看或管理网卡' }, { name: 'route', description: '查看或管理路由' }] },
  { command: 'ss', category: 'network', description: '查看 socket/端口连接', flags: [{ name: '-tulpen', description: '常用 TCP/UDP 监听与进程信息' }, { name: '-s', description: '显示汇总统计' }] },

  // 开发工具
  {
    command: 'git',
    category: 'vcs',
    description: 'Git 版本管理',
    subcommands: [
      { name: 'status', description: '查看工作区状态' },
      { name: 'add', description: '添加文件到暂存区' },
      { name: 'commit', description: '提交改动' },
      { name: 'switch', description: '切换分支' },
      { name: 'checkout', description: '切换分支或恢复文件' },
      { name: 'cherry-pick', description: '挑选提交应用到当前分支' },
      { name: 'pull', description: '拉取并合并远端改动' },
      { name: 'push', description: '推送本地提交' },
      { name: 'rebase', description: '变基提交历史' },
      { name: 'merge', description: '合并分支' },
    ],
    flags: [{ name: '--amend', description: '修改最近一次提交' }, { name: '--no-verify', description: '跳过提交钩子' }],
  },
  {
    command: 'docker',
    category: 'container',
    description: '容器运行时',
    subcommands: [
      { name: 'run', description: '创建并启动容器' },
      { name: 'ps', description: '查看容器列表' },
      { name: 'images', description: '查看镜像列表' },
      { name: 'logs', description: '查看容器日志' },
      { name: 'exec', description: '进入容器执行命令' },
      { name: 'compose', description: 'Compose 子命令入口' },
    ],
    flags: [{ name: '--rm', description: '容器退出后自动删除' }, { name: '-it', description: '交互式终端模式' }],
  },
  {
    command: 'docker compose',
    category: 'container',
    description: 'Compose 编排',
    subcommands: [
      { name: 'up', description: '创建并启动服务' },
      { name: 'down', description: '停止并移除资源' },
      { name: 'pull', description: '拉取服务镜像' },
      { name: 'logs', description: '查看服务日志' },
      { name: 'ps', description: '查看服务状态' },
      { name: 'build', description: '构建或重建服务镜像' },
    ],
    flags: [{ name: '-d', description: '后台启动（常用于 up）' }, { name: '--build', description: '启动前先构建镜像' }, { name: '--no-deps', description: '不启动依赖服务' }],
  },
  {
    command: 'kubectl',
    category: 'container',
    description: 'Kubernetes 集群管理',
    subcommands: [
      { name: 'get', description: '查询资源列表' },
      { name: 'describe', description: '查看资源详细信息' },
      { name: 'logs', description: '查看 Pod 日志' },
      { name: 'exec', description: '在 Pod 中执行命令' },
      { name: 'apply', description: '应用资源清单' },
      { name: 'delete', description: '删除资源' },
    ],
    flags: [{ name: '-n', description: '指定命名空间' }, { name: '--context', description: '指定 kubeconfig 上下文' }],
  },

  // 包管理
  {
    command: 'npm',
    category: 'package',
    description: 'Node.js 包管理器',
    subcommands: [
      { name: 'install', description: '安装依赖' },
      { name: 'run', description: '执行脚本' },
      { name: 'test', description: '运行测试' },
      { name: 'publish', description: '发布包' },
    ],
  },
  {
    command: 'pnpm',
    category: 'package',
    description: '高性能 Node.js 包管理器',
    subcommands: [
      { name: 'install', description: '安装依赖' },
      { name: 'add', description: '添加依赖' },
      { name: 'remove', description: '移除依赖' },
      { name: 'run', description: '执行脚本' },
      { name: 'up', description: '升级依赖' },
    ],
  },
]

function startsWithToken(value: string, token: string): boolean {
  if (!token) return true
  return value.toLowerCase().startsWith(token.toLowerCase())
}

function tokenize(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean)
}

function commandTokenLength(command: string): number {
  return tokenize(command).length
}

function findBestMatchedCommandSpec(input: string): CommandSpec | null {
  const normalized = input.trim()
  if (!normalized) return null
  const sorted = [...COMMAND_SPECS].sort((a, b) => commandTokenLength(b.command) - commandTokenLength(a.command))
  return sorted.find((spec) => normalized === spec.command || normalized.startsWith(`${spec.command} `)) ?? null
}

function buildCommandCandidate(spec: CommandSpec, request: SuggestionRequest): SuggestionCandidate {
  return {
    id: `command:${spec.command}`,
    text: spec.command,
    displayText: spec.command,
    kind: 'command',
    source: 'command-spec',
    score: 0,
    insertMode: 'replace-line',
    match: {
      from: 0,
      to: request.context.input.length,
    },
    description: spec.description,
    meta: { command: spec.command, category: spec.category },
  }
}

function buildSubcommandCandidate(spec: CommandSpec, subcommand: CommandSubcommand, request: SuggestionRequest): SuggestionCandidate {
  return {
    id: `subcommand:${spec.command}:${subcommand.name}`,
    text: `${spec.command} ${subcommand.name}`,
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
    meta: { command: spec.command, category: spec.category },
  }
}

function buildFlagCandidate(spec: CommandSpec, flag: CommandSpecFlag, request: SuggestionRequest): SuggestionCandidate {
  const base = request.context.input.trimEnd()
  const text = base.endsWith('-') || base.endsWith('--')
    ? `${base}${flag.name.replace(/^-+/, '')}`
    : `${spec.command} ${flag.name}`
  return {
    id: `flag:${spec.command}:${flag.name}`,
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
    meta: { command: spec.command, category: spec.category },
  }
}

function provideRootCommandSuggestions(request: SuggestionRequest): SuggestionCandidate[] {
  const query = request.context.input.trim().toLowerCase()
  return COMMAND_SPECS
    .filter((spec) => spec.command.toLowerCase().startsWith(query))
    .map((spec) => buildCommandCandidate(spec, request))
}

function provideSubcommandSuggestions(spec: CommandSpec, request: SuggestionRequest): SuggestionCandidate[] {
  const inputTokens = tokenize(request.context.input)
  const offset = commandTokenLength(spec.command)
  const subToken = inputTokens[offset] ?? ''
  return (spec.subcommands ?? [])
    .filter((subcommand) => startsWithToken(subcommand.name, subToken))
    .map((subcommand) => buildSubcommandCandidate(spec, subcommand, request))
}

function provideFlagSuggestions(spec: CommandSpec, request: SuggestionRequest): SuggestionCandidate[] {
  const token = tokenize(request.context.input).at(-1) ?? ''
  const filterToken = token.startsWith('-') ? token : ''
  return (spec.flags ?? [])
    .filter((flag) => startsWithToken(flag.name, filterToken))
    .map((flag) => buildFlagCandidate(spec, flag, request))
}

export function createCommandSpecSuggestionProvider(): SuggestionProvider {
  return {
    source: 'command-spec',
    provideSuggestions(request) {
      const input = request.context.input.trim()
      if (!input) return []

      const spec = findBestMatchedCommandSpec(input)
      if (!spec) return provideRootCommandSuggestions(request)

      const suggestions: SuggestionCandidate[] = []
      suggestions.push(...provideSubcommandSuggestions(spec, request))
      suggestions.push(...provideFlagSuggestions(spec, request))
      if (suggestions.length === 0) suggestions.push(buildCommandCandidate(spec, request))
      return suggestions
    },
  }
}
