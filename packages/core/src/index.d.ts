export interface ModuleDef {
  key: string
  label: string
  description: string
  /** false = todavía no tiene código; el panel lo muestra como "próximamente". */
  available: boolean
}

export interface StageDef {
  key: string
  label: string
  final: boolean
}

export interface ReasonDef {
  key: string
  label: string
}

export interface PackDef {
  label: string
  modules: string[]
  labels: Record<string, string>
  stages: StageDef[]
  reasons: ReasonDef[]
}

/** Una fila de `catalog_items` de ejemplo. */
export interface SeedItem {
  name: string
  kind: 'product' | 'service'
  price: number
  description: string
  bot_info: string
  sort: number
  track_stock?: boolean
  stock_qty?: number
}

export declare const MODULES: ModuleDef[]
export declare const CORE_FEATURES: string[]
export declare const PACKS: Record<string, PackDef>
export declare const SEEDS: Record<string, SeedItem[]>
export declare function label(pack: string, key: string): string
export declare function modulesForPack(pack: string): string[]
