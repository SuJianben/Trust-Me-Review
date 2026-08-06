const encoder = new TextEncoder();
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, "0")).join("");
}
export async function sha256Bytes(value: ArrayBuffer): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, "0")).join("");
}
export async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((item) => item.toString(16).padStart(2, "0")).join("");
}
export function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0; for (let index = 0; index < left.length; index++) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}
export async function randomToken(): Promise<string> { const data = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...data)).replace(/[+/=]/g, ""); }
async function cipherKey(secret: string) { const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(secret)); return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]); }
export async function seal(value: string, secret: string) { const iv=crypto.getRandomValues(new Uint8Array(12)); const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await cipherKey(secret),encoder.encode(value)); return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(encrypted)))}`; }
export async function unseal(value: string, secret: string) { const [iv,cipher]=value.split("."); if(!iv||!cipher) throw new Error("Invalid encrypted token"); const decoded=(input:string)=>Uint8Array.from(atob(input),(item)=>item.charCodeAt(0)); return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:decoded(iv)},await cipherKey(secret),decoded(cipher))); }
