/**
 * String renderers shared by the build (the map is server-rendered, so it
 * shows without JavaScript) and the browser (the side panel is redrawn on
 * every click).
 */
import {
  EDGES,
  FLOWS,
  LAYOUT,
  NODE_HEIGHT,
  NODE_WIDTH,
  nodeDef,
  type EdgeId,
  type FlowId,
  type NodeId,
} from './layout'
import { content } from './content'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

export const esc = (text: string): string => text.replace(/[&<>"]/g, (c) => ESCAPES[c]!)

/** Escapes, and turns `code` into <code>. */
export const fmt = (text: string): string => esc(text).replace(/`([^`]+)`/g, '<code>$1</code>')

export const nodeName = (id: NodeId): string => content.nodes[id].name ?? nodeDef(id).name ?? id

export const sideOf = (id: NodeId): 'producer' | 'border' | 'client' =>
  nodeDef(id).maint ? 'producer' : id === 'release' ? 'border' : 'client'

export function renderNodes(): string {
  return (Object.keys(LAYOUT.nodes) as NodeId[])
    .map((id) => {
      const def = nodeDef(id)
      const text = content.nodes[id]
      const name = nodeName(id)
      const pos = LAYOUT.nodes[id]
      const long =
        name.length > 17 && def.role !== 'human' && def.role !== 'ext' ? ' data-long' : ''
      const label = `${name}, ${text.kind}, ${content.ui.roles[def.role]}`
      return `<button type="button" class="cm-node" data-id="${id}" data-role="${def.role}"${long} style="left:${pos.x}px;top:${pos.y}px" aria-pressed="false" aria-label="${esc(label)}"><span class="cm-kind"><span>${esc(text.kind)}</span><span class="cm-badge" aria-hidden="true"></span></span><span class="cm-name"><span>${esc(name)}</span></span><span class="cm-meta"><span>${esc(text.meta)}</span></span></button>`
    })
    .join('')
}

/** A wire made of straight segments, with rounded corners. */
function roundedPath(points: number[][], radius = 9): string {
  let d = `M${points[0]![0]},${points[0]![1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1]!
    const [x1, y1] = points[i]!
    const [x2, y2] = points[i + 1]!
    const d1 = Math.hypot(x1! - x0!, y1! - y0!) || 1
    const d2 = Math.hypot(x2! - x1!, y2! - y1!) || 1
    const r = Math.min(radius, d1 / 2, d2 / 2)
    d += ` L${x1! - ((x1! - x0!) / d1) * r},${y1! - ((y1! - y0!) / d1) * r}`
    d += ` Q${x1},${y1} ${x1! + ((x2! - x1!) / d2) * r},${y1! + ((y2! - y1!) / d2) * r}`
  }
  const last = points[points.length - 1]!
  return `${d} L${last[0]},${last[1]}`
}

/** The inside of the wires <svg>: markers, the two zones and the boundary band, then every wire. */
export function renderWires(): string {
  const { width: W, height: H } = LAYOUT
  const release = LAYOUT.nodes.release
  const bandTop = release.y - 18
  const bandBottom = release.y + NODE_HEIGHT + 18
  const producerMid = (8 + bandTop - 8) / 2
  const clientMid = (bandBottom + 8 + H - 8) / 2
  const z = content.ui.zones
  const label = (y: number, text: string) =>
    `<text class="cm-zone-label" x="36" y="${y}" text-anchor="middle" transform="rotate(-90 36 ${y})">${esc(text)}</text>`

  const defs = `<defs>
    <pattern id="cm-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="cm-hatch-line" x1="0" y1="0" x2="0" y2="12"/></pattern>
    <marker id="cm-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path class="cm-arrowhead" d="M1,1.2 L9,5 L1,8.8 z"/></marker>
    <marker id="cm-arr-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto"><path class="cm-arrowhead" d="M1,1.2 L9,5 L1,8.8 z"/></marker>
  </defs>`

  const zones = `<g>
    <rect class="cm-zone cm-zone-producer" x="12" y="8" width="${W - 24}" height="${bandTop - 16}" rx="10"/>
    <rect class="cm-band" x="12" y="${bandTop}" width="${W - 24}" height="${bandBottom - bandTop}"/>
    <line class="cm-band-line" x1="12" x2="${W - 12}" y1="${bandTop}" y2="${bandTop}"/>
    <line class="cm-band-line" x1="12" x2="${W - 12}" y1="${bandBottom}" y2="${bandBottom}"/>
    <rect class="cm-zone cm-zone-client" x="12" y="${bandBottom + 8}" width="${W - 24}" height="${H - bandBottom - 16}" rx="10"/>
    ${label(producerMid, z.producer)}
    ${label(clientMid, z.client)}
    <text class="cm-band-title" x="64" y="${release.y + 32}">${esc(z.border)}</text>
    <text class="cm-band-text" x="64" y="${release.y + 54}">${esc(z.borderLine)}</text>
    <text class="cm-band-text" x="${release.x + NODE_WIDTH + 28}" y="${release.y + 32}">${esc(z.pullLine1)}</text>
    <text class="cm-band-text" x="${release.x + NODE_WIDTH + 28}" y="${release.y + 54}">${esc(z.pullLine2)}</text>
  </g>`

  const wires = EDGES.map((edge) => {
    const d = roundedPath(LAYOUT.edges[edge.id])
    return `<g class="cm-edge" data-id="${edge.id}" data-kind="${edge.kind}"><path class="cm-wire" d="${d}"/><path class="cm-hit" d="${d}"/></g>`
  }).join('')

  return defs + zones + wires
}

