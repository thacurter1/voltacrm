export interface CompanyProfile {
  name: string;
  address: string;
  vatNumber: string;
  reaNumber: string;
  shareCapital: string;
  tollFreePhone: string;
  supportEmail: string;
  privacyEmail: string;
  pecEmail: string;
  isConfiguredCorporateIdentity: boolean;
}

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as Record<string, string | undefined>);

export const COMPANY_PROFILE: CompanyProfile = {
  name: env.VITE_COMPANY_NAME || 'Volta Energia S.r.l.',
  address: env.VITE_COMPANY_ADDRESS || 'Via Monte Napoleone 8, 20121 Milano (MI)',
  vatNumber: env.VITE_COMPANY_VAT || '12948570155',
  reaNumber: env.VITE_COMPANY_REA || 'MI-2684910',
  shareCapital: env.VITE_COMPANY_CAPITAL || '€ 100.000,00 i.v.',
  tollFreePhone: env.VITE_COMPANY_TOLL_FREE || '800 912 345',
  supportEmail: env.VITE_COMPANY_SUPPORT_EMAIL || 'supporto@voltaenergia.it',
  privacyEmail: env.VITE_COMPANY_PRIVACY_EMAIL || 'privacy@voltaenergia.it',
  pecEmail: env.VITE_COMPANY_PEC || 'voltaenergia@pec.it',
  isConfiguredCorporateIdentity: Boolean(
    env.VITE_CONFIRM_CORPORATE_IDENTITY === 'true' ||
      (env.VITE_COMPANY_NAME &&
        env.VITE_COMPANY_VAT &&
        env.VITE_COMPANY_ADDRESS &&
        env.VITE_COMPANY_TOLL_FREE &&
        env.VITE_COMPANY_SUPPORT_EMAIL &&
        env.VITE_COMPANY_PRIVACY_EMAIL &&
        env.VITE_COMPANY_PEC)
  ),
};

