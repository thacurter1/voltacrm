import { Router, Request, Response } from 'express';
import { analyzeBillWithGemini } from '../services/geminiOcrService.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

export const ocrRouter = Router();

// POST /api/ocr/analyze-bill
ocrRouter.post('/analyze-bill', apiLimiter, async (req: Request, res: Response): Promise<void> => {
  const { fileName, mimeType, base64Data } = req.body;

  if (!base64Data) {
    res.status(400).json({
      success: false,
      message: 'Dati del documento (base64Data) mancanti o non validi.'
    });
    return;
  }

  try {
    const result = await analyzeBillWithGemini(
      fileName || 'bolletta_upload.pdf',
      mimeType || 'application/pdf',
      base64Data
    );

    res.json({
      success: true,
      message: 'Bolletta analizzata con successo.',
      result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Errore durante l’analisi del documento.'
    });
  }
});
