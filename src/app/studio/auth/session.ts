import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { StudioActor } from "../contacts/studio-contact-gateway";

export const studioSessionCookieName = "hunar_studio_session";
const payloadSchema = z.object({ actorId: z.string().min(1), role: z.enum(["OPERATOR", "PLATFORM_ADMIN"]), tenantId: z.string().min(1), expiresAt: z.number().int() });

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function issueStudioSession(actor: StudioActor, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...actor, expiresAt: now + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function readStudioSession(cookie: string | undefined, secret: string, now = Date.now()): StudioActor | null {
  if (!cookie) return null;
  const [payload, supplied, extra] = cookie.split(".");
  if (!payload || !supplied || extra) return null;
  const expected = signature(payload, secret);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const parsed = payloadSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return parsed.expiresAt > now ? { actorId: parsed.actorId, role: parsed.role, tenantId: parsed.tenantId } : null;
  } catch { return null; }
}
