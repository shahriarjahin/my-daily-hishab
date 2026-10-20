import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { translate, translateError } from "./i18n";
import dictionary from "./locales/bn.json";

describe("Bangla interface", () => {
  it("covers every literal translation and form label", () => {
    const missing = new Set<string>();
    function scan(folder: string) {
      for (const item of readdirSync(folder, { withFileTypes: true })) {
        const file = join(folder, item.name);
        if (item.isDirectory()) scan(file);
        else if (file.endsWith(".tsx")) {
          const source = readFileSync(file, "utf8");
          for (const match of source.matchAll(/(?:\bt\(\s*|(?:label|title):\s*)"([^"\n]+)"/g)) {
            if (!(match[1] in dictionary)) missing.add(match[1]);
          }
        }
      }
    }
    scan(join(process.cwd(), "src"));
    expect([...missing]).toEqual([]);
  });
  it("preserves interpolation fields throughout the catalog", () => {
    for (const [key, value] of Object.entries(dictionary)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
      expect(value.match(/\{\w+\}/g)?.sort() || [], key).toEqual(key.match(/\{\w+\}/g)?.sort() || []);
    }
  });
  it("localizes counts while preserving user text and English mode", () => {
    expect(translate("{count} entries", "bn", { count: 12 })).toBe("১২টি এন্ট্রি");
    expect(translate("Edit {name}", "bn", { name: "My Bank" })).toBe("My Bank সম্পাদনা");
    expect(translate("My own category", "bn")).toBe("My own category");
    expect(translate("{count} entries", "en", { count: 12 })).toBe("12 entries");
  });
  it("translates provider explanations without changing the provider name", () => {
    expect(translateError("AI import failed. OpenAI: out of credit; Your records were not changed.", "bn")).toBe("এআই আমদানি ব্যর্থ হয়েছে। OpenAI: ক্রেডিট শেষ; আপনার হিসাব বদলানো হয়নি।");
    expect(translateError("Unknown server detail 42", "bn")).toBe("Unknown server detail 42");
  });
});
