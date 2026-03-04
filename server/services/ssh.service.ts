/* ── SSH 连接管理服务（从 ssh-server.ts 抽出） ── */

import { Client } from 'ssh2'

export interface SshConnectionConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
}

export function createSshClient(config: SshConnectionConfig): Client {
  const client = new Client()
  const connectConfig: Record<string, unknown> = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    readyTimeout: 10000,
  }

  if (config.privateKey) {
    connectConfig.privateKey = config.privateKey
  } else if (config.password) {
    connectConfig.password = config.password
  }

  client.connect(connectConfig as Parameters<Client['connect']>[0])
  return client
}
