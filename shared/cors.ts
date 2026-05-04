export function parseAllowedOrigins(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isRequestOriginAllowed({
  allowedOrigins,
  requestOrigin,
}: {
  allowedOrigins: string[];
  requestOrigin: string | null;
}): boolean {
  if (allowedOrigins.length === 0 || !requestOrigin) {
    return true;
  }

  return allowedOrigins.includes(requestOrigin);
}

export function resolveCorsAllowOrigin({
  allowedOrigins,
  requestOrigin,
}: {
  allowedOrigins: string[];
  requestOrigin: string | null;
}): string {
  if (requestOrigin) {
    return requestOrigin;
  }

  return allowedOrigins[0] ?? "*";
}
