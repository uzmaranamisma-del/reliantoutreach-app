import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
function key() {
  const value = process.env.ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error("ENCRYPTION_KEY must contain 32 bytes in hex");
  return Buffer.from(value, "hex");
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64url");
}
export function decrypt(value: string) {
  const data = Buffer.from(value, "base64url");
  const cipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    cipher.update(data.subarray(12, -16)),
    cipher.final(),
  ]).toString("utf8");
}
export function secretMatches(a: string, b: string) {
  return (
    !!a && !!b && timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)))
  );
}
