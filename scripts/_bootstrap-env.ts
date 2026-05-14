/**
 * scripts/_bootstrap-env.ts
 *
 * Side-effect module: carrega `.env.local` antes de qualquer outro
 * import resolver `process.env`. **Deve ser o primeiro import de
 * qualquer script que importa `@/lib/env`** (ou módulos `server-only`
 * que dependem dele).
 *
 * Em ESM, imports são resolvidos em DFS post-order: side-effect imports
 * declarados primeiro rodam antes de irmãos que dependem do mesmo state.
 * Isso garante que `dotenv.config()` populou `process.env` quando
 * `@/lib/env`'s top-level `load()` valida o schema.
 */

import { config } from "dotenv";

config({ path: ".env.local" });
