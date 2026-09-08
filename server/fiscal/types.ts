/**
 * server/fiscal/types.ts — Contrato que qualquer provedor de emissão de NF-e/NFC-e
 * precisa implementar.
 *
 * Nenhuma integração real (Focus NFe, PlugNotas, eNotas, NFe.io, SEFAZ direta) está
 * implementada nesta rodada — apenas esta interface e dois provedores de preparação
 * (NoneProvider, MockProvider). Ver docs/ideal-prime/NFE_INTEGRACAO.md para o passo a
 * passo de como plugar um provedor real quando ele for escolhido.
 */

export type FiscalModel = "NFE" | "NFCE";

export type FiscalEnvironment = "HOMOLOGACAO" | "PRODUCAO";

export interface NfeIssuerProfile {
  legalName: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  taxRegime: string;
  city: string | null;
  state: string | null;
  environment: FiscalEnvironment;
  defaultCfop: string | null;
  defaultNcm: string | null;
}

export interface NfeInvoiceItem {
  skuOrProductId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
  ncm?: string | null;
  cfop?: string | null;
}

export interface NfeRecipient {
  name: string;
  document: string | null; // CPF (consumidor final) ou CNPJ (empresa B2B)
  email?: string | null;
  phone?: string | null;
}

/** Instantânea de tudo que um provedor precisa para emitir uma nota. */
export interface NfeEmitInput {
  invoiceId: number;
  model: FiscalModel;
  issuer: NfeIssuerProfile;
  recipient: NfeRecipient;
  items: NfeInvoiceItem[];
  totalCents: number;
}

export interface NfeEmitResult {
  /** Status resultante da tentativa de emissão. */
  status: "AUTHORIZED" | "PROCESSING" | "PENDING_PROVIDER" | "REJECTED" | "ERROR";
  series?: string | null;
  number?: string | null;
  accessKey?: string | null;
  providerReference?: string | null;
  xmlUrl?: string | null;
  danfeUrl?: string | null;
  message: string;
}

export interface NfeCancelInput {
  invoiceId: number;
  accessKey: string | null;
  providerReference: string | null;
  reason: string;
}

export interface NfeCancelResult {
  status: "CANCELLED" | "ERROR";
  message: string;
}

export interface NfeStatusInput {
  invoiceId: number;
  accessKey: string | null;
  providerReference: string | null;
}

export interface NfeStatusResult {
  status: "AUTHORIZED" | "PROCESSING" | "PENDING_PROVIDER" | "REJECTED" | "CANCELLED" | "ERROR";
  message: string;
}

/** Contrato que qualquer provedor de emissão precisa implementar. */
export interface NfeProvider {
  /** Identificador estável — deve bater com `fiscal_settings.provider`. */
  readonly name: string;
  emit(input: NfeEmitInput): Promise<NfeEmitResult>;
  cancel(input: NfeCancelInput): Promise<NfeCancelResult>;
  getStatus(input: NfeStatusInput): Promise<NfeStatusResult>;
}
