import { getLlmsDocument } from "@/lib/llms-document";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  return new Response(await getLlmsDocument(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      Link: "</llms.txt>; rel=canonical",
    },
  });
}
