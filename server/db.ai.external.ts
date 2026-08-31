import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";

export const AI_NOT_CONFIGURED_MESSAGE =
  "Sugestão por IA não está configurada neste ambiente. Peça para o administrador configurar BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY.";

const CATEGORIES = ["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"] as const;
export type ProductSuggestionCategory = (typeof CATEGORIES)[number];

export type ProductSuggestion = {
  name: string;
  category: ProductSuggestionCategory;
  categoryLabel?: string;
  shortDescription: string;
  description: string;
};

function parseContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text ?? "") : ""))
      .join("");
  }
  return "";
}

export function normalizeProductSuggestion(value: unknown): ProductSuggestion {
  if (!value || typeof value !== "object") throw new Error("A IA retornou uma sugestão inválida.");
  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const shortDescription = typeof candidate.shortDescription === "string" ? candidate.shortDescription.trim().slice(0, 160) : "";
  const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
  const category = typeof candidate.category === "string" && CATEGORIES.includes(candidate.category as ProductSuggestionCategory)
    ? candidate.category as ProductSuggestionCategory
    : "OUTRO";
  const categoryLabel = typeof candidate.categoryLabel === "string" ? candidate.categoryLabel.trim() : "";
  if (!name || !shortDescription || !description) throw new Error("A IA não retornou todos os campos necessários para o cadastro.");
  return { name, category, categoryLabel, shortDescription, description };
}

export async function requestExternalProductSuggestion(input: { imageUrl?: string; name?: string }): Promise<ProductSuggestion> {
  const name = input.name?.trim() || "";
  const imageUrl = input.imageUrl?.trim() || "";
  if (!imageUrl && !name) throw new Error("Envie uma imagem ou um nome para a IA sugerir os dados.");
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error(AI_NOT_CONFIGURED_MESSAGE);

  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }> = [
    {
      type: "text",
      text: "Você é um catalogador de e-commerce brasileiro. Analise o produto (imagem e/ou nome) e devolva dados objetivos em português do Brasil, sem inventar especificações que não sejam visíveis ou óbvias. Categorias possíveis: CELULAR, ELETRONICO, PERFUME, OUTRO.",
    },
  ];
  if (name) content.push({ type: "text", text: `Nome informado pelo usuário: ${name}` });
  if (imageUrl) content.push({ type: "image_url", image_url: { url: imageUrl, detail: "high" } });

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content }],
      outputSchema: {
        name: "product_suggestion",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: [...CATEGORIES] },
            categoryLabel: { type: "string" },
            shortDescription: { type: "string", maxLength: 160 },
            description: { type: "string" },
          },
          required: ["name", "category", "shortDescription", "description"],
          additionalProperties: false,
        },
        strict: true,
      },
    });
    const text = parseContent(result.choices?.[0]?.message?.content);
    if (!text) throw new Error("A IA não retornou conteúdo para a sugestão.");
    return normalizeProductSuggestion(JSON.parse(text));
  } catch (error) {
    if (error instanceof Error && (error.message === AI_NOT_CONFIGURED_MESSAGE || error.message.startsWith("A IA "))) throw error;
    throw new Error("Não foi possível obter uma sugestão da IA agora. Você pode continuar o cadastro manualmente.");
  }
}
