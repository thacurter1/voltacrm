// Shared OCR failure helpers: the transport attaches `status` and the backend `code` to errors.

/** Error raised by the API transport, carrying the backend OCR code when present. */
export interface OcrFailure {
  message: string;
  code?: string;
  status?: number;
}

export function describeOcrFailure(failure: OcrFailure): string {
  switch (failure.code) {
    case 'OCR_NOT_CONFIGURED':
      return 'La lettura automatica non è attiva su questo ambiente. Inserisci i dati della bolletta manualmente.';
    case 'OCR_TIMEOUT':
      return 'La lettura automatica non ha risposto in tempo. Puoi riprovare o inserire i dati manualmente.';
    case 'OCR_PROVIDER_UNAVAILABLE':
      return 'Il servizio di lettura automatica non è raggiungibile. Puoi riprovare più tardi o inserire i dati manualmente.';
    case 'OCR_UNREADABLE':
    case 'OCR_PROVIDER_REJECTED':
      return 'Non è stato possibile leggere i dati dal documento. Prova con una scansione più nitida o inserisci i dati manualmente.';
    default:
      return failure.message || 'Lettura automatica non riuscita. Inserisci i dati manualmente.';
  }
}

export function toOcrFailure(err: unknown): OcrFailure {
  const e = err as { message?: unknown; code?: unknown; status?: unknown } | null;
  return {
    message: typeof e?.message === 'string' ? e.message : String(err),
    code: typeof e?.code === 'string' ? e.code : undefined,
    status: typeof e?.status === 'number' ? e.status : undefined,
  };
}
