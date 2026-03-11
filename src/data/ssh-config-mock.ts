/* SSH 配置编辑器 Mock 数据 */

export interface MockPrivateKey {
  id: string
  name: string
  fileName: string
  type: string
  updatedAt: string
}

export interface MockAssetNode {
  name: string
  type: 'folder' | 'server'
  ip?: string
  open?: boolean
  children?: MockAssetNode[]
}

export const MOCK_PRIVATE_KEYS: MockPrivateKey[] = [
  { id: 'key-1', name: 'tencent', fileName: 'tencent.pem', type: 'ssh-rsa', updatedAt: '02-03 10:05' },
  { id: 'key-2', name: 'RobVPS', fileName: '-', type: 'ssh-ed25519', updatedAt: '12-19 23:41' },
  { id: 'key-3', name: 'Netify', fileName: '-', type: 'ssh-ed25519', updatedAt: '12-19 23:41' },
  { id: 'key-4', name: 'DMIT CORONA', fileName: 'id_rsa.pem', type: 'ssh-rsa', updatedAt: '12-22 17:01' },
]

export const MOCK_ASSET_TREE: MockAssetNode[] = [
  { name: 'Docker', type: 'folder', open: false, children: [] },
  {
    name: '业务', type: 'folder', open: true, children: [
      { name: 'Berohost', ip: '37.114.48.53', type: 'server' },
      { name: 'HostDZire', ip: '23.19.231.205', type: 'server' },
      { name: 'Huawei', ip: '188.239.19.39', type: 'server' },
      { name: 'OVH KS-LE-B Ultra', ip: '54.39.103.170', type: 'server' },
      { name: 'po0', ip: '124.221.220.112', type: 'server' },
      { name: 'Tencent', ip: '43.134.31.80', type: 'server' },
      { name: '锐驰成都', ip: '139.155.152.8', type: 'server' },
    ],
  },
  {
    name: '科学', type: 'folder', open: true, children: [
      { name: 'Bandwagon Megabox', ip: '104.194.69.121', type: 'server' },
      { name: 'DMIT CORONA', ip: '69.63.206.18', type: 'server' },
      { name: 'Racknerd DC2', ip: '74.48.64.242', type: 'server' },
    ],
  },
]
