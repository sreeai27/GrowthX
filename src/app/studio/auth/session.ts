import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { StudioActor } from "../contacts/studio-contact-gateway";

export const studioSessionCookieName = "hunar_studio_session";
export const newStudioSessionToken = () => randomBytes(32).toString("base64url");
export const studioTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const actorSchema = z.object({ actorId: z.string(), role: z.enum(["OPERATOR", "PLATFORM_ADMIN"]), tenantId: z.string(), expiresAt: z.number() });
export function issueFixtureStudioSession(actor: StudioActor, secret: string) {
  const payload = Buffer.from(JSON.stringify({ ...actor, sessionToken: undefined, expiresAt: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function readFixtureStudioSession(value: string, secret: string): StudioActor | null {
  const [payload, supplied] = value.split("."); if (!payload || !supplied) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null;
  try { const actor = actorSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))); return actor.expiresAt > Date.now() ? { actorId: actor.actorId, role: actor.role, tenantId: actor.tenantId } : null; } catch { return null; }
}
