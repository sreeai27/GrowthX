"use server";
import { redirect } from "next/navigation";
import { promoteCorrection, runNamedEvaluations } from "../../../domain/named-evaluations";
import { createFileEvaluationGateway } from "../../../services/providers/evaluation-gateway";
import { requireStudioActor } from "../auth/current-actor";
const tenantId = "demo_sahaay_home_services";

export async function runSuite() {
  await requireStudioActor();
  const run = runNamedEvaluations({ tenantId });
  await createFileEvaluationGateway().saveRun(run);
  redirect("/studio/evals?ran=1");
}
export async function promoteExampleCorrection() {
  await requireStudioActor();
  const testCase = promoteCorrection({ id: "REG_BALCONY_MAPPING_001", suite: "mapping", title: "Corrected balcony mapping", expected: "balcony_deep_cleaning", observed: "inside_cabinet_cleaning", criterion: "canonical task match" });
  await createFileEvaluationGateway().promote(tenantId, testCase);
  redirect("/studio/evals?promoted=1");
}
