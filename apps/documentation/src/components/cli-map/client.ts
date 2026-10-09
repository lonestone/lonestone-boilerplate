/**
 * Makes the server-rendered CLI map interactive: pick a flow, click a node,
 * read the details in the side panel. Without this script the map still shows.
 */
import { EDGES, FLOWS, LAYOUT, nodeDef, type FlowId, type NodeId } from './layout'
import { esc, fmt, nodeName, renderFlow, renderNode, renderOverview } from './render'
import { content } from './content'

interface State {
  flow: FlowId | ''
  sel: NodeId | ''
  dimMaintainer: boolean
}

function setup(root: HTMLElement): void {
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!
  const board = $<HTMLElement>('.cm-board')
  const frame = $<HTMLElement>('.cm-frame')
  const scroller = $<HTMLElement>('.cm-scroll')
  const panel = $<HTMLElement>('.cm-panel')
  const panelBody = $<HTMLElement>('.cm-panel-body')
  const panelLabel = $<HTMLElement>('.cm-panel-label')
  const collapse = $<HTMLButtonElement>('.cm-collapse')
  const tip = $<HTMLElement>('.cm-tip')
  const nodeEls = Object.fromEntries(
    [...root.querySelectorAll<HTMLElement>('.cm-node')].map((el) => [el.dataset.id!, el]),
  ) as Record<NodeId, HTMLElement>
  const edgeEls = Object.fromEntries(
    [...root.querySelectorAll<SVGGElement>('.cm-edge')].map((el) => [el.dataset.id!, el]),
  )

  const state: State = { flow: '', sel: '', dimMaintainer: false }

  // The board is drawn at a fixed size, then scaled down to the width of the page.
  // On a phone it stops at 75%: smaller than that the labels cannot be read, so it scrolls sideways.
  function fit(): void {
    const floor = scroller.clientWidth < 700 ? 0.75 : 0.62
    const scale = Math.max(floor, Math.min(1, (scroller.clientWidth - 16) / LAYOUT.width))
    board.style.transform = `scale(${scale})`
    frame.style.width = `${LAYOUT.width * scale}px`
    frame.style.height = `${LAYOUT.height * scale}px`
  }
  new ResizeObserver(fit).observe(scroller)
  fit()
  // Start on the middle of the board, where the commands are.
  scroller.scrollLeft = Math.max(0, (frame.offsetWidth - scroller.clientWidth) / 2)

  // On a phone the panel starts folded, so it does not hide half of the map.
  // Picking a flow or a node opens it.
  const phone = matchMedia('(max-width: 49.99rem)')
  function setCollapsed(collapsed: boolean): void {
    panel.classList.toggle('is-collapsed', collapsed)
    collapse.textContent = collapsed ? content.ui.open : content.ui.collapse
    collapse.setAttribute('aria-expanded', String(!collapsed))
  }
  if (phone.matches) setCollapsed(true)

  function renderPanel(): void {
    if (state.sel) {
      panelLabel.textContent = content.nodes[state.sel].kind
      panelBody.innerHTML = renderNode(state.sel, state.flow)
    } else if (state.flow) {
      panelLabel.textContent = content.ui.flow
      panelBody.innerHTML = renderFlow(state.flow)
    } else {
      panelLabel.textContent = content.ui.cheatSheet
      panelBody.innerHTML = renderOverview()
    }
  }

  function update(): void {
    const flow = state.flow ? FLOWS[state.flow] : null
    const flowNodes = new Set<string>(flow?.nodes)
    const flowEdges = new Set<string>(flow?.edges)
    const stepOf = new Map<string, number>()
    if (state.flow) content.flows[state.flow].steps.forEach(([id], i) => stepOf.set(id, i + 1))

    for (const [id, el] of Object.entries(nodeEls)) {
      const dim =
        (flow && !flowNodes.has(id)) || (state.dimMaintainer && nodeDef(id as NodeId).maint)
      el.classList.toggle('is-dim', Boolean(dim))
      el.classList.toggle('is-flow', Boolean(flow && flowNodes.has(id)))
      el.classList.toggle('is-selected', state.sel === id)
      el.setAttribute('aria-pressed', String(state.sel === id))
      el.querySelector('.cm-badge')!.textContent = String(stepOf.get(id) ?? '')
    }

    for (const edge of EDGES) {
      const el = edgeEls[edge.id]
      if (!el) continue
      let on = false
      let dim = false
      if (flow) {
        on = flowEdges.has(edge.id)
        dim = !on
      } else if (state.sel) {
        on = edge.from === state.sel || edge.to === state.sel
        dim = !on
      }
      if (state.dimMaintainer && (nodeDef(edge.from).maint || nodeDef(edge.to).maint) && !on)
        dim = true
      el.classList.toggle('is-on', on)
      el.classList.toggle('is-dim', dim)
    }
    // Lit wires go last, so they are drawn on top of the dimmed ones.
    if (flow) {
      const wires = $<SVGSVGElement>('.cm-wires')
      for (const id of flow.edges) if (edgeEls[id]) wires.append(edgeEls[id]!)
    }

    for (const button of root.querySelectorAll<HTMLElement>('.cm-flows button')) {
      button.setAttribute('aria-checked', String(button.dataset.flow === state.flow))
    }
    renderPanel()
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  function select(id: NodeId | '', reveal: boolean): void {
    state.sel = id
    update()
    if (id && phone.matches) setCollapsed(false)
    if (reveal && id) {
      nodeEls[id]?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    }
  }

  function setFlow(id: string): void {
    state.flow = id in FLOWS ? (id as FlowId) : ''
    state.sel = ''
    update()
    if (state.flow && phone.matches) setCollapsed(false)
    try {
      history.replaceState(
        null,
        '',
        state.flow ? `#${state.flow}` : `${location.pathname}${location.search}`,
      )
    } catch {
      // The address bar is a nicety, not a requirement.
    }
  }

  async function copy(button: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(button.dataset.copy!)
      button.textContent = content.ui.copied
    } catch {
      const range = document.createRange()
      range.selectNodeContents(button.parentElement!.querySelector('code')!)
      const selection = getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      button.textContent = content.ui.selected
    }
    setTimeout(() => {
      button.textContent = content.ui.copy
    }, 1500)
  }

  for (const el of Object.values(nodeEls)) {
    el.addEventListener('click', () =>
      select(state.sel === el.dataset.id ? '' : (el.dataset.id as NodeId), false),
    )
  }
  $('.cm-flows').addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('button[data-flow]')
    if (button) setFlow(button.dataset.flow!)
  })
  panelBody.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>(
      '[data-copy], [data-select], [data-back], [data-flow-reset], [data-flow-go]',
    )
    if (!target) return
    if (target.hasAttribute('data-copy')) void copy(target)
    else if (target.hasAttribute('data-select')) select(target.dataset.select as NodeId, true)
    else if (target.hasAttribute('data-back')) select('', false)
    else if (target.hasAttribute('data-flow-go')) setFlow(target.dataset.flowGo!)
    else setFlow('')
  })
  $<HTMLInputElement>('.cm-dim').addEventListener('change', (event) => {
    state.dimMaintainer = (event.target as HTMLInputElement).checked
    update()
  })
  collapse.addEventListener('click', () => setCollapsed(!panel.classList.contains('is-collapsed')))
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (state.sel) select('', false)
    else if (state.flow) setFlow('')
  })

  // Wire tooltips: what travels along the wire.
  for (const edge of EDGES) {
    const hit = edgeEls[edge.id]?.querySelector('.cm-hit')
    if (!hit) continue
    const move = (event: Event) => {
      const { clientX, clientY } = event as PointerEvent
      tip.style.left = `${Math.max(8, Math.min(clientX + 14, innerWidth - tip.offsetWidth - 8))}px`
      tip.style.top = `${Math.max(8, Math.min(clientY + 16, innerHeight - tip.offsetHeight - 8))}px`
    }
    hit.addEventListener('pointerenter', (event) => {
      // A finger has no hover: the relations list of the panel says the same thing.
      if ((event as PointerEvent).pointerType !== 'mouse') return
      tip.innerHTML = `<b>${esc(nodeName(edge.from))} → ${esc(nodeName(edge.to))}</b><br>${fmt(content.edges[edge.id])}`
      tip.hidden = false
      move(event)
    })
    hit.addEventListener('pointermove', move)
    hit.addEventListener('pointerleave', () => {
      tip.hidden = true
    })
  }

  const initial = location.hash.replace(/^#/, '')
  if (initial in FLOWS) state.flow = initial as FlowId
  update()
}

for (const root of document.querySelectorAll<HTMLElement>('[data-cli-map]')) setup(root)
