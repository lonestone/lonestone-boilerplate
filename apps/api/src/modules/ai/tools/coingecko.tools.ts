import { createMCPClient } from '@ai-sdk/mcp'
import { tool } from 'ai'
import { z } from 'zod'

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'

const cryptoPriceSchema = z.object({
  ids: z.string().describe('Comma-separated list of cryptocurrency IDs (e.g., "bitcoin,ethereum"). Common IDs: bitcoin, ethereum, cardano, solana, polkadot, dogecoin, etc.'),
  vs_currencies: z.string().describe('Comma-separated list of fiat currencies (e.g., "usd,eur"). Common currencies: usd, eur, gbp, jpy, cad, aud, etc.'),
})

export const getCryptoPriceTool = tool({
  description: 'Get the current price of cryptocurrencies in various fiat currencies from CoinGecko. Supports multiple cryptocurrencies and currencies. Default currency is USD if not specified.',
  inputSchema: cryptoPriceSchema,
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    timestamp: z.string(),
  }),
  execute: async ({ ids, vs_currencies }: z.infer<typeof cryptoPriceSchema>) => {
    const currencies = vs_currencies || 'usd'
    try {
      const url = `${COINGECKO_API_BASE}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(currencies)}`

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}. ${errorText}`)
      }

      const data = await response.json()
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      }
    }
  },
})

export function createCoingeckoMCPClient() {
  return createMCPClient({
    transport: {
      type: 'http',
      url: 'https://mcp.api.coingecko.com/mcp',
    },
  })
}
