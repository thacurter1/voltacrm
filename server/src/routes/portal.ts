import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getCustomers, users } from '../services/dataStore.js';
import {
  MAX_BILL_BYTES,
  MeterReadingInput,
  PortalUtilityType,
  portalService,
} from '../services/portalService.js';

export const portalRouter = Router();

portalRouter.use(authenticateToken);

type PortalActor =
  | { isStaff: true; customerId?: string }
  | { isStaff: false; customerId: string };

function httpError(message: string, status: number): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

function resolveActor(req: AuthRequest): PortalActor {
  const authUser = req.user;
  const profile = users.find((item) => item.id === authUser?.userId);
  if (!authUser || !profile) throw httpError('Profilo autenticato non trovato.', 403);

  if (['admin', 'call_center', 'operator'].includes(authUser.role)) {
    return { isStaff: true };
  }
  if (authUser.role !== 'customer' || !profile.customerId) {
    throw httpError('Il profilo non è associato a un cliente.', 403);
  }
  if (!getCustomers().some((customer) => customer.id === profile.customerId)) {
    throw httpError('Cliente associato non trovato.', 403);
  }
  return { isStaff: false, customerId: profile.customerId };
}

function resolveCustomer(req: AuthRequest, requestedCustomerId?: unknown) {
  const actor = resolveActor(req);
  const customerId = actor.isStaff
    ? (typeof requestedCustomerId === 'string' ? requestedCustomerId.trim() : '')
    : actor.customerId;
  if (!customerId) throw httpError('Specificare un customerId valido.', 400);

  const customer = getCustomers().find((item) => item.id === customerId);
  if (!customer) throw httpError('Cliente non trovato.', 404);
  return { actor, customer };
}

function decodeBase64File(value: unknown): Buffer {
  if (typeof value !== 'string' || value.length === 0) {
    throw httpError('File della bolletta mancante.', 400);
  }
  if (value.length > Math.ceil(MAX_BILL_BYTES / 3) * 4 + 4) {
    throw httpError('La bolletta supera il limite massimo di 10 MB.', 413);
  }
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw httpError('Codifica del file non valida.', 400);
  }
  return Buffer.from(value, 'base64');
}

portalRouter.get('/bills', async (req: AuthRequest, res: Response): Promise<void> => {
  const actor = resolveActor(req);
  const requested = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : undefined;
  if (requested && !getCustomers().some((customer) => customer.id === requested)) {
    throw httpError('Cliente non trovato.', 404);
  }
  const customerId = actor.isStaff ? requested : actor.customerId;
  const bills = await portalService.listBills(customerId);
  res.json({ success: true, bills });
});

portalRouter.post('/bills', async (req: AuthRequest, res: Response): Promise<void> => {
  const { customer } = resolveCustomer(req, req.body?.customerId);
  const utilityType = req.body?.utilityType as PortalUtilityType;
  if (!customer.utilityPoints.some((point: any) => point.type === utilityType)) {
    throw httpError('La fornitura selezionata non appartiene al cliente.', 400);
  }

  const bill = await portalService.uploadBill({
    customerId: customer.id,
    customerName: customer.name,
    fileName: typeof req.body?.fileName === 'string' ? req.body.fileName : 'bolletta',
    mimeType: typeof req.body?.mimeType === 'string' ? req.body.mimeType : '',
    bytes: decodeBase64File(req.body?.base64Data),
    utilityType,
    notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 1000) : undefined,
  });
  res.status(201).json({ success: true, bill });
});

portalRouter.get('/bills/:id/download', async (req: AuthRequest, res: Response): Promise<void> => {
  const actor = resolveActor(req);
  const bill = await portalService.getBill(req.params.id);
  if (!actor.isStaff && bill.customerId !== actor.customerId) {
    throw httpError('Accesso negato alla bolletta richiesta.', 403);
  }

  const download = await portalService.getBillDownload(bill.id);
  res.setHeader('Cache-Control', 'private, no-store');
  if (download.kind === 'signed-url') {
    res.redirect(302, download.url);
    return;
  }
  res.setHeader('Content-Type', download.mimeType);
  res.setHeader('Content-Length', String(download.bytes.length));
  res.setHeader('Content-Disposition', 'attachment; filename="' + bill.fileName + '"');
  res.status(200).send(download.bytes);
});

portalRouter.get('/readings', async (req: AuthRequest, res: Response): Promise<void> => {
  const actor = resolveActor(req);
  const requested = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : undefined;
  if (requested && !getCustomers().some((customer) => customer.id === requested)) {
    throw httpError('Cliente non trovato.', 404);
  }
  const customerId = actor.isStaff ? requested : actor.customerId;
  const readings = await portalService.listReadings(customerId);
  res.json({ success: true, readings });
});

portalRouter.post('/readings', async (req: AuthRequest, res: Response): Promise<void> => {
  const { customer } = resolveCustomer(req, req.body?.customerId);
  const input = req.body as MeterReadingInput;
  const point = customer.utilityPoints.find((item: any) => item.id === input.utilityPointId);
  if (!point || point.type !== input.utilityType) {
    throw httpError('Il punto di fornitura selezionato non appartiene al cliente.', 400);
  }

  const reading = await portalService.createReading(customer.id, {
    utilityPointId: input.utilityPointId,
    utilityType: input.utilityType,
    readings: input.readings,
  });
  res.status(201).json({ success: true, reading });
});
