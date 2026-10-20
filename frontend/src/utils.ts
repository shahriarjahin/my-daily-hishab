import type { Transaction } from "./types";
const dhakaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const day = (value: string | Date = new Date()) => {
  const p = Object.fromEntries(
    dhakaDate.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
};
export const dated = (value: string) => value + "T12:00:00+06:00";
export const total = (rows: Transaction[], type?: string) =>
  rows
    .filter((t) => !type || t.type === type)
    .reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;
export const palette = ["#e4a52f", "#e8684e", "#44bfc0", "#46ac82", "#aaa69d"];
export const walletLogo = (name: string) => {
  for (const [pattern, file] of [
    [/prime\s*now|প্রাইম\s*নাও/i, "primenow"],
    [/prime\s*bank|প্রাইম\s*ব্যাংক/i, "primebank"],
    [/b\s*kash|বিকাশ/i, "bkash"],
    [/city|সিটি/i, "city"],
    [/sonali|সোনালী|সোনালি/i, "sonali"],
    [/janata|জনতা/i, "janata"],
  ] as const)
    if (pattern.test(name)) return "/static/wallet-logos/" + file + ".png";
  return null;
};
