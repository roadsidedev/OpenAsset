import { PrismaClient, Loan, Prisma } from '@prisma/client';

export class LoanRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: Prisma.LoanCreateInput): Promise<Loan> {
    return this.prisma.loan.create({ data });
  }

  async findAll(where?: Prisma.LoanWhereInput): Promise<Loan[]> {
    return this.prisma.loan.findMany({
      where,
      include: {
        market: true,
        borrower: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string): Promise<Loan | null> {
    return this.prisma.loan.findUnique({
      where: { id },
      include: {
        market: true,
        borrower: true,
        alerts: true,
      },
    });
  }

  async update(id: string, data: Prisma.LoanUpdateInput): Promise<Loan> {
    return this.prisma.loan.update({
      where: { id },
      data,
    });
  }
}
