import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Keep the supplied standalone homepage isolated from the portal's CSS and
// React lifecycle so its ocean animation and scripts retain their behavior.
export const dynamic = "force-static";

export async function GET() {
  const html = await readFile(join(process.cwd(), "public", "landing.html"), "utf8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
