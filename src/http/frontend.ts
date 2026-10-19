import { resolve, sep } from "node:path";

// Only the built frontend is public.
export async function serveFrontend(
  request: Request,
  root = resolve(import.meta.dir, "../../dist/frontend"),
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
      },
    });
  }

  let pathname: string;

  try {
    pathname = decodeURIComponent(
      new URL(request.url).pathname,
    );
  } catch {
    return new Response("Bad request", {
      status: 400,
    });
  }

  const base = resolve(root);

  const target = resolve(
    base,
    `.${pathname === "/" ? "/index.html" : pathname}`,
  );

  if (
    !target.startsWith(`${base}${sep}`) ||
    pathname.includes("\0")
  ) {
    return new Response("Not found", {
      status: 404,
    });
  }

  const file = Bun.file(target);

  if (!(await file.exists())) {
    return new Response("Not found", {
      status: 404,
    });
  }

  return new Response(
    request.method === "HEAD" ? null : file,
    {
      headers: {
        "Content-Type": file.type,

        "Cache-Control": pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",

        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
