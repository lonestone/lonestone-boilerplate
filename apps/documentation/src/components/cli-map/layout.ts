/**
 * Shape of the CLI map: where each node sits, which wires connect them, and
 * which nodes and wires each flow lights up. Words live in `strings.*.ts`.
 */

export const NODE_WIDTH = 196
export const NODE_HEIGHT = 80

export type NodeRole = 'key' | 'cmd' | 'file' | 'human' | 'ext'
export type EdgeKind = 'next' | 'write' | 'read'

export interface NodeDef {
  role: NodeRole
  /** Fixed name, for commands and files. Human steps are named in the strings. */
  name?: string
  /** True for the nodes that only matter to the boilerplate maintainers. */
  maint?: true
  cmds?: string[]
}

const DLX = 'pnpm dlx @lonestone/boilerstone-cli'

export const NODES = {
  release: { role: 'ext' },
  init: {
    role: 'key',
    name: 'init my-app',
    cmds: [`${DLX} init my-app`, `${DLX}@X.Y.Z init my-app`],
  },
  onboard: { role: 'key', name: 'onboard', cmds: [`${DLX} onboard`] },
  bootstrap: { role: 'cmd', name: 'bootstrap', cmds: [`${DLX} bootstrap`] },
  rock: { role: 'key', name: 'pnpm rock', cmds: ['pnpm rock'] },
  env: { role: 'file', name: '.env + Docker' },
  pkg: { role: 'file', name: 'package.json' },
  state: { role: 'file', name: 'boilerplate.json' },
  refs: {
    role: 'file',
    name: 'refs/boilerstone/v*',
    cmds: ['git fetch --no-tags <remote> "+refs/tags/v*:refs/boilerstone/v*"'],
  },
  status: {
    role: 'key',
    name: 'upgrade status',
    cmds: ['pnpm boilerplate upgrade status', 'pnpm boilerplate upgrade status --json'],
  },
  versions: { role: 'cmd', name: 'versions list', cmds: ['pnpm boilerplate versions list'] },
  path: {
    role: 'cmd',
    name: 'upgrade path',
    cmds: [
      'pnpm boilerplate upgrade path --to X.Y.Z',
      'pnpm boilerplate upgrade path --to X.Y.Z --json',
    ],
  },
  prepare: {
    role: 'key',
    name: 'upgrade',
    cmds: [
      'pnpm boilerplate upgrade',
      'pnpm boilerplate upgrade X.Y.Z',
      'pnpm boilerplate upgrade prepare --to X.Y.Z --exclude vX.Y.Z/<id>',
    ],
  },
  branch: { role: 'file', name: 'upgrade/vA-to-vB' },
  workspace: { role: 'file', name: '.boilerstone/upgrade/' },
  apply: { role: 'human' },
  record: {
    role: 'key',
    name: 'upgrade record',
    cmds: [
      'pnpm boilerplate upgrade record --id vX.Y.Z/<id> --applied',
      'pnpm boilerplate upgrade record --id vX.Y.Z/<id> --skipped --reason "…"',
    ],
  },
  finish: {
    role: 'key',
    name: 'upgrade finish',
    cmds: ['pnpm boilerplate upgrade finish --to X.Y.Z'],
  },
  state2: { role: 'file', name: 'boilerplate.json' },
  pkg2: { role: 'file', name: 'package.json' },
  pr: { role: 'human' },
  intentions: { role: 'file', name: 'migration-intentions/', maint: true },
  promote: {
    role: 'cmd',
    name: 'intentions promote',
    maint: true,
    cmds: ['pnpm boilerplate intentions promote --to X.Y.Z', 'pnpm boilerplate intentions sync'],
  },
  lint: {
    role: 'cmd',
    name: 'intentions lint',
    maint: true,
    cmds: ['pnpm boilerplate intentions lint', 'pnpm boilerplate intentions lint --json'],
  },
} as const satisfies Record<string, NodeDef>

export type NodeId = keyof typeof NODES

export const nodeDef = (id: NodeId): NodeDef => NODES[id]

