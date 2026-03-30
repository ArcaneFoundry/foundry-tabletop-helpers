import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { makeConfig } from "./helpers.js";

const apps: Array<Awaited<ReturnType<typeof createServer>>> = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()?.close();
  }
});

describe("server auth and health", () => {
  it("allows /health without authentication and reports capabilities", async () => {
    const app = await createServer(makeConfig());
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      capabilities: {
        image: true,
        thumbnail: true,
        portrait: false,
        maxFileSize: 10 * 1024 * 1024,
      },
    });
  });

  it("rejects protected routes without authentication", async () => {
    const app = await createServer(makeConfig());
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/thumb/stats",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Missing or invalid authorization" });
  });

  it("accepts bearer authentication on protected routes", async () => {
    const app = await createServer(makeConfig());
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/thumb/stats",
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ count: 0, totalBytes: 0 });
  });

  it("rejects invalid bearer tokens", async () => {
    const app = await createServer(makeConfig());
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/thumb/stats",
      headers: {
        authorization: "Bearer nope",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Invalid token" });
  });

  it("accepts query-string authentication for thumbnail routes", async () => {
    const app = await createServer(makeConfig());
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/thumb/stats?token=test-token",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ count: 0, totalBytes: 0 });
  });

  it("reports portrait capability when Gemini is configured", async () => {
    const app = await createServer(makeConfig({ geminiApiKey: "configured" }));
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json().capabilities.portrait).toBe(true);
  });
});
