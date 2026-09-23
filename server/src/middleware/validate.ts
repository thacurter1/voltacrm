import { Request, Response, NextFunction } from 'express';
import { ZodSchema, z } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ success: false, message: 'Dati non validi.', errors: error.issues });
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

export const bulkImportLeadItemSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  assignedCallCenterAgent: z.string().optional(),
  appointmentId: z.string().optional(),
  estimatedConsumptionKwh: z.union([z.number(), z.string()]).optional(),
  estimatedConsumptionSmc: z.union([z.number(), z.string()]).optional(),
});

export const bulkImportLeadsSchema = z.object({
  leads: z.array(bulkImportLeadItemSchema).min(1),
}).strict();

export const createUtilityPointSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['luce', 'gas']),
  podOrPdr: z.string().min(1),
  annualConsumption: z.number().optional(),
  powerKw: z.number().optional(),
  f1Kwh: z.number().optional(),
  f2Kwh: z.number().optional(),
  f3Kwh: z.number().optional(),
  currentSupplier: z.string().optional(),
  currentOfferName: z.string().optional(),
  currentTariffType: z.enum(['fixed', 'indexed']).optional(),
  currentUnitCost: z.number().optional(),
  currentFixedFeeYear: z.number().optional(),
}).strict();

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  fiscalCode: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  utilityPoints: z.array(createUtilityPointSchema).optional(),
  hasBrokerageMandate: z.boolean().optional(),
  accountManager: z.string().optional(),
  notes: z.string().optional(),
}).strict();

export const updateCustomerContactSchema = z.object({
  phone: z.string().regex(/^\+?[0-9 ()-]{8,25}$/),
  email: z.string().trim().email().max(254),
  city: z.string().trim().max(150),
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
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(254),
  phone: z.string().regex(/^\+?[0-9 ()-]{8,25}$/).refine(v=>v.replace(/\D/g,'').length>=8),
  fiscalCode: z.string().trim().regex(/^(?:[A-Za-z0-9]{16}|[0-9]{11})$/),
  password: z.string().min(12).max(72)
}).strict();

export const oauthAuthSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().min(1),
  name: z.string().optional(),
  role: z.literal('customer').optional().default('customer'),
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
  customerId: z.string().min(1).optional(),
  utilityPointId: z.string().min(1).optional(),
  podOrPdr: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  signerFiscalCode: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  otpCode: z.string().optional(),
  signatureType: z.enum(['otp', 'canvas']).default('otp'),
  canvasDataUrl: z.string().max(3_000_000).optional(),
  offerId: z.string().min(1),
  supplier: z.string().optional(),
  consentVersion: z.string().min(1).default('1.0')
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
