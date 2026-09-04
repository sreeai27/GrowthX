import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readStudioSession, studioSessionCookieName } from "./session";

export async function requireStudioActor() {
  const secret = process.env.STUDIO_SESSION_SECRET;
  const actor = secret ? readStudioSession((await cookies()).get(studioSessionCookieName)?.value, secret) : null;
  if (!actor) redirect("/studio/sign-in");
  return actor;
}
