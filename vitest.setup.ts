import { config } from 'dotenv'
import '@testing-library/jest-dom/vitest'

// Vitest does not populate process.env from .env files on its own.
// .env.test comes second with override so tests never point at the dev database:
// several suites call deleteMany() and would otherwise wipe the seeded library.
config({ path: '.env' })
config({ path: '.env.test', override: true })

if (!process.env.DATABASE_URL?.includes('fitness_test')) {
  throw new Error(
    `Refusing to run tests against "${process.env.DATABASE_URL}". ` +
      'Tests must use the fitness_test database — check .env.test exists.',
  )
}
