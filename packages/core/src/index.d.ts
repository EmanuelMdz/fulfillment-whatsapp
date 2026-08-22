export interface ModuleDef {
  key: string
  label: string
  description: string
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

export declare const MODULES: ModuleDef[]
export declare const CORE_FEATURES: string[]
export declare const PACKS: Record<string, PackDef>
export declare function label(pack: string, key: string): string
export declare function modulesForPack(pack: string): string[]
