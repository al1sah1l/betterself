export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
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

    throw new ApiError(response.status, code);
  }

  return data as T;
}
