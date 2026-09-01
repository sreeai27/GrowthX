import { restartDemoAction, startDemoAction } from "./actions";
import { DemoEntry } from "./demo-entry";
import { getActiveDemoRun } from "./session";

export default async function DemoPage() {
  const activeRun = await getActiveDemoRun();
  return (
    <DemoEntry
      activeRun={activeRun}
      startAction={startDemoAction}
      restartAction={restartDemoAction}
    />
  );
}
