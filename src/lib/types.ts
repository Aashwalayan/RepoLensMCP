export type UsageType = 'call' | 'instantiation' | 'reference';

export interface Edge {
  fromFile: string;
  fromSymbol: string;   // the function/class doing the calling ('' = module top-level)
  toFile: string;
  toSymbol: string;      // the function/class being called
  usageType: UsageType;
  line: number;
}

export interface ScoredEntryPoint {
  file: string;
  score: number;
  reasons: string[];
}

export interface RepoGraph {
  files: string[];
  edges: Edge[];
  entryPoints: ScoredEntryPoint[];
}