export const EDGE_DEFS = [
  ['release', 'init', 'read'],
  ['release', 'onboard', 'read'],
  ['release', 'refs', 'write'],
  ['init', 'pkg', 'write'],
  ['init', 'state', 'write'],
  ['init', 'rock', 'next'],
  ['onboard', 'bootstrap', 'next'],
  ['bootstrap', 'pkg', 'write'],
  ['bootstrap', 'state', 'write'],
  ['rock', 'env', 'write'],
  ['promote', 'intentions', 'write'],
  ['intentions', 'lint', 'read'],
  ['intentions', 'release', 'write'],
  ['state', 'status', 'read'],
  ['refs', 'status', 'read'],
  ['refs', 'versions', 'read'],
  ['versions', 'path', 'next'],
  ['status', 'prepare', 'next'],
  ['path', 'prepare', 'next'],
  ['refs', 'prepare', 'read'],
  ['prepare', 'branch', 'write'],
  ['prepare', 'workspace', 'write'],
  ['workspace', 'apply', 'read'],
  ['apply', 'record', 'next'],
  ['record', 'finish', 'next'],
  ['record', 'state2', 'write'],
  ['finish', 'state2', 'write'],
  ['finish', 'pkg2', 'write'],
  ['finish', 'pr', 'next'],
  ['branch', 'pr', 'next'],
] as const satisfies readonly (readonly [NodeId, NodeId, EdgeKind])[]

// Distributes over the tuples, so only the pairs listed above are valid ids.
type EdgeIdOf<T> = T extends readonly [infer From extends string, infer To extends string, unknown]
  ? `${From}->${To}`
  : never
export type EdgeId = EdgeIdOf<(typeof EDGE_DEFS)[number]>

export const EDGES = EDGE_DEFS.map(([from, to, kind]) => ({
  id: `${from}->${to}` as EdgeId,
  from: from as NodeId,
  to: to as NodeId,
  kind: kind as EdgeKind,
}))

export type FlowId = 'create' | 'join' | 'onboard' | 'upgrade' | 'release'

interface FlowDef {
  command: string
  nodes: NodeId[]
  edges: EdgeId[]
  /** Another flow the note points to. */
  noteFlow?: FlowId
}

export const FLOWS: Record<FlowId, FlowDef> = {
  create: {
    command: `${DLX} init my-app`,
    nodes: ['release', 'init', 'pkg', 'state', 'rock', 'env'],
    edges: ['release->init', 'init->pkg', 'init->state', 'init->rock', 'rock->env'],
  },
  join: {
    command: 'pnpm install && pnpm rock',
    nodes: ['rock', 'env'],
    edges: ['rock->env'],
  },
  onboard: {
    command: `${DLX} onboard`,
    noteFlow: 'upgrade',
    nodes: ['release', 'onboard', 'bootstrap', 'pkg', 'state'],
    edges: ['release->onboard', 'onboard->bootstrap', 'bootstrap->pkg', 'bootstrap->state'],
  },
  upgrade: {
    command: 'pnpm boilerplate upgrade',
    nodes: [
      'refs',
      'state',
      'status',
      'prepare',
      'branch',
      'workspace',
      'apply',
      'record',
      'finish',
      'state2',
      'pkg2',
      'pr',
    ],
    edges: [
      'state->status',
      'refs->status',
      'status->prepare',
      'refs->prepare',
      'prepare->branch',
      'prepare->workspace',
      'workspace->apply',
      'apply->record',
      'record->state2',
      'record->finish',
      'finish->state2',
      'finish->pkg2',
      'finish->pr',
      'branch->pr',
    ],
  },
  release: {
    command: 'pnpm boilerplate intentions promote --to X.Y.Z',
    nodes: ['promote', 'intentions', 'lint', 'release'],
    edges: ['promote->intentions', 'intentions->lint', 'intentions->release'],
  },
}

export const FLOW_IDS = Object.keys(FLOWS) as FlowId[]

