import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStudioContactGateway } from "../contacts/studio-contact-gateway";
import { env } from "../../../config/env";
import { readFixtureStudioSession, studioSessionCookieName } from "./session";

export async function requireStudioActor() {
  const token = (await cookies()).get(studioSessionCookieName)?.value;
  const actor = token ? env.features.fixtureMode ? readFixtureStudioSession(token, process.env.STUDIO_SESSION_SECRET ?? "fixture-only-studio-secret") : await getStudioContactGateway().getSession(token) : null;
  if (!actor) redirect("/studio/sign-in");
  return { ...actor, sessionToken: token! };
}
