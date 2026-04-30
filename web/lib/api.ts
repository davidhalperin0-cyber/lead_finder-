const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function apiFetch(
  path: string,
  accessToken: string,
  init?: RequestInit
) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) return res.json();
  return res.text();
}
