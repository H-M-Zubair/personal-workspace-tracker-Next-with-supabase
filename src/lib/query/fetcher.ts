export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const payload = await response.json();

  if (!payload.success) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload.data as T;
}

export async function apiMutate<T>(url: string, init: RequestInit): Promise<T> {
  return apiFetch<T>(url, init);
}
