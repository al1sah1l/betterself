
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

let currentSession = "";

export function getCurrentSession(): string {
  return currentSession;
}

export async function api<T>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  if (
    typeof payload.session === "string"
  ) {
    currentSession = payload.session;
  }

  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Could not connect to BetterSelf. Please try again.",
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "BetterSelf returned an unexpected response. Please try again.",
    );
  }

  if (!response.ok) {
    const code =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "INTERNAL_ERROR";

    throw new ApiError(
      response.status,
      code,
    );
  }

  if (
    path === "/auth/sign-out"
  ) {
    currentSession = "";
  }

  return data as T;
}

export async function uploadProofImage(
  session: string,
  file: File,
): Promise<string> {
  if (
    file.size > 5 * 1024 * 1024
  ) {
    throw new Error(
      "Image must be 5 MB or smaller.",
    );
  }

  const data = new FormData();

  data.append("session", session);
  data.append("image", file);

  let response: Response;

  try {
    response = await fetch(
      "/api/images/upload",
      {
        method: "POST",
        body: data,
      },
    );
  } catch {
    throw new Error(
      "Could not connect to image storage.",
    );
  }

  const result =
    await response.json() as {
      evidence?: string;
      error?: string;
    };

  if (
    !response.ok ||
    !result.evidence
  ) {
    throw new Error(
      result.error ??
        "Image upload failed.",
    );
  }

  return result.evidence;
}
