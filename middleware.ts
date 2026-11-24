// Next.js middleware configuration ensuring static assets and icons bypass any auth guards
export function middleware(request: { nextUrl: { pathname: string } }) {
  const publicPaths = [
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/icon-512.png",
    "/manifest.webmanifest",
    "/manifest.json",
  ];
  return;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|apple-touch-icon-precomposed.png|icon-512.png|manifest.webmanifest|manifest.json).*)",
  ],
};
