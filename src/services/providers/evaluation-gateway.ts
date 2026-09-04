import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { namedEvalCaseSchema, namedEvalRunSchema, type NamedEvalCase, type NamedEvalRun } from "../../domain/named-evaluations";

const storeSchema = z.object({ runs: z.array(namedEvalRunSchema), promotedCases: z.array(namedEvalCaseSchema) });
type Store = z.infer<typeof storeSchema>;
const emptyStore: Store = { runs: [], promotedCases: [] };

export interface EvaluationGateway {
  saveRun(run: NamedEvalRun): Promise<void>;
  latestRun(tenantId: string): Promise<NamedEvalRun | null>;
  promote(tenantId: string, testCase: NamedEvalCase): Promise<void>;
  promoted(tenantId: string): Promise<NamedEvalCase[]>;
}

export function createFileEvaluationGateway(path = ".demo-fixture/eval-runs.json"): EvaluationGateway {
  const absolute = resolve(path);
  async function read(): Promise<Store> {
    try { return storeSchema.parse(JSON.parse(await readFile(absolute, "utf8"))); } catch { return emptyStore; }
  }
  async function write(store: Store) { await mkdir(dirname(absolute), { recursive: true }); await writeFile(absolute, JSON.stringify(store), "utf8"); }
  return {
    async saveRun(run) { const store = await read(); await write({ ...store, runs: [...store.runs.filter((item) => item.runKey !== run.runKey), run] }); },
    async latestRun(tenantId) { return (await read()).runs.filter((run) => run.tenantId === tenantId).at(-1) ?? null; },
    async promote(tenantId, testCase) { const store = await read(); await write({ ...store, promotedCases: [...store.promotedCases.filter((item) => `${tenantId}:${item.id}` !== `${tenantId}:${testCase.id}`), { ...testCase, id: `${tenantId}:${testCase.id}` }] }); },
    async promoted(tenantId) { return (await read()).promotedCases.filter((item) => item.id.startsWith(`${tenantId}:`)).map((item) => ({ ...item, id: item.id.slice(tenantId.length + 1) })); },
  };
}
