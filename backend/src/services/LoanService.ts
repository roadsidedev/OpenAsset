import { LoanRepository } from '../repositories/LoanRepository';
import { PrismaClient, Loan, Prisma } from '@prisma/client';

export interface CreateLoanParams {
  address: string;
  contractLoanId: string;
  marketAddress: string;
  borrowerAddress: string;
  collateralAmount: string;
  tokenId?: string;
  principal: string;
  startTime: string;
  expiryTime: string;
}

export class LoanService {
  private repository: LoanRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new LoanRepository(prisma);
  }

  async createLoan(params: CreateLoanParams): Promise<Loan> {
    const data: Prisma.LoanCreateInput = {
      address: params.address,
      contractLoanId: params.contractLoanId,
      collateralAmount: params.collateralAmount,
      tokenId: params.tokenId,
      principal: params.principal,
      startTime: new Date(params.startTime),
      expiryTime: new Date(params.expiryTime),
      market: { connect: { address: params.marketAddress } },
      borrower: { 
        connectOrCreate: { 
          where: { address: params.borrowerAddress }, 
          create: { address: params.borrowerAddress } 
        } 
      }
    };
    return this.repository.create(data);
  }

  async getLoans(filter?: Prisma.LoanWhereInput): Promise<Loan[]> {
    return this.repository.findAll(filter);
  }

  async getLoanById(id: string): Promise<Loan | null> {
    return this.repository.findById(id);
  }
}