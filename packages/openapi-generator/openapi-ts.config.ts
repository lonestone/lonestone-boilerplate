import { defineConfig, type UserConfig } from '@hey-api/openapi-ts'
import { z } from 'zod'

type ZodPluginConfig = Extract<NonNullable<UserConfig['plugins']>[number], { name: 'zod' }>
type ZodStringResolver = NonNullable<NonNullable<ZodPluginConfig['~resolvers']>['string']>
type StringContext = Parameters<ZodStringResolver>[0]
type Plugin = StringContext['plugin']
type PatternSymbol = ReturnType<Plugin['symbol']>

/**
 * Pattern that Zod's `toJSONSchema` emits next to `format` for the validator Hey API generates
 * for that format (https://github.com/colinhacks/zod/issues/4120). Read from the installed Zod,
 * so it follows Zod upgrades. `undefined` when the format has no Zod validator or no pattern.
 */
function zodDefaultPattern(format: string, plugin: Plugin): string | undefined {
  const { local, offset } = plugin.config.dates
  const validators: Record<string, () => z.ZodType> = {
    date: () => z.iso.date(),
    'date-time': () => z.iso.datetime({ local, offset }),
    email: () => z.email(),
    ipv4: () => z.ipv4(),
    ipv6: () => z.ipv6(),
    time: () => z.iso.time(),
    uri: () => z.url(),
    uuid: () => z.uuid(),
  }
  const validator = validators[format]
  if (!validator) return undefined
  const { pattern } = z.toJSONSchema(validator()) as { pattern?: string }
  return pattern
}

// One module-level constant per distinct pattern, so a regex repeated across schemas is written once.
// Keyed by plugin instance because `--watch` reuses this module across generations.
const patternSymbols = new WeakMap<Plugin, Map<string, PatternSymbol>>()

function patternSymbol(ctx: StringContext, pattern: string): PatternSymbol {
  const { $, plugin } = ctx
  let symbols = patternSymbols.get(plugin)
  if (!symbols) {
    symbols = new Map()
    patternSymbols.set(plugin, symbols)
  }
  let symbol = symbols.get(pattern)
  if (!symbol) {
    symbol = plugin.symbol(`zPattern${symbols.size + 1}`)
    plugin.node($.const(symbol).assign($.regexp(pattern)))
    symbols.set(pattern, symbol)
  }
  return symbol
}

/**
 * Same steps as Hey API's default string resolver, with two changes to the `.regex()` step:
 * the regex is dropped when it is only Zod's default pattern for the format, which the format
 * validator (`z.uuid()`, `z.email()`...) already enforces, and any remaining regex points to a shared
 * constant. A stricter pattern (`z.uuidv4()`, `z.guid()`, a custom regex) is kept.
 */
const zodString: ZodStringResolver = (ctx) => {
  const { $, chain, nodes, schema, symbols } = ctx

  // Multipart file fields are `format: binary`. Without this, zod.gen.ts validates them as strings.
  if (schema.format === 'binary') return $(symbols.z).attr('instanceof').call($('Blob'))

  const constNode = nodes.const(ctx)
  if (constNode) return constNode

  chain.current = nodes.base(ctx)
  chain.current = nodes.format(ctx) ?? chain.current
  const lengthNode = nodes.length(ctx)
  if (lengthNode) {
    chain.current = lengthNode
  } else {
    chain.current = nodes.minLength(ctx) ?? chain.current
    chain.current = nodes.maxLength(ctx) ?? chain.current
  }

  const { format, pattern } = schema
  if (pattern && !(format && pattern === zodDefaultPattern(format, ctx.plugin))) {
    chain.current = chain.current.attr('regex').call($(patternSymbol(ctx, pattern)))
  }
  return chain.current
}

export default defineConfig({
  input: './tmp/openapi.json',
  output: {
    path: './client',
  },
  plugins: [
    {
      name: '@hey-api/client-fetch',
    },
    {
      dates: true,
      name: '@hey-api/transformers',
    },
    {
      enums: 'javascript',
      name: '@hey-api/typescript',
    },
    {
      name: '@hey-api/sdk',
      transformer: true,
    },
    {
      name: 'zod',
      '~resolvers': {
        string: zodString,
      },
    },
  ],
})
