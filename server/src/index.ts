import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { leadsRouter } from './routes/leads.js';
import { customersRouter } from './routes/customers.js';
import { switchRouter } from './routes/switch.js';
import { kioskRouter } from './routes/kiosk.js';
import { notificationsRouter } from './routes/notifications.js';
import { ocrRouter } from './routes/ocr.js';
import { messagingRouter } from './routes/messaging.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { getCustomers, getLeads, getNotifications, initDataStore } from './services/dataStore.js';
import { testDatabaseConnection } from './services/dbClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Totem-Token', 'X-Client-Version']
}));

app.use(express.json({ limit: '1mb' }));
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

// Root & Health check
app.get('/api/health', async (_req: Request, res: Response): Promise<void> => {
  const dbHealth = await testDatabaseConnection();
  res.json({
    status: 'healthy',
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

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/switch', switchRouter);
app.use('/api/kiosk', kioskRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/messaging', messagingRouter);

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
  res.status(err.status || 500).json({ success: false, message: err.message || 'Si è verificato un errore interno nel server.' });
});

initDataStore().catch(err => console.warn('[Startup] Warning durante inizializzazione DB:', err.message));

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 VOLTACRM BACKEND API SERVER ATTIVO`);
  console.log(`📡 URL Locale: http://localhost:${PORT}`);
  console.log(`⚕️ Health Check: http://localhost:${PORT}/api/health`);
  console.log(`💼 CRM Broker: http://localhost:${PORT}/api/switch/audit`);
  console.log(`🖥️ Totem Kiosk: http://localhost:${PORT}/api/kiosk/lead`);
  console.log(`=================================================`);
});

export default app;
