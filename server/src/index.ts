import 'dotenv/config';
import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './routes/auth.js';
import { leadsRouter } from './routes/leads.js';
import { customersRouter } from './routes/customers.js';
import { switchRouter } from './routes/switch.js';
import { kioskRouter } from './routes/kiosk.js';
import { notificationsRouter } from './routes/notifications.js';
import { ocrRouter } from './routes/ocr.js';
import { messagingRouter } from './routes/messaging.js';
import { commissionRouter } from './routes/commissions.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { getCustomers, getLeads, getNotifications, initDataStore, bootstrapAdmin, refreshDataStore } from './services/dataStore.js';
import { portalRouter } from './routes/portal.js';
import { validateProductionConfiguration } from './services/runtimeConfig.js';
import { testDatabaseConnection } from './services/dbClient.js';
import { operationsRouter } from './routes/operations.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
// Trust first proxy (Reverse proxy come Nginx, Cloud Run, Vercel, AWS ALB)
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const rawOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Totem-Token', 'X-Client-Version']
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Root & Health check (montato prima del rate limiter per monitor di uptime)
app.get('/api/health', async (_req: Request, res: Response): Promise<void> => {
  const dbHealth = await testDatabaseConnection();
  const isHealthy = !process.env.SUPABASE_URL || dbHealth.connected;
  res.status(200).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'VoltaCRM SaaS Standalone Backend API',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbHealth,
    features: {
      auth2FA: true,
      areraSwitchEngine: true,
      punPsvMonitoring: true,
      digitalSignatureOTP: true,
      totemKioskGateway: true,
      dataStoreMetrics: {
        activeCustomers: getCustomers().length,
        inboundLeads: getLeads().length,
        systemNotifications: getNotifications().length
      }
    }
  });
});

app.use(apiLimiter);

// Request logger
app.use((req: Request, _res: Response, next) => {
  const start = Date.now();
  const { method, url } = req;
  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${method} ${url} ${_res.statusCode} - ${duration}ms`);
  });
  next();
});

// Refresh committed identity/customer state across workers before protected operations.
app.use('/api', async (_req:Request, _res:Response, next:NextFunction) => {
  await refreshDataStore();
  next();
});

// Mount Routes
app.use('/api/portal', portalRouter);
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/switch', switchRouter);
app.use('/api/kiosk', kioskRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/messaging', messagingRouter);
app.use('/api/commissions', commissionRouter);
app.use('/api/operations', operationsRouter);

// 404 handler
app.use((req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Endpoint non trovato: ${req.method} ${req.originalUrl}`
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, _next: NextFunction): void => {
  if (err.type === 'entity.parse.failed' || err.status === 400) {
    res.status(400).json({ success: false, message: 'Payload JSON non valido o malformato.' });
    return;
  }
  console.error('Unhandled error:', err);
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd 
    ? 'Si è verificato un errore interno nel server.' 
    : (err.message || 'Si è verificato un errore interno nel server.');
  res.status(err.status || 500).json({ success: false, message });
});

export async function startServer(port: number | string = PORT) {
  validateProductionConfiguration();
  await initDataStore();
  await bootstrapAdmin();
  return app.listen(port, () => console.log(`VoltaCRM API pronta sulla porta ${port}`));
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('Avvio interrotto: configurazione o database non disponibili.', error.message);
    process.exitCode = 1;
  });
}
export default app;
