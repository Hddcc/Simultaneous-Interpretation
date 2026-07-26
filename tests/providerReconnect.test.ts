import assert from "node:assert/strict";
import net from "node:net";

function serverFrame(opcode: number, payload: Buffer): Buffer {
  if (payload.length <= 125) {
    return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
  }
  const header = Buffer.alloc(4);
  header[0] = 0x80 | opcode;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

async function waitFor(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Timed out waiting for provider reconnect.");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function main(): Promise<void> {
  let connectionCount = 0;
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.once("data", () => {
      connectionCount += 1;
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n"
      );
      const started = Buffer.from(JSON.stringify({ header: { event: "task-started" } }));
      socket.write(serverFrame(0x1, started));
      if (connectionCount === 1) {
        socket.write(serverFrame(0x8, Buffer.alloc(0)));
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env.REALTIME_ASR_PROVIDER = "aliyun";
  process.env.REALTIME_ASR_BASE_URL = `ws://127.0.0.1:${address.port}/realtime`;
  process.env.DASHSCOPE_API_KEY = "test-key";

  const provider = await import("../electron/providerSession");
  await provider.startRealtimeProviderSession({
    sourceType: "system",
    languagePairId: "en-to-zh",
    sourceLanguageCode: "en-US",
    queue: { depth: 0, maxDepth: 12, dropped: 0, lastSequence: null, lastPayloadBytes: 0 }
  });

  await waitFor(() => connectionCount >= 2 && provider.getProviderHealth().session.state === "streaming");
  assert.equal(connectionCount, 2);
  provider.stopRealtimeProviderSession();
  sockets.forEach((socket) => socket.destroy());
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  console.log("provider reconnect checks passed");
}

void main();
