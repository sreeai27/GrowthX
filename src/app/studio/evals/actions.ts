"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { promoteCorrection, runNamedEvaluations } from "../../../domain/named-evaluations";
import { createFileEvaluationGateway } from "../../../services/providers/evaluation-gateway";
import { reviewerCookieName, reviewerIsAuthorised, reviewerTokenHash } from "./auth";
const tenantId = "demo_sahaay_home_services";

export async function signInReviewer(data: FormData) {
  const token = String(data.get("reviewerToken") ?? "");
  const configured = process.env.STUDIO_REVIEWER_TOKEN;
  if (!configured || reviewerTokenHash(token) !== reviewerTokenHash(configured)) redirect("/studio/evals?error=access-denied");
  (await cookies()).set(reviewerCookieName, reviewerTokenHash(token), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/studio", maxAge: 60 * 60 });
  redirect("/studio/evals");
}
export async function runSuite() {
  const cookie = (await cookies()).get(reviewerCookieName)?.value;
  if (!reviewerIsAuthorised(cookie, process.env.STUDIO_REVIEWER_TOKEN)) redirect("/studio/evals?error=access-denied");
  const run = runNamedEvaluations({ tenantId });
  await createFileEvaluationGateway().saveRun(run);
  redirect("/studio/evals?ran=1");
}
export async function promoteExampleCorrection() {
  const cookie = (await cookies()).get(reviewerCookieName)?.value;
  if (!reviewerIsAuthorised(cookie, process.env.STUDIO_REVIEWER_TOKEN)) redirect("/studio/evals?error=access-denied");
  const testCase = promoteCorrection({ id: "REG_BALCONY_MAPPING_001", suite: "mapping", title: "Corrected balcony mapping", expected: "balcony_deep_cleaning", observed: "inside_cabinet_cleaning", criterion: "canonical task match" });
  await createFileEvaluationGateway().promote(tenantId, testCase);
  redirect("/studio/evals?promoted=1");
}
