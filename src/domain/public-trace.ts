import { z } from "zod";

const publicSourceSchema = z.object({
  id: z.string().min(1).max(120),
  version: z.string().min(1).max(80),
}).strict();

const publicVersionsSchema = z.object({
  model: z.string().min(1).max(120).optional(),
  flow: z.string().min(1).max(120),
  prompt: z.string().min(1).max(120).optional(),
}).strict();

const publicApprovalSchema = z.object({
  state: z.enum(["NOT_REQUIRED", "PENDING", "APPROVED", "DECLINED", "EXPIRED"]),
  approvedBy: z.enum(["CUSTOMER", "WORKER", "REVIEWER"]).optional(),
}).strict();

const publicReceiptSchema = z.object({
  state: z.enum(["NOT_ATTEMPTED", "SUCCEEDED", "FAILED", "VERIFIED"]),
  reference: z.string().min(1).max(120).optional(),
}).strict();

const publicMetricsSchema = z.object({
  latencyMs: z.number().int().nonnegative().optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  estimatedCostMinor: z.number().int().nonnegative().optional(),
}).strict();

export const publicTraceStageSchema = z.object({
  sequence: z.number().int().positive(),
  label: z.string().min(1).max(120),
  actor: z.enum(["WORKER", "CUSTOMER", "SYSTEM", "MODEL", "CONNECTOR", "REVIEWER"]),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "ABSTAINED", "ESCALATED"]),
  summary: z.string().min(1).max(280),
  source: publicSourceSchema.optional(),
  versions: publicVersionsSchema.optional(),
  approval: publicApprovalSchema.optional(),
  receipt: publicReceiptSchema.optional(),
  metrics: publicMetricsSchema.optional(),
}).strict();

export const publicTraceSchema = z.object({
  traceId: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  outcome: z.string().min(1).max(240),
  scenario: z.enum(["TASK_CONFIRM", "RIDE_REPLAY"]),
  stages: z.array(publicTraceStageSchema).min(1),
}).strict();

export type PublicTrace = z.infer<typeof publicTraceSchema>;

const internalTraceStageSchema = z.object({
  sequence: publicTraceStageSchema.shape.sequence,
  label: publicTraceStageSchema.shape.label,
  actor: publicTraceStageSchema.shape.actor,
  status: publicTraceStageSchema.shape.status,
  summary: publicTraceStageSchema.shape.summary,
  source: publicSourceSchema.passthrough().optional(),
  versions: publicVersionsSchema.passthrough().optional(),
  approval: publicApprovalSchema.passthrough().optional(),
  receipt: publicReceiptSchema.passthrough().optional(),
  metrics: publicMetricsSchema.passthrough().optional(),
}).passthrough();
const internalTraceSchema = z.object({
  traceId: z.string(),
  title: z.string(),
  outcome: z.string(),
  scenario: z.enum(["TASK_CONFIRM", "RIDE_REPLAY"]),
  stages: z.array(internalTraceStageSchema),
}).passthrough();

export function projectPublicTrace(input: unknown): PublicTrace {
  const internal = internalTraceSchema.parse(input);
  return publicTraceSchema.parse({
    traceId: internal.traceId,
    title: internal.title,
    outcome: internal.outcome,
    scenario: internal.scenario,
    stages: internal.stages
      .map((stage) => ({
        sequence: stage.sequence,
        label: stage.label,
        actor: stage.actor,
        status: stage.status,
        summary: stage.summary,
        ...(stage.source ? { source: { id: stage.source.id, version: stage.source.version } } : {}),
        ...(stage.versions ? { versions: {
          ...(stage.versions.model ? { model: stage.versions.model } : {}),
          flow: stage.versions.flow,
          ...(stage.versions.prompt ? { prompt: stage.versions.prompt } : {}),
        } } : {}),
        ...(stage.approval ? { approval: {
          state: stage.approval.state,
          ...(stage.approval.approvedBy ? { approvedBy: stage.approval.approvedBy } : {}),
        } } : {}),
        ...(stage.receipt ? { receipt: {
          state: stage.receipt.state,
          ...(stage.receipt.reference ? { reference: stage.receipt.reference } : {}),
        } } : {}),
        ...(stage.metrics ? { metrics: {
          ...(stage.metrics.latencyMs !== undefined ? { latencyMs: stage.metrics.latencyMs } : {}),
          ...(stage.metrics.inputTokens !== undefined ? { inputTokens: stage.metrics.inputTokens } : {}),
          ...(stage.metrics.outputTokens !== undefined ? { outputTokens: stage.metrics.outputTokens } : {}),
          ...(stage.metrics.estimatedCostMinor !== undefined ? { estimatedCostMinor: stage.metrics.estimatedCostMinor } : {}),
        } } : {}),
      }))
      .sort((left, right) => left.sequence - right.sequence),
  });
}
