import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tooling scratch dirs. Both are gitignored, but flat config does not read
    // .gitignore, so they must be listed here or `npm run lint` fails on
    // vendored/minified code that is not ours:
    // - supabase/.temp/ holds the edge-runtime entrypoint written by `supabase start`
    // - .vercel/ holds output from `vercel pull` / `vercel build`
    "supabase/.temp/**",
    ".vercel/**",
  ]),
]);

export default eslintConfig;
