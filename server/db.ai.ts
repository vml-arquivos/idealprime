import { resolveProductSuggestion } from "./db.aiAgent";

export {
  AI_NOT_CONFIGURED_MESSAGE,
  type ProductSuggestion,
  type ProductSuggestionCategory,
} from "./db.ai.external";

export async function suggestProductInfo(input: { imageUrl?: string; name?: string }) {
  return resolveProductSuggestion(input);
}
