import type { BusinessParty, PaymentDetails, SignatureBlock } from "./invoice";

export interface NumberingProfile {
  prefix: string;
  nextSequence: number;
  padding: number;
  resetYearly: boolean;
  financialYear: string;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  party: BusinessParty;
  payment: PaymentDetails;
  signature: SignatureBlock;
  defaultTerms: string;
  defaultNotes: string;
  defaultTaxRate: number;
  numbering: NumberingProfile;
  updatedAt: string;
}
