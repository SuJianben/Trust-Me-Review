import { describe, expect, it } from "vitest";
import { hmacHex, safeEqual, seal, sha256, sha256Bytes, unseal } from "../src/lib/crypto";
describe("crypto helpers", () => {
  it("hashes deterministically and compares values", async () => { expect(await sha256("review")).toBe(await sha256("review")); expect(safeEqual("abc","abc")).toBe(true); expect(safeEqual("abc","abd")).toBe(false); });
  it("encrypts invitation tokens for later test delivery", async () => { const cipher=await seal("single-use-token","a secure secret of at least 32 chars"); expect(cipher).not.toContain("single-use-token"); await expect(unseal(cipher,"a secure secret of at least 32 chars")).resolves.toBe("single-use-token"); });
  it("creates different HMACs for different data", async () => { expect(await hmacHex("secret","one")).not.toBe(await hmacHex("secret","two")); });
  it("hashes file bytes deterministically", async () => {
    const first = new TextEncoder().encode("review-upload").buffer;
    const second = new TextEncoder().encode("review-upload").buffer;
    expect(await sha256Bytes(first)).toBe(await sha256Bytes(second));
  });
});
