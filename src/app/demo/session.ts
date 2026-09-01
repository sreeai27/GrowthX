import "server-only";

import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import { env } from "../../config/env";
import { demoResumeExpiresAt, hashDemoToken } from "../../domain/demo-session";
import { getDemoSessionGateway } from "../../services/providers/demo-session-gateway";

export const DEMO_COOKIE_NAME = "hunar_demo_session";

interface BrowserCredential {
  publicRunId: string;
  privateToken: string;
}

const credentialPartsSchema = z.tuple([
  z.string().regex(/^run_[A-Za-z0-9_-]{8,}$/),
  z.string().min(32),
  z.string().min(1),
]);

function encodeCredential(credential: BrowserCredential): string {
  const payload = `${credential.publicRunId}.${credential.privateToken}`;
  return `${payload}.${sign(payload)}`;
}

function decodeCredential(value: string | undefined): BrowserCredential | null {
  if (!value) return null;
  const parsed = credentialPartsSchema.safeParse(value.split("."));
  if (!parsed.success) return null;
  const [publicRunId, privateToken, signature] = parsed.data;
  const expectedSignature = sign(`${publicRunId}.${privateToken}`);
  const supplied = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  return { publicRunId, privateToken };
}

function sign(payload: string): string {
  const secret = env.server.demoSessionCookieSecret;
  if (!secret || secret.length < 32) {
    throw new Error(
      "DEMO_SESSION_COOKIE_SECRET must contain at least 32 characters.",
    );
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createBrowserCredential(): BrowserCredential {
  return {
    publicRunId: `run_${randomUUID()}`,
    privateToken: randomBytes(32).toString("base64url"),
  };
}

export async function storeBrowserCredential(credential: BrowserCredential) {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE_NAME, encodeCredential(credential), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 60 * 60,
  });
}

export async function readBrowserCredential(): Promise<BrowserCredential | null> {
  const cookieStore = await cookies();
  return decodeCredential(cookieStore.get(DEMO_COOKIE_NAME)?.value);
}

export async function getActiveDemoRun() {
  const credential = await readBrowserCredential();
  if (!credential) return null;
  return getDemoSessionGateway().resume({
    publicRunId: credential.publicRunId,
    browserTokenHash: hashDemoToken(credential.privateToken),
    now: new Date().toISOString(),
  });
}

export function sessionStartInput(credential: BrowserCredential, now: Date) {
  return {
    publicRunId: credential.publicRunId,
    browserTokenHash: hashDemoToken(credential.privateToken),
    now: now.toISOString(),
    resumeExpiresAt: demoResumeExpiresAt(now),
  };
}
