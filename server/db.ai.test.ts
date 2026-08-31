import { describe, expect, it } from "vitest";
import { suggestProductInfo } from "./db.ai";

describe("suggestProductInfo", () => {
  it("recusa uma solicitação sem imagem e sem nome", async () => {
    await expect(suggestProductInfo({})).rejects.toThrow(
      "Envie uma imagem ou um nome para a IA sugerir os dados.",
    );
  });
});
