import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';
import { config } from '../../config/unifiedConfig';
import { healthTracker } from '../../utils/health';

const MARKET_FACTORY_ABI = [
  "event MarketCreated(address indexed market, address indexed owner, address collateralAsset, address loanAsset)"
];

const LENDING_MARKET_ABI = [
  "event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 collateral, uint256 principal)",
  "event LoanRepaid(uint256 indexed loanId, address indexed borrower)",
  "event Liquidated(uint256 indexed loanId, address indexed liquidator)"
];

const BLOCK_CHUNK_SIZE = 100;
const POLL_INTERVAL_MS = 5000;

export class EventIndexerService {
  private prisma: PrismaClient;
  private provider: ethers.FallbackProvider;
  private factoryContract: ethers.Contract;
  private isRunning: boolean = false;
  private lastIndexedBlock: number = 0;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    const providers = config.rpcUrls.map(url => new ethers.JsonRpcProvider(url));
    this.provider = new ethers.FallbackProvider(providers);
    this.factoryContract = new ethers.Contract(
      config.contracts.marketFactory,
      MARKET_FACTORY_ABI,
      this.provider
    );
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Event Indexer is already running');
      return;
    }
    
    this.isRunning = true;
    
    try {
      const state = await this.prisma.syncState.findUnique({
        where: { id: 'event_indexer' }
      });

      if (state) {
        this.lastIndexedBlock = state.lastBlock;
        logger.info({ block: this.lastIndexedBlock }, 'Resuming Event Indexer from saved state');
      } else {
        this.lastIndexedBlock = await this.provider.getBlockNumber();
        logger.info({ block: this.lastIndexedBlock }, 'Starting Event Indexer from current block');
        
        await this.prisma.syncState.upsert({
          where: { id: 'event_indexer' },
          update: {},
          create: { id: 'event_indexer', lastBlock: this.lastIndexedBlock }
        });
      }
      
      this.pollEvents();
    } catch (error) {
      logger.error({ err: error }, 'Failed to start Event Indexer');
      this.isRunning = false;
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('Stopping Event Indexer Service...');
  }

  private async pollEvents() {
    if (!this.isRunning) return;

    healthTracker.updateWorker('event_indexer', { isHealthy: true });

    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      if (currentBlock > this.lastIndexedBlock) {
        const fromBlock = this.lastIndexedBlock + 1;
        const toBlock = Math.min(currentBlock, fromBlock + BLOCK_CHUNK_SIZE);

        await this.indexFactoryEvents(fromBlock, toBlock);
        await this.indexMarketEvents(fromBlock, toBlock);

        this.lastIndexedBlock = toBlock;

        await this.prisma.syncState.update({
          where: { id: 'event_indexer' },
          data: { lastBlock: toBlock }
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Error polling events');
      healthTracker.updateWorker('event_indexer', { isHealthy: false, error: (error as Error).message });
    }

    setTimeout(() => this.pollEvents(), POLL_INTERVAL_MS);
  }

  private async indexFactoryEvents(fromBlock: number, toBlock: number) {
    const logs = await this.factoryContract.queryFilter("MarketCreated", fromBlock, toBlock);
    
    for (const log of logs) {
      if (log instanceof ethers.EventLog) {
        const { market, owner, collateralAsset } = log.args;
        logger.info({ market }, 'Found new market');
        
        await this.prisma.user.upsert({
            where: { address: owner },
            update: {},
            create: { address: owner }
        });

        await this.prisma.market.upsert({
          where: { address: market },
          update: {},
          create: {
            address: market,
            lpAddress: owner,
            collateralAsset,
            assetType: 'ERC20',
            ltvBasisPoints: 7500,
            aprBasisPoints: 1000,
            durationSeconds: 86400 * 30,
            gracePeriodHours: 72,
            enableHealthFactor: false,
            oracleType: 'UNISWAP_V3_TWAP',
            primaryOracle: '0x0000000000000000000000000000000000000000',
            twapPeriodSeconds: 1800,
            circuitBreakerEnabled: false,
          }
        });
      }
    }
  }

  private async indexMarketEvents(fromBlock: number, toBlock: number) {
    const markets = await this.prisma.market.findMany();
    
    for (const market of markets) {
      const address = market.address;
      const marketContract = new ethers.Contract(address, LENDING_MARKET_ABI, this.provider);
      
      const requests = await marketContract.queryFilter("LoanRequested", fromBlock, toBlock);
      for (const log of requests) {
        if (log instanceof ethers.EventLog) {
          const { loanId, borrower, collateral, principal } = log.args;
          logger.info({ market: address, loanId }, 'Found new loan');
          
          await this.prisma.user.upsert({
            where: { address: borrower },
            update: {},
            create: { address: borrower }
          });

          await this.prisma.loan.upsert({
            where: { marketAddress_contractLoanId: { marketAddress: address, contractLoanId: loanId.toString() } },
            update: {},
            create: {
              marketAddress: address,
              contractLoanId: loanId.toString(),
              borrowerAddress: borrower,
              collateralAmount: collateral.toString(),
              principal: principal.toString(),
              startTime: new Date(),
              expiryTime: new Date(Date.now() + market.durationSeconds * 1000), 
              status: 'ACTIVE'
            }
          });
        }
      }

      const repayments = await marketContract.queryFilter("LoanRepaid", fromBlock, toBlock);
      for (const log of repayments) {
        if (log instanceof ethers.EventLog) {
          const { loanId } = log.args;
          await this.prisma.loan.update({
            where: { marketAddress_contractLoanId: { marketAddress: address, contractLoanId: loanId.toString() } },
            data: { status: 'REPAID' }
          });
        }
      }

      const liquidations = await marketContract.queryFilter("Liquidated", fromBlock, toBlock);
      for (const log of liquidations) {
        if (log instanceof ethers.EventLog) {
          const { loanId } = log.args;
          await this.prisma.loan.update({
            where: { marketAddress_contractLoanId: { marketAddress: address, contractLoanId: loanId.toString() } },
            data: { status: 'LIQUIDATED' }
          });
        }
      }
    }
  }
}