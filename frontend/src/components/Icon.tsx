const paths: Record<string, string> = {
  home: "M3 10 12 3l9 7v10H3z M9 20v-7h6v7",
  history: "M5 3h14v18H5z M8 8h8M8 12h8M8 16h5",
  plus: "M12 5v14M5 12h14",
  insights: "M4 20V5M4 20h17M8 16V11M13 16V7M18 16V3",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  wallet: "M20 7V4H6a3 3 0 0 0 0 6h15v10H6a3 3 0 0 1-3-3V7M21 12h-6v5h6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  "wallet-add": "M14 4H6a3 3 0 0 0 0 6h15v10H6a3 3 0 0 1-3-3V7M21 13h-6v4h6M19 1v6m-3-3h6",
  transfer: "M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4",
  loans: "M3 9h18L12 3 3 9zm2 3v7m7-7v7m7-7v7M3 22h18",
  filter: "M3 6h18M6 12h12M9 18h6",
  close: "m6 6 12 12M6 18 18 6",
  down: "M12 4v16m-6-6 6 6 6-6",
  up: "M12 20V4m-6 6 6-6 6 6",
  check: "m5 12 4 4L19 6",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15",
  edit: "m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z",
  food: "M4 3v7m3-7v7M3 10h5M5 10v11M18 3v18m0-18c-5 3-5 10 0 10",
  salary: "M2 5h20v14H2zM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  transport: "M5 3h14v16H5zM5 11h14M8 19v3m8-3v3M8 15h1m6 0h1",
  savings: "M4 9a8 8 0 0 1 15 0l3 1v5l-3 1-1 5h-3l-1-3h-4l-1 3H6l-1-5-3-2v-4z",
  business: "M3 7h18v14H3zM8 7V3h8v4M3 12h18",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  other: "M5 12h1m5 0h1m5 0h1",
  utilities: "m13 2-9 12h7l-1 8 10-13h-8z",
  shopping: "M4 7h16l1 14H3zM8 8V6a4 4 0 0 1 8 0v2",
};
// Twelve evenly spaced teeth, with a clear circular centre at small sizes.
const gear =
  Array.from({ length: 48 }, (_, i) => {
    const angle = (i * Math.PI) / 24 - Math.PI / 2,
      r = i % 4 === 0 || i % 4 === 3 ? 10 : 8;
    return `${i ? "L" : "M"}${12 + Math.cos(angle) * r},${12 + Math.sin(angle) * r}`;
  }).join(" ") + "Z";
export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={name === "settings" ? gear : paths[name] || paths.other} />
      {name === "settings" && <circle cx="12" cy="12" r="3.1" />}
    </svg>
  );
}
