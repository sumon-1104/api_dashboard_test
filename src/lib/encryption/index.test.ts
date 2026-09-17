import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt, maskApiKey } from "./index";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("encrypt/decrypt", () => {
  it("round-trips a plaintext API key", () => {
    const plaintext = "sk-ant-admin01-super-secret-key-value";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encrypt("same-plaintext");
    const b = encrypt("same-plaintext");
    expect(a).not.toBe(b);
  });

  it("throws when the auth tag doesn't match (tampered ciphertext)", () => {
    const ciphertext = encrypt("secret");
    const [iv, tag, body] = ciphertext.split(".");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(".");
    expect(() => decrypt(tampered)).toThrow();
    void body;
  });
});

describe("maskApiKey", () => {
  it("keeps a short prefix and suffix, masking the middle", () => {
    expect(maskApiKey("sk-ant-admin01-abcdefghijklmnop")).toBe("sk-ant••••••••mnop");
  });

  it("fully masks very short keys", () => {
    expect(maskApiKey("short")).toBe("••••••••");
  });
});
