import { SimHost } from "./host";
import { Command, HostMessage } from "./protocol";

/** Web Worker girişi: simülasyon arayüzden ayrı bir iş parçacığında akar. */

interface WorkerScope {
  postMessage(message: HostMessage, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<Command>) => void) | null;
}

const scope = self as unknown as WorkerScope;
const host = new SimHost((message, transfer) => scope.postMessage(message, transfer ?? []));
scope.onmessage = (event) => host.handle(event.data);
scope.postMessage({ type: "ready" }, []);

let last = performance.now();
setInterval(() => {
  const t = performance.now();
  host.tick(t - last);
  last = t;
}, 16);
