import { CursorManager } from "../cursor-manager";
import { encodeAwarenessPayload } from "../protocol";

// Minimal mock of the WebSocketManager used by CursorManager
class MockWS {
  handlers: Set<(data: Uint8Array) => void> = new Set();

  onMessage(handler: (data: Uint8Array) => void) {
    this.handlers.add(handler);
    return { dispose: () => this.handlers.delete(handler) } as any;
  }

  send(_msg: Uint8Array) {
    // no-op for test
  }

  emit(data: Uint8Array) {
    for (const h of Array.from(this.handlers)) {
      try {
        h(data);
      } catch (e) {
        // swallow
      }
    }
  }
}

async function runTest() {
  const mockWs = new MockWS();

  // Instantiate CursorManager with mocked WS
  const cm = new CursorManager(mockWs as any);

  // Capture calls to renderCursor by monkeypatching the instance
  const captured: any[] = [];
  (cm as any).renderCursor = (state: any) => {
    captured.push(state);
  };

  // Build an awareness state and encode it
  const state = {
    userId: "test-user-1",
    email: "tester@example.com",
    cursor: { line: 3, character: 5 },
    selection: {
      anchor: { line: 3, character: 2 },
      active: { line: 3, character: 5 },
    },
  };

  const payload = encodeAwarenessPayload(state as any);

  // Emit the payload as if received from the server
  mockWs.emit(payload);

  // Small delay to allow synchronous handlers to run (they run synchronously)
  // Check that the captured renderCursor was invoked with correct payload
  if (captured.length === 0) {
    console.error("Test failed: renderCursor was not called");
    process.exit(1);
  }

  const received = captured[0];
  if (received.userId !== state.userId) {
    console.error(
      `Test failed: userId mismatch (expected=${state.userId} got=${received.userId})`,
    );
    process.exit(1);
  }

  if (!received.cursor || received.cursor.line !== 3 || received.cursor.character !== 5) {
    console.error("Test failed: cursor data mismatch", received.cursor);
    process.exit(1);
  }

  console.log("Test passed: CursorManager.handleIncoming + encodeAwarenessPayload flow works");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test runner crashed", err);
  process.exit(2);
});
