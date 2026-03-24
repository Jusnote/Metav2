export type GrifoColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

export interface Grifo {
  id: string
  user_id: string
  lei_id: string
  dispositivo_id: string
  start_offset: number
  end_offset: number
  texto_grifado: string
  color: GrifoColor
  note: string | null
  tags: string[]
  orphan: boolean
  created_at: string
  updated_at: string
}

export interface CreateGrifoParams {
  lei_id: string
  dispositivo_id: string
  start_offset: number
  end_offset: number
  texto_grifado: string
  color: GrifoColor
}

export interface GrifoSegment {
  text: string
  startOffset: number
  endOffset: number
  grifo?: Grifo
}

export const GRIFO_COLORS: Record<GrifoColor, string> = {
  yellow: 'rgba(250, 204, 21, 0.3)',
  green:  'rgba(74, 222, 128, 0.25)',
  blue:   'rgba(96, 165, 250, 0.25)',
  pink:   'rgba(244, 114, 182, 0.25)',
  orange: 'rgba(251, 146, 60, 0.25)',
}

export const GRIFO_COLOR_NAMES: Record<GrifoColor, string> = {
  yellow: 'amarelo',
  green:  'verde',
  blue:   'azul',
  pink:   'rosa',
  orange: 'laranja',
}
