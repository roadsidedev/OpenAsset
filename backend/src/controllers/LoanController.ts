import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { LoanService } from '../services/LoanService';
import { createLoanSchema } from '../validators/loanValidators';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class LoanController extends BaseController {
  private service: LoanService;

  constructor() {
    super();
    this.service = new LoanService(prisma);
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createLoanSchema.parse(req.body);
      const loan = await this.service.createLoan({
        ...validatedData,
        startTime: new Date(validatedData.startTime),
        expiryTime: new Date(validatedData.expiryTime),
        // Ensure relations are connected properly if needed, usually simplified here
        market: { connect: { address: validatedData.marketAddress } },
        borrower: { connectOrCreate: { 
            where: { address: validatedData.borrowerAddress }, 
            create: { address: validatedData.borrowerAddress } 
        } }  
      });
      this.handleSuccess(res, loan, 201);
    } catch (error) {
      this.handleError(error, res, 'LoanController.create');
    }
  };

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const loans = await this.service.getLoans();
      this.handleSuccess(res, loans);
    } catch (error) {
      this.handleError(error, res, 'LoanController.getAll');
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const loan = await this.service.getLoanById(id);
      if (!loan) {
        res.status(404).json({ success: false, error: 'Loan not found' });
        return;
      }
      this.handleSuccess(res, loan);
    } catch (error) {
      this.handleError(error, res, 'LoanController.getById');
    }
  };
}
