import { LoanRepository } from '../repositories/LoanRepository';
import { PrismaClient, Loan, Prisma } from '@prisma/client';

export class LoanService {
  private repository: LoanRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new LoanRepository(prisma);
  }

  async createLoan(data: Prisma.LoanCreateInput): Promise<Loan> {
    return this.repository.create(data);
  }

  async getLoans(filter?: Prisma.LoanWhereInput): Promise<Loan[]> {
    return this.repository.findAll(filter);
  }

  async getLoanById(id: string): Promise<Loan | null> {
    return this.repository.findById(id);
  }
}