const copyLine = (command: string): string =>
  `<code>${esc(command)}</code><button type="button" class="cm-copy" data-copy="${esc(command)}">${esc(content.ui.copy)}</button>`

const cmdList = (commands: readonly string[]): string =>
  `<ul class="cm-cmds">${commands.map((c) => `<li class="cm-cmdline">${copyLine(c)}</li>`).join('')}</ul>`

const nodeChip = (id: NodeId): string =>
  `<button type="button" class="cm-chip" data-select="${id}">${esc(nodeName(id))}</button>`

export function renderOverview(): string {
  const groups = content.cheat
    .map(
      (group) =>
        `<section><h3>${esc(group.title)}</h3><ul>${group.items
          .map(
            ([command, id, text]) =>
              `<li><div class="cm-cmdline">${copyLine(command)}</div><button type="button" class="cm-go" data-select="${id}">${fmt(text)}</button></li>`,
          )
          .join('')}</ul></section>`,
    )
    .join('')
  return `<h2>${esc(content.ui.cheatTitle)}</h2><p class="cm-muted">${esc(content.ui.cheatHint)}</p><div class="cm-cheat">${groups}</div>`
}

export function renderFlow(id: FlowId): string {
  const text = content.flows[id]
  const flow = FLOWS[id]
  const steps = text.steps
    .map(
      ([nodeId, step], i) =>
        `<li><span class="cm-n">${i + 1}</span><span class="cm-txt"><span>${fmt(step)}</span>${nodeChip(nodeId)}</span></li>`,
    )
    .join('')
  const link = flow.noteFlow
    ? `<button type="button" class="cm-back" data-flow-go="${flow.noteFlow}">${esc(content.ui.seeFlow.replace('{title}', content.flows[flow.noteFlow].title))}</button>`
    : ''
  return `<h2>${esc(text.title)}</h2>${cmdList([flow.command])}${text.note ? `<p class="cm-flow-note">${fmt(text.note)}</p>` : ''}${link}<ol class="cm-steps">${steps}</ol><button type="button" class="cm-back" data-flow-reset>${esc(content.ui.backToCheat)}</button>`
}

export function renderNode(id: NodeId, flow: FlowId | ''): string {
  const def = nodeDef(id)
  const text = content.nodes[id]
  const name = nodeName(id)
  const back = `<button type="button" class="cm-back" data-back>← ${esc(flow ? content.flows[flow].title : content.ui.cheatSheet)}</button>`
  const heading =
    def.role === 'human' || def.role === 'ext' ? esc(name) : `<code>${esc(name)}</code>`
  const parts = [
    back,
    `<h2>${heading}</h2>`,
    `<p class="cm-muted">${esc(content.ui.roles[def.role])}, ${esc(content.ui.sides[sideOf(id)])}</p>`,
    `<p class="cm-summary">${fmt(text.summary)}</p>`,
  ]
  if (def.cmds?.length) parts.push(cmdList(def.cmds))
  if (text.does?.length) {
    parts.push(
      `<h3>${esc(content.ui.does)}</h3><ul>${text.does.map((line) => `<li>${fmt(line)}</li>`).join('')}</ul>`,
    )
  }
  if (text.know?.length) {
    parts.push(
      `<h3>${esc(content.ui.know)}</h3><ul>${text.know.map((line) => `<li>${fmt(line)}</li>`).join('')}</ul>`,
    )
  }
  const relations = EDGES.filter((e) => e.from === id || e.to === id).map((e) => {
    const outgoing = e.from === id
    const other: NodeId = outgoing ? e.to : e.from
    return `<li><button type="button" class="cm-rel" data-select="${other}"><span class="cm-dir">${outgoing ? '→' : '←'}</span><span class="cm-lbl"><b>${esc(nodeName(other))}</b><span>${fmt(content.edges[e.id as EdgeId])}</span></span></button></li>`
  })
  if (relations.length)
    parts.push(
      `<h3>${esc(content.ui.relations)}</h3><ul class="cm-rels">${relations.join('')}</ul>`,
    )
  return parts.join('')
}
