import { z } from "zod";

/**
 * 호스티드 버전의 defineAction을 대체하는 Route Handler 헬퍼.
 * POST JSON body를 zod 스키마로 검증하고, 결과를 JSON으로 반환합니다.
 * 사용법:
 *
 *   import { defineRoute } from "@/lib/route";
 *   export const dynamic = "force-dynamic";
 *   export const POST = defineRoute(z.object({ id: z.number() }), async (args) => {
 *     ...
 *     return { ok: true };
 *   });
 */
export function defineRoute<TReq extends z.ZodTypeAny>(
  requestSchema: TReq,
  handler: (args: z.infer<TReq>) => Promise<unknown>,
) {
  return async function POST(req: Request): Promise<Response> {
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_request", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    try {
      const result = await handler(parsed.data);
      return Response.json(result);
    } catch (error) {
      console.error("[api]", error);
      return Response.json({ error: "internal_error" }, { status: 500 });
    }
  };
}
