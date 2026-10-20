import bangla from "./locales/bn.json";
export type TranslationValues = Record<string, string | number>;
export function translate(
  text: string,
  language: string,
  values: TranslationValues = {},
): string {
  const dictionary = bangla as Record<string, string>;
  const output = language === "bn" ? dictionary[text] || text : text;
  return output.replace(/\{(\w+)\}/g, (token, key: string) => {
    const value = values[key];
    if (value === undefined) return token;
    return typeof value === "number"
      ? new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-US").format(
          value,
        )
      : value;
  });
}

// Provider names and technical IDs stay intact; known error explanations are localized.
export function translateError(text: string, language: string): string {
  if (language !== "bn") return text;
  const exact = translate(text, language);
  if (exact !== text) return exact;
  const fragments = [
    "AI import failed.",
    "Your records were not changed.",
    "Check Settings → AI connections; quota/key errors need a working provider, not repeated retries.",
    "model or API configuration rejected",
    "provider unavailable",
    "out of credit",
    "quota exceeded",
    "authentication failed",
    "request timed out",
    "rate limited",
    "invalid key",
  ];
  let output = text;
  for (const fragment of fragments)
    output = output.replaceAll(fragment, translate(fragment, language));
  return output;
}
