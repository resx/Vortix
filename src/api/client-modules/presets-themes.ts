import type {
  CreateCustomThemeDto,
  CreatePresetDto,
  CustomThemePublic,
  ImportThemesResult,
  PresetCredential,
  PresetPublic,
  UpdateCustomThemeDto,
  UpdatePresetDto,
} from '../types'
import { getCurrentApiBaseUrl, request } from '../http'

export async function getPresets(): Promise<PresetPublic[]> {
  return request<PresetPublic[]>('/presets')
}

export async function getPreset(id: string): Promise<PresetPublic> {
  return request<PresetPublic>(`/presets/${id}`)
}

export async function getPresetCredential(id: string): Promise<PresetCredential> {
  return request<PresetCredential>(`/presets/${id}/credential`)
}

export async function createPreset(dto: CreatePresetDto): Promise<PresetPublic> {
  return request<PresetPublic>('/presets', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updatePreset(id: string, dto: UpdatePresetDto): Promise<PresetPublic> {
  return request<PresetPublic>(`/presets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deletePreset(id: string): Promise<void> {
  return request<void>(`/presets/${id}`, { method: 'DELETE' })
}

export async function getCustomThemes(): Promise<CustomThemePublic[]> {
  return request<CustomThemePublic[]>('/themes')
}

export async function getCustomTheme(id: string): Promise<CustomThemePublic> {
  return request<CustomThemePublic>(`/themes/${id}`)
}

export async function createCustomTheme(dto: CreateCustomThemeDto): Promise<CustomThemePublic> {
  return request<CustomThemePublic>('/themes', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateCustomTheme(id: string, dto: UpdateCustomThemeDto): Promise<CustomThemePublic> {
  return request<CustomThemePublic>(`/themes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteCustomTheme(id: string): Promise<void> {
  return request<void>(`/themes/${id}`, { method: 'DELETE' })
}

export async function importThemes(raw: string): Promise<ImportThemesResult> {
  return request<ImportThemesResult>('/themes/import', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  })
}

export function getThemeExportUrl(id: string): string {
  return `${getCurrentApiBaseUrl()}/themes/${id}/export`
}
