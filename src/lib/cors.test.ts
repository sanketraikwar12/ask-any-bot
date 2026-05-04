import { describe, expect, it } from "vitest";
import {
  isRequestOriginAllowed,
  parseAllowedOrigins,
  resolveCorsAllowOrigin,
} from "../../shared/cors.ts";

describe("parseAllowedOrigins", () => {
  it("trims and filters empty origin entries", () => {
    expect(parseAllowedOrigins(" https://app.example.com, ,https://admin.example.com ")).toEqual(
      ["https://app.example.com", "https://admin.example.com"],
    );
  });
});

describe("isRequestOriginAllowed", () => {
  it("rejects browser origins that are not on the allowlist", () => {
    expect(
      isRequestOriginAllowed({
        allowedOrigins: ["https://app.example.com"],
        requestOrigin: "https://evil.example.com",
      }),
    ).toBe(false);
  });

  it("allows requests without an origin header for server-to-server callers", () => {
    expect(
      isRequestOriginAllowed({
        allowedOrigins: ["https://app.example.com"],
        requestOrigin: null,
      }),
    ).toBe(true);
  });
});

describe("resolveCorsAllowOrigin", () => {
  it("echoes the requesting origin when it is allowed", () => {
    expect(
      resolveCorsAllowOrigin({
        allowedOrigins: ["https://app.example.com"],
        requestOrigin: "https://app.example.com",
      }),
    ).toBe("https://app.example.com");
  });

  it("echoes the requesting origin for rejected requests so browsers can read the 403 response", () => {
    expect(
      resolveCorsAllowOrigin({
        allowedOrigins: ["https://app.example.com"],
        requestOrigin: "https://evil.example.com",
      }),
    ).toBe("https://evil.example.com");
  });

  it("falls back to a wildcard when no allowlist is configured", () => {
    expect(
      resolveCorsAllowOrigin({
        allowedOrigins: [],
        requestOrigin: null,
      }),
    ).toBe("*");
  });
});
