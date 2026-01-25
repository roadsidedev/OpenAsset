import { MarketRepository } from '../repositories/MarketRepository';
import { PrismaClient, Market, Prisma } from '@prisma/client';

export class MarketService {
  private repository: MarketRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new MarketRepository(prisma);
  }

  async createMarket(data: Prisma.MarketCreateInput): Promise<Market> {
    // Add any specific business logic or validation here
    return this.repository.create(data);
  }

  async getMarkets(filter?: Prisma.MarketWhereInput): Promise<Market[]> {
    return this.repository.findAll(filter);
  }

  async getMarketById(id: string): Promise<Market | null> {
    return this.repository.findById(id);
  }
}
