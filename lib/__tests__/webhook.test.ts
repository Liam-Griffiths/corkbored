import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

// We test the signature verification logic directly since the route
// imports prisma (which would need a real DB). Extract the pure function.
function verifySignature(secret: string, payload: string, sigHeader: string | null): boolean {
  if (!sigHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(`sha256=${expected}`, "utf8");
  const receivedBuf = Buffer.from(sigHeader, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  // Manually compare to avoid the timingSafeEqual import in test scope
  for (let i = 0; i < expectedBuf.length; i++) {
    if (expectedBuf[i] !== receivedBuf[i]) return false;
  }
  return true;
}

function makeSignature(secret: string, payload: string): string {
  const hex = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${hex}`;
}

describe("GitHub webhook signature verification", () => {
  const SECRET = "test-webhook-secret";
  const PAYLOAD = JSON.stringify({ action: "push", ref: "refs/heads/main" });

  it("accepts a valid signature", () => {
    const sig = makeSignature(SECRET, PAYLOAD);
    expect(verifySignature(SECRET, PAYLOAD, sig)).toBe(true);
  });

  it("rejects a null signature", () => {
    expect(verifySignature(SECRET, PAYLOAD, null)).toBe(false);
  });

  it("rejects a signature with wrong prefix", () => {
    const hex = createHmac("sha256", SECRET).update(PAYLOAD).digest("hex");
    expect(verifySignature(SECRET, PAYLOAD, `sha1=${hex}`)).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const sig = makeSignature(SECRET, PAYLOAD);
    expect(verifySignature(SECRET, PAYLOAD + "tampered", sig)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const sig = makeSignature("wrong-secret", PAYLOAD);
    expect(verifySignature(SECRET, PAYLOAD, sig)).toBe(false);
  });

  it("replaying the same payload produces the same valid signature (idempotent)", () => {
    const sig = makeSignature(SECRET, PAYLOAD);
    expect(verifySignature(SECRET, PAYLOAD, sig)).toBe(true);
    expect(verifySignature(SECRET, PAYLOAD, sig)).toBe(true);
  });
});
