import { z } from "zod";

export {
  actionReceiptSchema,
  type ActionReceipt,
} from "../../domain/action-execution";
export type { BookingActionConnector } from "./booking-action";

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

export interface AnalyticsProvider {
  record(
    eventName: string,
    metadata: Readonly<Record<string, string>>,
  ): Promise<void>;
}
