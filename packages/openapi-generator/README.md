# OpenAPI Generator

This package is used to generate the OpenAPI client from the OpenAPI schema in API.

## Usage

```bash
pnpm run generate
```

## Client

The client is generated in the `./src/client` directory.

## Usage

```ts
import { client } from '@lonestone/openapi-generator/client'

client.setConfig({
  baseUrl: 'https://example.com',
});
```

