import type { KeyType } from './types'

export const KEY_TYPE_OPTIONS: { value: KeyType; label: string; desc: string }[] = [
  { value: 'ed25519', label: 'ED25519', desc: 'OpenSSH 6.5+' },
  { value: 'ecdsa', label: 'ECDSA', desc: 'OpenSSH 5.7+' },
  { value: 'rsa', label: 'RSA', desc: 'Legacy devices' },
  { value: 'ml-dsa', label: 'ML-DSA', desc: '后量子算法' },
]

export const ECDSA_BITS = [521, 384, 256]
export const RSA_BITS = [4096, 2048, 1024]
export const MLDSA_BITS = [87, 65, 44]

export const DEFAULT_BITS_BY_TYPE: Record<KeyType, number> = {
  ed25519: 521,
  ecdsa: 521,
  rsa: 4096,
  'ml-dsa': 87,
}
