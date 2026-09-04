"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { StudioActor } from "../contacts/studio-contact-gateway";
import { issueStudioSession, studioSessionCookieName } from "./session";

const candidates: Array<{ env: string; actor: StudioActor }> = [
  { env: "STUDIO_OPERATOR_TOKEN", actor: { actorId: "operator-neha", role: "OPERATOR", tenantId: "demo_sahaay_home_services" } },
  { env: "STUDIO_ADMIN_MEERA_TOKEN", actor: { actorId: "admin-meera", role: "PLATFORM_ADMIN", tenantId: "demo_sahaay_home_services" } },
  { env: "STUDIO_ADMIN_KABIR_TOKEN", actor: { actorId: "admin-kabir", role: "PLATFORM_ADMIN", tenantId: "demo_sahaay_home_services" } },
];

function equalToken(a: string, b: string) { const left = createHash("sha256").update(a).digest(); const right = createHash("sha256").update(b).digest(); return timingSafeEqual(left, right); }

export async function signInStudio(data: FormData) {
  const token = String(data.get("oneTimeToken") ?? "");
  const match = candidates.find(({ env }) => process.env[env] && equalToken(token, process.env[env]!));
  if (!match) redirect("/studio/sign-in?error=expired-or-invalid");
  const secret = process.env.STUDIO_SESSION_SECRET;
  if (!secret) redirect("/studio/sign-in?error=not-configured");
  (await cookies()).set(studioSessionCookieName, issueStudioSession(match.actor, secret), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/studio", maxAge: 8 * 60 * 60 });
  redirect("/studio/contacts");
}
