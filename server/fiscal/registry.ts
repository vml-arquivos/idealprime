/**
 * server/fiscal/registry.ts — resolve o provedor de NF-e configurado.
 *
 * Para plugar um provedor real no futuro (Focus NFe, PlugNotas, eNotas, NFe.io ou
 * integração direta com a SEFAZ):
 *   1. Crie server/fiscal/providers/<nome>.provider.ts implementando `NfeProvider`
 *      (ver server/fiscal/types.ts).
 *   2. Registre a instância no mapa abaixo com a mesma string usada em
 *      `fiscal_settings.provider` (e no CHECK da migration/schema).
 *   3. Nenhuma outra mudança é necessária — db.fiscal.ts e fiscal.router.ts já
 *      resolvem o provedor dinamicamente a partir da configuração salva.
 */
import type { NfeProvider } from "./types";
import { noneProvider } from "./providers/none.provider";
import { mockProvider } from "./providers/mock.provider";

const PROVIDERS: Record<string, NfeProvider> = {
  NONE: noneProvider,
  MOCK: mockProvider,
  // FOCUS_NFE: focusNfeProvider,   // pendente de contratação/decisão do cliente
  // PLUGNOTAS: plugNotasProvider,  // pendente de contratação/decisão do cliente
  // ENOTAS: eNotasProvider,        // pendente de contratação/decisão do cliente
  // NFEIO: nfeIoProvider,          // pendente de contratação/decisão do cliente
};

export function getFiscalProvider(providerName: string | null | undefined): NfeProvider {
  if (!providerName) return noneProvider;
  return PROVIDERS[providerName] ?? noneProvider;
}

export function listKnownProviders(): { id: string; label: string; implemented: boolean }[] {
  return [
    { id: "NONE", label: "Nenhum (desativado)", implemented: true },
    { id: "MOCK", label: "Simulação interna (testes/homologação)", implemented: true },
    { id: "FOCUS_NFE", label: "Focus NFe (em breve)", implemented: false },
    { id: "PLUGNOTAS", label: "PlugNotas (em breve)", implemented: false },
    { id: "ENOTAS", label: "eNotas (em breve)", implemented: false },
    { id: "NFEIO", label: "NFe.io (em breve)", implemented: false },
    { id: "CUSTOM", label: "Outro / integração personalizada (em breve)", implemented: false },
  ];
}
