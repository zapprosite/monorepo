export interface CompanyIdentity {
  name: string;
  logoUrl: string;
  cnpj: string;
  phone: string;
  address: string;
  primaryColor: string;
  secondaryColor: string;
  ownerSignature: string;
}

const DEFAULT_IDENTITY: CompanyIdentity = {
  name: 'Zappro HVAC',
  logoUrl: '',
  cnpj: '',
  phone: '',
  address: '',
  primaryColor: '#39FF14',
  secondaryColor: '#0A0A0F',
  ownerSignature: '',
};

export async function getCompanyIdentity(_teamId: string): Promise<CompanyIdentity> {
  // Company module was removed in SPEC-302 Phase 1 pruning.
  // Return default identity until a new company settings module is built.
  return DEFAULT_IDENTITY;
}
