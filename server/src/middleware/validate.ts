import { Request, Response, NextFunction } from 'express';
import { ZodSchema, z } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
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
}).passthrough();

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  fiscalCode: z.string().min(1),
}).passthrough();

export const loginOperatorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional()
}).passthrough();

export const loginCustomerSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
}).passthrough();

export const registerCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  fiscalCode: z.string().optional()
}).passthrough();

export const kioskLeadSchema = z.object({
  phone: z.string().min(1),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  monthlyExpenseEur: z.number().optional(),
  supplyType: z.string().optional(),
}).passthrough();

export const signContractSchema = z.object({
  customerName: z.string().min(1),
  signerFiscalCode: z.string().min(1),
  phone: z.string().min(1),
  otpCode: z.string().min(1),
}).passthrough();

export const triggerNotificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().min(1)
}).passthrough();

export const createUtilityPointSchema = z.object({
  type: z.string().min(1),
  podOrPdr: z.string().min(1),
}).passthrough();
