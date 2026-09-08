/**
 * NoneProvider — provedor padrão enquanto nenhuma API de NF-e foi configurada.
 *
 * Não emite nada de verdade: aceita a solicitação (para não quebrar o fluxo do pedido)
 * mas devolve status PENDING_PROVIDER com uma mensagem explicando que é preciso
 * configurar um provedor em Configurações > Nota Fiscal antes de emitir de fato.
 * Cancelamento/consulta de uma nota que nunca chegou a sair de PENDING_PROVIDER também
 * são tratados aqui sem erro.
 */
import type {
  NfeCancelInput,
  NfeCancelResult,
  NfeEmitInput,
  NfeEmitResult,
  NfeProvider,
  NfeStatusInput,
  NfeStatusResult,
} from "../types";

const NOT_CONFIGURED_MESSAGE =
  "Nenhum provedor de emissão de NF-e está configurado. Configure um provedor em Configurações > Nota Fiscal para emitir notas de verdade.";

export const noneProvider: NfeProvider = {
  name: "NONE",

  async emit(_input: NfeEmitInput): Promise<NfeEmitResult> {
    return { status: "PENDING_PROVIDER", message: NOT_CONFIGURED_MESSAGE };
  },

  async cancel(_input: NfeCancelInput): Promise<NfeCancelResult> {
    return { status: "CANCELLED", message: "Solicitação cancelada (nenhuma nota havia sido emitida de fato)." };
  },

  async getStatus(_input: NfeStatusInput): Promise<NfeStatusResult> {
    return { status: "PENDING_PROVIDER", message: NOT_CONFIGURED_MESSAGE };
  },
};
