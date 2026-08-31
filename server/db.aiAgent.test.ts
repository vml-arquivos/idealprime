import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());
const externalSuggestionMock = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ getDb: getDbMock }));
vi.mock("./db.ai.external", () => ({
  normalizeProductSuggestion: (value: unknown) => value,
  requestExternalProductSuggestion: externalSuggestionMock,
}));

import { resolveProductSuggestion } from "./db.aiAgent";

function createFakeDb(options: { internalMatch?: boolean } = {}) {
  let cached: any = null;
  const query: any = {
    from: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => Promise.resolve(cached ? [cached] : []),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve([]).then(resolve, reject),
  };

  return {
    execute: vi.fn().mockResolvedValue(options.internalMatch ? [{
      id: 7,
      name: "iPhone 15 Pro",
      category: "CELULAR",
      category_label: "Apple",
      short_description: "iPhone 15 Pro com acabamento premium",
      description: "Smartphone Apple iPhone 15 Pro.",
      score: 0.92,
    }] : []),
    select: vi.fn(() => query),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(({ set }: { set: Record<string, unknown> }) => {
          cached = {
            id: 1,
            inputHash: "mock",
            origin: "EXTERNAL_LLM",
            suggestion: set.suggestion ?? externalSuggestionMock.mock.results[0]?.value,
            hits: 1,
          };
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn() })),
    })),
  };
}

describe("resolveProductSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responde pelo produto semelhante sem chamar o LLM externo", async () => {
    const db = createFakeDb({ internalMatch: true });
    getDbMock.mockResolvedValue(db);

    const result = await resolveProductSuggestion({ name: "iPhone 15 Pro" });

    expect(result.name).toBe("iPhone 15 Pro");
    expect(result.description).toContain("Smartphone Apple");
    expect(externalSuggestionMock).not.toHaveBeenCalled();
  });

  it("grava a primeira sugestão e usa o cache na segunda chamada", async () => {
    const suggestion = {
      name: "Produto novo",
      category: "ELETRONICO",
      categoryLabel: "Eletrônico",
      shortDescription: "Descrição curta",
      description: "Descrição completa",
    };
    externalSuggestionMock.mockResolvedValue(suggestion);
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);

    await resolveProductSuggestion({ name: "Produto novo" });
    await resolveProductSuggestion({ name: "Produto novo" });

    expect(externalSuggestionMock).toHaveBeenCalledTimes(1);
  });
});