export const LAYOUT = {
  width: 1151,
  height: 1896,
  nodes: {
    promote: { x: 475, y: 24 },
    intentions: { x: 475, y: 160 },
    lint: { x: 390, y: 296 },
    release: { x: 508, y: 432 },
    onboard: { x: 508, y: 568 },
    init: { x: 253, y: 568 },
    bootstrap: { x: 508, y: 704 },
    pkg: { x: 286, y: 840 },
    state: { x: 508, y: 840 },
    rock: { x: 64, y: 704 },
    env: { x: 64, y: 840 },
    refs: { x: 745, y: 704 },
    status: { x: 523, y: 976 },
    versions: { x: 745, y: 840 },
    path: { x: 745, y: 976 },
    prepare: { x: 745, y: 1112 },
    branch: { x: 438, y: 1248 },
    workspace: { x: 778, y: 1248 },
    apply: { x: 778, y: 1384 },
    record: { x: 778, y: 1520 },
    finish: { x: 693, y: 1656 },
    pr: { x: 471, y: 1792 },
    state2: { x: 915, y: 1792 },
    pkg2: { x: 693, y: 1792 },
  } satisfies Record<NodeId, { x: number; y: number }>,
  edges: {
    'release->init': [
      [557, 512],
      [557, 534],
      [351, 534],
      [351, 568],
    ],
    'release->onboard': [
      [606, 512],
      [606, 568],
    ],
    'init->pkg': [
      [351, 648],
      [351, 840],
    ],
    'init->state': [
      [400, 648],
      [400, 818],
      [573, 818],
      [573, 840],
    ],
    'init->rock': [
      [302, 648],
      [302, 670],
      [162, 670],
      [162, 704],
    ],
    'onboard->bootstrap': [
      [606, 648],
      [606, 704],
    ],
    'bootstrap->pkg': [
      [573, 784],
      [573, 806],
      [417, 806],
      [417, 840],
    ],
    'bootstrap->state': [
      [639, 784],
      [639, 840],
    ],
    'rock->env': [
      [162, 784],
      [162, 840],
    ],
    'promote->intentions': [
      [573, 104],
      [573, 160],
    ],
    'intentions->lint': [
      [540, 240],
      [540, 262],
      [488, 262],
      [488, 296],
    ],
    'intentions->release': [
      [606, 240],
      [606, 432],
    ],
    'release->refs': [
      [655, 512],
      [655, 534],
      [843, 534],
      [843, 704],
    ],
    'state->status': [
      [606, 920],
      [606, 942],
      [588, 942],
      [588, 976],
    ],
    'refs->status': [
      [794, 784],
      [794, 806],
      [724, 806],
      [724, 942],
      [654, 942],
      [654, 976],
    ],
    'refs->versions': [
      [843, 784],
      [843, 840],
    ],
    'versions->path': [
      [843, 920],
      [843, 976],
    ],
    'status->prepare': [
      [621, 1056],
      [621, 1078],
      [794, 1078],
      [794, 1112],
    ],
    'path->prepare': [
      [843, 1056],
      [843, 1112],
    ],
    'refs->prepare': [
      [892, 784],
      [892, 806],
      [961, 806],
      [961, 1078],
      [892, 1078],
      [892, 1112],
    ],
    'prepare->branch': [
      [810, 1192],
      [810, 1214],
      [536, 1214],
      [536, 1248],
    ],
    'prepare->workspace': [
      [876, 1192],
      [876, 1248],
    ],
    'workspace->apply': [
      [876, 1328],
      [876, 1384],
    ],
    'apply->record': [
      [876, 1464],
      [876, 1520],
    ],
    'record->finish': [
      [843, 1600],
      [843, 1622],
      [791, 1622],
      [791, 1656],
    ],
    'record->state2': [
      [909, 1600],
      [909, 1622],
      [1046, 1622],
      [1046, 1792],
    ],
    'finish->state2': [
      [840, 1736],
      [840, 1758],
      [980, 1758],
      [980, 1792],
    ],
    'finish->pkg2': [
      [791, 1736],
      [791, 1792],
    ],
    'finish->pr': [
      [742, 1736],
      [742, 1758],
      [602, 1758],
      [602, 1792],
    ],
    'branch->pr': [
      [536, 1328],
      [536, 1792],
    ],
  } satisfies Record<EdgeId, number[][]>,
}
