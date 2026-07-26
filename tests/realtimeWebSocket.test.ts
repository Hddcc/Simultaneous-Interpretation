import assert from "node:assert/strict";
import net from "node:net";
import { MinimalRealtimeWebSocket } from "../electron/providerSession";

function serverFrame(opcode: number, payload: Buffer, final = true): Buffer {
  const firstByte = (final ? 0x80 : 0) | opcode;
  if (payload.length <= 125) {
    return Buffer.concat([Buffer.from([firstByte, payload.length]), payload]);
  }
  const header = Buffer.alloc(4);
  header[0] = firstByte;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

async function main(): Promise<void> {
  const expectedMessage = JSON.stringify({ text: "x".repeat(300) });
  const bytes = Buffer.from(expectedMessage, "utf8");
  const server = net.createServer((socket) => {
    socket.once("data", () => {
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n"
      );
      socket.write(serverFrame(0x1, bytes.subarray(0, 150), false));
      socket.write(serverFrame(0x0, bytes.subarray(150), true));
      socket.write(serverFrame(0x8, Buffer.alloc(0)));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const client = new MinimalRealtimeWebSocket();
  const message = new Promise<string>((resolve) => client.once("message", resolve));
  const closed = new Promise<void>((resolve) => client.once("close", resolve));
  await client.connect({
    url: `ws://127.0.0.1:${address.port}/realtime`,
    headers: {},
    timeoutMs: 2_000
  });

  assert.equal(await message, expectedMessage);
  await closed;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  console.log("realtime websocket checks passed");
}

void main();
