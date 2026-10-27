/**
 * fetch for our own /api routes. Clerk's session token is short-lived, so after a long idle (or a backgrounded phone tab)
 * the first call can come back 401. Reloading lets Clerk renew the session, then the user taps again.
 */
export async function apiFetch(input: string, init?: RequestInit) {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.location.reload();
    throw new Error("Your session expired. Refreshing...");
  }
  return res;
}
