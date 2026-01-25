import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { MarketService } from '../services/MarketService';
import { createMarketSchema } from '../validators/marketValidators';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient(); // In a real app, use dependency injection or singleton

export class MarketController extends BaseController {
  private service: MarketService;

  constructor() {
    super();
    this.service = new MarketService(prisma);
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createMarketSchema.parse(req.body);
      const market = await this.service.createMarket(validatedData as any); // Cast for now, refined types later
      this.handleSuccess(res, market, 201);
    } catch (error) {
      this.handleError(error, res, 'MarketController.create');
    }
  };

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const markets = await this.service.getMarkets();
      this.handleSuccess(res, markets);
    } catch (error) {
      this.handleError(error, res, 'MarketController.getAll');
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const market = await this.service.getMarketById(id);
      if (!market) {
        res.status(404).json({ success: false, error: 'Market not found' });
        return;
      }
      this.handleSuccess(res, market);
    } catch (error) {
      this.handleError(error, res, 'MarketController.getById');
    }
  };
}
