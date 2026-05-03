import { db } from '@backend/db/db';

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

export async function getCompanyIdentity(teamId: string): Promise<CompanyIdentity> {
  try {
    const company = await db.company.where({ teamId }).findOptional();
    if (!company) return DEFAULT_IDENTITY;

    return {
      name: company.name || DEFAULT_IDENTITY.name,
      logoUrl: company.logoUrl || DEFAULT_IDENTITY.logoUrl,
      cnpj: company.cnpj || DEFAULT_IDENTITY.cnpj,
      phone: company.phone || DEFAULT_IDENTITY.phone,
      address: company.address || DEFAULT_IDENTITY.address,
      primaryColor: company.primaryColor || DEFAULT_IDENTITY.primaryColor,
      secondaryColor: company.secondaryColor || DEFAULT_IDENTITY.secondaryColor,
      ownerSignature: company.ownerSignature || DEFAULT_IDENTITY.ownerSignature,
    };
  } catch {
    return DEFAULT_IDENTITY;
  }
}
