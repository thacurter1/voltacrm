import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();

export interface ExtractedBillData {
  fileName: string;
  utilityType: 'luce' | 'gas';
  podOrPdr: string;
  supplier: string;
  customerName: string;
  fiscalCode: string;
  annualConsumption: number;
  f1Kwh?: number;
  f2Kwh?: number;
  f3Kwh?: number;
  rawCostTotal: number;
  estimatedSavingEur: number;
  confidenceScore: number;
  powerKw?: number;
  currentUnitCost: number;
  currentFixedFeeYear: number;
  period?: string;
  notes?: string;
}

const extractedBillSchema = z.object({
  utilityType: z.enum(['luce', 'gas']),
  podOrPdr: z.string().trim().min(8).max(24),
  supplier: z.string().trim().min(2).max(200),
  customerName: z.string().trim().min(2).max(200),
  fiscalCode: z.string().trim().regex(/^(?:[A-Za-z0-9]{16}|[0-9]{11})$/),
  annualConsumption: z.number().finite().positive(),
  f1Kwh: z.number().finite().nonnegative().nullable().optional(),
  f2Kwh: z.number().finite().nonnegative().nullable().optional(),
  f3Kwh: z.number().finite().nonnegative().nullable().optional(),
  powerKw: z.number().finite().positive().nullable().optional(),
  rawCostTotal: z.number().finite().nonnegative(),
  currentUnitCost: z.number().finite().nonnegative(),
  currentFixedFeeYear: z.number().finite().nonnegative(),
  estimatedSavingEur: z.number().finite().nonnegative(),
  confidenceScore: z.number().finite().min(0).max(100),
  period: z.string().trim().min(1).max(120).optional(),
});

/**
 * Analizza una bolletta (PDF o Immagine) usando Google Gemini Vision.
 * Fallisce senza produrre dati quando il provider non è disponibile.
 */
export async function analyzeBillWithGemini(
  fileName: string,
  mimeType: string,
  base64Data: string
): Promise<ExtractedBillData> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw Object.assign(new Error('OCR Gemini non configurato: GEMINI_API_KEY obbligatoria.'), { status: 503 });
  }

  try {
      console.log(`[Gemini OCR] Invio documento a Gemini 2.5 Flash (${fileName}, ${mimeType})...`);
      
      const prompt = `Sei l'assistente AI di VoltaCRM, esperto certificato ARERA nel mercato energetico italiano (luce e gas).
Analizza questa bolletta o fattura ed estrai rigorosamente in formato JSON i dati essenziali:
{
  "utilityType": "luce" o "gas",
  "podOrPdr": "codice POD (14-15 caratteri, es. IT001E...) o PDR (14 cifre)",
  "supplier": "nome del venditore/fornitore (es. Enel Energia, Eni Plenitude, A2A, Acea, Octopus Energy, Hera, ecc.)",
  "customerName": "intestatario o ragione sociale cliente",
  "fiscalCode": "codice fiscale o partita IVA",
  "annualConsumption": numero consumo annuo (kWh se luce, Smc se gas),
  "f1Kwh": numero o null,
  "f2Kwh": numero o null,
  "f3Kwh": numero o null,
  "powerKw": numero potenza impegnata (es. 3.0, 4.5, 6.0, 15.0) o null,
  "rawCostTotal": importo totale fattura in euro (numero),
  "currentUnitCost": costo stimato materia energia al kWh o Smc (numero),
  "currentFixedFeeYear": commercializzazione vendita euro/anno (numero),
  "estimatedSavingEur": stima risparmio annuo realistico con migliore tariffa mercato libero (numero),
  "confidenceScore": percentuale di affidabilita rilevata (numero tra 85 e 99.9),
  "period": "periodo di fatturazione (es. Maggio-Giugno 2026)"
}
Rispondi ESCLUSIVAMENTE con il JSON valido senza blocchi markdown.`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || 'application/pdf',
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Provider Gemini HTTP ${res.status}: ${errText.slice(0, 300)}`);
      }
      const data: any = await res.json();
      const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) throw new Error('Il provider non ha restituito dati OCR.');
      const parsed = JSON.parse(textContent);
      const validated = extractedBillSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error('Dati OCR incompleti o non validi: ' + validated.error.issues.map(issue => issue.path.join('.')).join(', '));
      }
      const bill = validated.data;
      console.log(`[Gemini OCR] Estrazione completata con successo per ${fileName}: POD/PDR ${bill.podOrPdr}`);
      return {
        fileName,
        utilityType: bill.utilityType,
        podOrPdr: bill.podOrPdr,
        supplier: bill.supplier,
        customerName: bill.customerName,
        fiscalCode: bill.fiscalCode.toUpperCase(),
        annualConsumption: bill.annualConsumption,
        f1Kwh: bill.f1Kwh ?? undefined,
        f2Kwh: bill.f2Kwh ?? undefined,
        f3Kwh: bill.f3Kwh ?? undefined,
        powerKw: bill.powerKw ?? undefined,
        rawCostTotal: bill.rawCostTotal,
        currentUnitCost: bill.currentUnitCost,
        currentFixedFeeYear: bill.currentFixedFeeYear,
        estimatedSavingEur: bill.estimatedSavingEur,
        confidenceScore: bill.confidenceScore,
        period: bill.period,
        notes: 'Analizzato con successo tramite Google Gemini 2.0 Flash Vision.'
      };
    } catch (err: any) {
      throw Object.assign(new Error(`OCR Gemini non disponibile: ${err.message}`), { status: 503 });
    }
}
