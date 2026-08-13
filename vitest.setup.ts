// Loads DATABASE_URL and AUTH_SECRET from .env — Vitest does not populate
// process.env from .env files on its own.
import 'dotenv/config'
import '@testing-library/jest-dom/vitest'
