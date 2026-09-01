import { z } from "zod";

export const speechTranscriptSchema = z.object({
  text: z.string().min(1),
  language: z.string().min(2),
  providerModelId: z.string().min(1),
});
export type SpeechTranscript = z.infer<typeof speechTranscriptSchema>;

export interface SpeechProvider {
  transcribe(audio: ArrayBuffer): Promise<SpeechTranscript>;
}

export const taskCandidateSchema = z.object({
  taskId: z.string().min(1),
  label: z.string().min(1),
});
export type TaskCandidate = z.infer<typeof taskCandidateSchema>;

export interface TaskMappingProvider {
  mapReport(report: string): Promise<readonly TaskCandidate[]>;
}

export const storedObjectSchema = z.object({ storageKey: z.string().min(1) });
export type StoredObject = z.infer<typeof storedObjectSchema>;

export interface StorageProvider {
  store(data: ArrayBuffer, contentType: string): Promise<StoredObject>;
}

export const actionReceiptSchema = z.object({
  receiptId: z.string().min(1),
  completedAtUtc: z.string().datetime({ offset: true }),
});
export type ActionReceipt = z.infer<typeof actionReceiptSchema>;

export interface ActionProvider {
  execute(authorizationId: string): Promise<ActionReceipt>;
}

export interface AnalyticsProvider {
  record(
    eventName: string,
    metadata: Readonly<Record<string, string>>,
  ): Promise<void>;
}
