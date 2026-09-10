import { Request, Response, NextFunction } from 'express';
import { ZodSchema, z } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ success: false, message: 'Dati non validi.', errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: 'Richiesta non valida.' });
      return;
    }
  };
};

export const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  assignedCallCenterAgent: z.string().optional(),
  appointmentId: z.string().optional(),
  estimatedConsumptionKwh: z.number().optional(),
  estimatedConsumptionSmc: z.number().optional(),
}).strict();

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  fiscalCode: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  utilityPoints: z.array(z.any()).optional(),
  hasBrokerageMandate: z.boolean().optional(),
  accountManager: z.string().optional(),
  notes: z.string().optional(),
}).strict();

export const loginOperatorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional()
}).strict();

export const loginCustomerSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
}).strict();

export const registerCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  fiscalCode: z.string().optional(),
  password: z.string().optional()
}).strict();

export const kioskLeadSchema = z.object({
  phone: z.string().min(1),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  totemId: z.string().optional(),
  mallLocation: z.string().optional(),
  monthlyExpenseEur: z.number().optional(),
  supplyType: z.string().optional(),
}).strict();

export const signContractSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1),
  signerFiscalCode: z.string().min(1),
  phone: z.string().min(1),
  otpCode: z.string().min(1),
  offerId: z.string().optional(),
  supplier: z.string().optional(),
}).strict();

export const triggerNotificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'info']).optional(),
  targetRole: z.string().optional(),
  actionTab: z.string().optional(),
  meta: z.any().optional(),
}).strict();

export const createUtilityPointSchema = z.object({
  type: z.enum(['luce', 'gas']),
  podOrPdr: z.string().min(1),
  annualConsumption: z.number().optional(),
  powerKw: z.number().optional(),
  currentSupplier: z.string().optional(),
  currentOfferName: z.string().optional(),
  currentTariffType: z.enum(['fixed', 'indexed']).optional(),
  currentUnitCost: z.number().optional(),
  currentFixedFeeYear: z.number().optional(),
}).strict();
