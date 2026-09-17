import { Router, Response } from 'express';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';
import {
  addSecurityLog, listAppointments, listSecurityLogs, saveAppointment, updateAppointmentStatus,
  AppointmentRecord, AppointmentStatus,
} from '../services/operationsService.js';

export const operationsRouter = Router();
operationsRouter.use(authenticateToken);
operationsRouter.use(requireRole('admin', 'call_center', 'operator'));

const appointmentStatuses = new Set(['scheduled', 'completed', 'cancelled', 'no_show']);
const appointmentTypes = new Set(['phone_consultation', 'field_visit', 'video_call']);
const securityStatuses = new Set(['safe', 'warning', 'critical']);

function badRequest(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 400 });
}

function parseAppointment(body: any): AppointmentRecord {
  const required = ['id', 'leadId', 'customerName', 'phone', 'city', 'agentName', 'scheduledAt'];
  if (!body || required.some(key => typeof body[key] !== 'string' || !body[key].trim())) throw badRequest('Dati appuntamento incompleti.');
  if (!appointmentTypes.has(body.type) || !appointmentStatuses.has(body.status)) throw badRequest('Tipo o stato appuntamento non valido.');
  if (!Number.isInteger(body.durationMinutes) || body.durationMinutes < 5 || body.durationMinutes > 480) throw badRequest('Durata appuntamento non valida.');
  if (Number.isNaN(Date.parse(body.scheduledAt))) throw badRequest('Data appuntamento non valida.');
  return { ...body, notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '' };
}

operationsRouter.get('/appointments', async (_req, res: Response) => {
  res.json({ success: true, appointments: await listAppointments() });
});

operationsRouter.post('/appointments', async (req: AuthRequest, res: Response) => {
  const appointment = await saveAppointment(parseAppointment(req.body));
  res.status(201).json({ success: true, appointment });
});

operationsRouter.patch('/appointments/:id/status', async (req: AuthRequest, res: Response) => {
  const status = req.body?.status as AppointmentStatus;
  if (!appointmentStatuses.has(status)) throw badRequest('Stato appuntamento non valido.');
  res.json({ success: true, appointment: await updateAppointmentStatus(req.params.id, status) });
});

operationsRouter.get('/security-logs', async (_req, res: Response) => {
  res.json({ success: true, logs: await listSecurityLogs() });
});

operationsRouter.post('/security-logs', async (req: AuthRequest, res: Response) => {
  if (typeof req.body?.eventType !== 'string' || !req.body.eventType.trim() || !securityStatuses.has(req.body?.status) || typeof req.body?.details !== 'string') {
    throw badRequest('Evento di sicurezza non valido.');
  }
  const log = await addSecurityLog({
    eventType: req.body.eventType.slice(0, 100),
    userEmail: req.user!.email,
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    status: req.body.status,
    details: req.body.details.slice(0, 4000),
  });
  res.status(201).json({ success: true, log });
});
