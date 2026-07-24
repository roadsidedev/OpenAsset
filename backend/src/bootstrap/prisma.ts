import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

const connectionLimit = parseInt(process.env.DB_POOL_SIZE || '10', 10);
const poolTimeout = parseInt(process.env.DB_POOL_TIMEOUT || '30000', 10);

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: { db: { url: process.env.DATABASE_URL } },
});

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

prisma.$connect().catch((err) => {
  console.error('Prisma connection failed:', err);
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}