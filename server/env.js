/**
 * Loads .env before anything else touches process.env.
 *
 * ES module imports are all evaluated before the first statement of the
 * importing file runs. index.js called dotenv.config() at line 18, but
 * middleware/auth.js builds its Supabase clients at module level and was
 * imported at line 9, so it always ran against an empty environment. On Railway
 * the variables are already in the process environment and nothing showed;
 * locally the server could not start at all.
 *
 * Import this first, before any module that reads process.env at load time.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))

// Run from the repo root or from server/, either works.
dotenv.config({ path: path.join(here, '..', '.env') })
dotenv.config()

// Fail at startup if the service role key is missing.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is required. Set it in .env or as an environment variable on Railway.'
  )
}

export const env = process.env
