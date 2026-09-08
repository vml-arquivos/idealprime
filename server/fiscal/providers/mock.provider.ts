/**
 * MockProvider — simula uma emissão bem-sucedida sem falar com nenhuma SEFAZ ou API
 * real. Existe só para permitir testar o fluxo completo (emitir → autorizada →
 * cancelar) em desenvolvimento/homologação interna antes de um provedor real ser
 * contratado. Habilitado via `fiscal_settings.provider = 'MOCK'` — nunca deve ser usado
 * em produção real (a chave de acesso gerada não é válida perante a SEFAZ).
 */
import { randomInt } from "node:crypto";
import type {
  NfeCancelInput,
  NfeCancelResult,
  NfeEmitInput,
  NfeEmitResult,
  NfeProvider,
  NfeStatusInput,
  NfeStatusResult,
} from "../types";

function fakeAccessKey(): string {
  let digits = "";
  for (let i = 0; i < 44; i++) digits += randomInt(0, 10).toString();
  return digits;
}

export const mockProvider: NfeProvider = {
  name: "MOCK",

  async emit(input: NfeEmitInput): Promise<NfeEmitResult> {
    const accessKey = fakeAccessKey();
    return {
      status: "AUTHORIZED",
      series: "1",
      number: String(1000 + input.invoiceId),
      accessKey,
      providerReference: `mock-${input.invoiceId}`,
      xmlUrl: null,
      danfeUrl: null,
      message: "Nota simulada autorizada (MockProvider — não é uma nota fiscal real).",
    };
  },

  async cancel(_input: NfeCancelInput): Promise<NfeCancelResult> {
    return { status: "CANCELLED", message: "Nota simulada cancelada (MockProvider)." };
  },

  async getStatus(_input: NfeStatusInput): Promise<NfeStatusResult> {
    return { status: "AUTHORIZED", message: "Nota simulada autorizada (MockProvider)." };
  },
};
