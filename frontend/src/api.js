let csrfToken;
let csrfRequest;

export function resetCsrf() {
  csrfToken = undefined;
  csrfRequest = undefined;
}

async function token() {
  if (csrfToken) return csrfToken;
  csrfRequest ||= fetch("/api/csrf-token", { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok)
        throw new Error(
          "Unable to establish a secure session. Please try again.",
        );
      csrfToken = (await response.json()).csrfToken;
      return csrfToken;
    })
    .finally(() => {
      csrfRequest = undefined;
    });
  return csrfRequest;
}

export async function api(
  url,
  { method = "GET", body, signal } = {},
  retry = true,
) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD"].includes(method))
    headers["X-CSRF-Token"] = await token();
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: "same-origin",
      signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Could not reach the server. Check your connection and try again.",
    );
  }
  const data = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : {};
  if (response.status === 403 && data.error === "Invalid CSRF token" && retry) {
    resetCsrf();
    return api(url, { method, body, signal }, false);
  }
  if (!response.ok) {
    const error = new Error(
      data.error ||
        (response.status === 429
          ? "Too many requests. Please wait a moment and try again."
          : "This request could not be completed."),
    );
    error.status = response.status;
    throw error;
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}
