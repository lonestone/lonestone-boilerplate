export * from "./client/sdk.gen";
export * from "./client/types.gen";
export * from "./client/zod.gen";
export * from "./client/transformers.gen";
export * from "./client/schemas.gen";

import { client } from "./client/client.gen";

client.setConfig({
  baseUrl: 'http://localhost:3000',
  credentials: 'include',
});

export { client };
