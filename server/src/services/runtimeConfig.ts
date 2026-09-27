export function validateProductionConfiguration(): void {
  const demoMode = process.env.VOLTA_DEMO_MODE === 'true';
  if (demoMode && process.env.NODE_ENV === 'production') {
    throw new Error('La modalità demo non può essere abilitata in produzione.');
  }
  if (demoMode) return;
  const isExample = (value?: string) => !value || /^(your-|replace-|example|placeholder)|change-in-production|your-project/i.test(value);
  if (isExample(process.env.JWT_SECRET) || process.env.JWT_SECRET!.length < 32 || process.env.JWT_SECRET!.includes('volta-dev')) {
    throw new Error('JWT_SECRET univoco di almeno 32 caratteri obbligatorio fuori dalla modalità demo.');
  }
  if (isExample(process.env.SUPABASE_URL) || isExample(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('Persistenza Supabase obbligatoria fuori dalla modalità demo.');
  }
  if (process.env.TOTEM_KIOSK_API_KEY && (isExample(process.env.TOTEM_KIOSK_API_KEY) || process.env.TOTEM_KIOSK_API_KEY.length < 32 || process.env.TOTEM_KIOSK_API_KEY === 'KIOSK-TOKEN-RETAIL-01')) {
    throw new Error('TOTEM_KIOSK_API_KEY deve essere un segreto univoco di almeno 32 caratteri. Ometterlo per disabilitare il Totem.');
  }
  if (isExample(process.env.ADMIN_INITIAL_PASSWORD) || process.env.ADMIN_INITIAL_PASSWORD!.length < 12) {
    throw new Error('ADMIN_INITIAL_PASSWORD di almeno 12 caratteri obbligatoria fuori dalla modalità demo.');
  }
  if (isExample(process.env.ADMIN_2FA_SECRET) || process.env.ADMIN_2FA_SECRET!.length < 20 || process.env.ADMIN_2FA_SECRET!.includes('VOLTA_')) {
    throw new Error('ADMIN_2FA_SECRET univoco di almeno 20 caratteri obbligatorio fuori dalla modalità demo. Non usare prefisso VOLTA_.');
  }
  if (!process.env.ADMIN_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ADMIN_EMAIL) || process.env.ADMIN_EMAIL === 'admin@example.com') {
    throw new Error('ADMIN_EMAIL reale obbligatoria fuori dalla modalità demo.');
  }
}
