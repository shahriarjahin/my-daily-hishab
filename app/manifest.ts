export default function manifest() {
  return {
    name: "Hishab",
    short_name: "Hishab",
    description: "Track wallets, expenses and budgets with AI-assisted entry.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1512",
    theme_color: "#0d3526",
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
