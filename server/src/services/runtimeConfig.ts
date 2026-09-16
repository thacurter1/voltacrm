export function validateProductionConfiguration(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('volta-dev')) {
    throw new Error('JWT_SECRET univoco di almeno 32 caratteri obbligatorio in produzione.');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obbligatori in produzione.');
  }
  if (process.env.TOTEM_KIOSK_API_KEY && (process.env.TOTEM_KIOSK_API_KEY.length < 32 || process.env.TOTEM_KIOSK_API_KEY === 'KIOSK-TOKEN-RETAIL-01')) {
    throw new Error('TOTEM_KIOSK_API_KEY deve essere un segreto univoco di almeno 32 caratteri. Ometterlo per disabilitare il Totem.');
  }
  if (!process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD.length < 12) {
    throw new Error('ADMIN_INITIAL_PASSWORD di almeno 12 caratteri obbligatoria in produzione.');
  }
  if (!process.env.ADMIN_2FA_SECRET || process.env.ADMIN_2FA_SECRET.length < 20 || process.env.ADMIN_2FA_SECRET.includes('VOLTA_')) {
    throw new Error('ADMIN_2FA_SECRET univoco di almeno 20 caratteri obbligatorio in produzione. Non usare prefisso VOLTA_.');
  }
}
