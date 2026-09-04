"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStudioContactGateway } from "../contacts/studio-contact-gateway";
import { env } from "../../../config/env";
import { issueFixtureStudioSession, newStudioSessionToken, studioSessionCookieName } from "./session";

export async function signInStudio(data: FormData) {
  const oneTimeToken = String(data.get("oneTimeToken") ?? "");
  const sessionToken = newStudioSessionToken();
  const session = oneTimeToken ? await getStudioContactGateway().consumeSignIn(oneTimeToken, sessionToken) : null;
  if (!session) redirect("/studio/sign-in?error=expired-or-invalid");
  let cookieValue = sessionToken;
  if (env.features.fixtureMode) {
    const actor = oneTimeToken === process.env.STUDIO_OPERATOR_TOKEN ? { actorId: "operator-neha", role: "OPERATOR" as const, tenantId: "demo_sahaay_home_services" } : oneTimeToken === process.env.STUDIO_ADMIN_MEERA_TOKEN ? { actorId: "admin-meera", role: "PLATFORM_ADMIN" as const, tenantId: "demo_sahaay_home_services" } : { actorId: "admin-kabir", role: "PLATFORM_ADMIN" as const, tenantId: "demo_sahaay_home_services" };
    cookieValue = issueFixtureStudioSession(actor, process.env.STUDIO_SESSION_SECRET ?? "fixture-only-studio-secret");
  }
  (await cookies()).set(studioSessionCookieName, cookieValue, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/studio", expires: new Date(session.expiresAt) });
  redirect("/studio/contacts");
}
