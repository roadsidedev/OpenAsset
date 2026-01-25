import { PrismaClient, Market, Prisma } from '@prisma/client';

export class MarketRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: Prisma.MarketCreateInput): Promise<Market> {
    return this.prisma.market.create({ data });
  }

  async findAll(where?: Prisma.MarketWhereInput): Promise<Market[]> {
    return this.prisma.market.findMany({
      where,
      include: {
        owner: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string): Promise<Market | null> {
    return this.prisma.market.findUnique({
      where: { id },
      include: {
        owner: true,
        loans: true,
      },
    });
  }

  async update(id: string, data: Prisma.MarketUpdateInput): Promise<Market> {
    return this.prisma.market.update({
      where: { id },
      data,
    });
  }
}
