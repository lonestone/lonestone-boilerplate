import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import fetch from 'node-fetch'

async function main() {
  const url = `${process.env.API_URL}/api/docs.json`
  const tmp = path.resolve('tmp', 'openapi.json')
  const res = await fetch(url)
  const spec = await res.json()

  spec.components = spec.components || {}
  spec.components.schemas = spec.components.schemas || {}

  for (const [, pathObj] of Object.entries(spec.paths || {})) {
    for (const [, op] of Object.entries(pathObj || {})) {
      const parameters = op.parameters || []
      op.parameters = parameters.map((param) => {
        // Only process query params with inline object items
        if (param.in === 'query'
          && param.schema?.type === 'string'
          && param.schema.items
          && param.schema.items.type === 'object') {
          const item = param.schema.items
          const baseName = `${op.operationId}_${param.name}`

          // Create a unique component name for the item
          const itemName = `${baseName}Item`
          const arrName = `${baseName}Array`

          // Add item schema
          spec.components.schemas[itemName] = {
            type: 'object',
            properties: item.properties,
            required: item.required,
            additionalProperties: item.additionalProperties ?? false,
          }

          // Add array schema
          spec.components.schemas[arrName] = {
            type: 'array',
            items: { $ref: `#/components/schemas/${itemName}` },
          }

          // Replace the inline schema with a $ref
          return {
            ...param,
            schema: {
              $ref: `#/components/schemas/${arrName}`,
            },
            style: 'form',
            explode: false,
          }
        }

        // No transform
        return param
      })
    }
  }

  fs.mkdirSync(path.dirname(tmp), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(spec, null, 2))
  // eslint-disable-next-line no-console
  console.log('✔ OpenAPI spec transformed with dynamic filter/sort arrays')
}

main().catch(console.error)
