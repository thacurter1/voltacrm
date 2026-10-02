import { Router, Request, Response } from 'express';
import { analyzeBillWithGemini } from '../services/geminiOcrService.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';
import { decodeAndValidateBillFile, sanitizeBillFileName } from '../utils/billFile.js';

export const ocrRouter = Router();

// POST /api/ocr/analyze-bill
ocrRouter.post('/analyze-bill', apiLimiter, authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { fileName, mimeType, base64Data } = req.body || {};

  try {
    const safeMimeType = typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';
    const bytes = decodeAndValidateBillFile(base64Data, safeMimeType);
    const safeFileName = sanitizeBillFileName(typeof fileName === 'string' ? fileName : 'bolletta_upload.pdf');
    const result = await analyzeBillWithGemini(
      safeFileName,
      safeMimeType,
      bytes.toString('base64')
    );

    res.json({
      success: true,
      message: 'Bolletta analizzata con successo.',
      result
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Errore durante l’analisi del documento.'
    });
  }
});
