import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 connects through a driver adapter rather than its own engine binary.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

// Next.js dev server reloads modules on every change; without this the process
// accumulates a new connection pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
