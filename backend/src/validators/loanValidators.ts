import { z } from 'zod';

export const createLoanSchema = z.object({
  contractLoanId: z.string(),
  marketAddress: z.string(),
  borrowerAddress: z.string(),
  collateralAmount: z.string(),
  tokenId: z.string().optional(),
  principal: z.string(),
  startTime: z.string().datetime(), // Expect ISO string
  expiryTime: z.string().datetime(),
});
