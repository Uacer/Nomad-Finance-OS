const crypto = require("node:crypto");

function getSecret() {
  const raw = process.env.CREDENTIAL_SECRET || "nomad-finance-os-dev-secret";
  return crypto.createHash("sha256").update(raw).digest();
}

function encryptText(plain) {
  const key = getSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), ciphertext.toString("base64"), tag.toString("base64")].join(".");
}

function decryptText(encoded) {
  const [ivB64, ciphertextB64, tagB64] = String(encoded).split(".");
  if (!ivB64 || !ciphertextB64 || !tagB64) {
    throw new Error("Invalid encrypted payload format.");
  }
  const key = getSecret();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

function maskSecret(secret) {
  const plain = String(secret || "");
  if (plain.length <= 4) {
    return plain;
  }
  return `${"*".repeat(Math.max(0, plain.length - 4))}${plain.slice(-4)}`;
}

module.exports = {
  encryptText,
  decryptText,
  maskSecret
};
