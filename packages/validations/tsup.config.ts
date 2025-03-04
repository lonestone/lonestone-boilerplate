import { exec as execCb } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { defineConfig } from "tsup";

const exec = promisify(execCb);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === "production" || process.env.CI === "true";

export default defineConfig({
  entry: {
    client: "src/client.ts",
    server: "src/server.ts",
  },
  format: ["esm", "cjs"],
  target: "es2022",
  sourcemap: !isProduction,
  dts: false, // We'll generate declarations with tsc
  clean: true,
  minify: isProduction,
  splitting: true,
  treeshake: true,
  
  async onSuccess() {
    console.log("✅ Successfully built package");
    
    try {
      console.log("Generating TypeScript declarations...");
      await exec(`tsc --emitDeclarationOnly --declaration ${!isProduction ? "--declarationMap" : ""}`, { cwd: __dirname });
      console.log("✅ Successfully emitted type declarations");
    } catch (error) {
      console.error("❌ Error emitting type declarations:", error);
      // In CI or production, fail the build if declarations generation fails
      if (isProduction) {
        throw error;
      }
    }
  },
});
