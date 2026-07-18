/**
 * Turns a raw error into a short, plain-English message safe to show a user.
 * Rewrites known raw Postgres/network/auth patterns that leak internal
 * detail (constraint names, SQL, table names); everything else is assumed
 * to already be human-written (Supabase Auth messages, our own thrown
 * errors) and passes through as-is. Only falls back to `fallback` when
 * there's no message to show at all.
 */
export function friendlyErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  const msg = raw.toLowerCase();

  if (msg.includes("duplicate key") || msg.includes("already exists")) {
    return "That already exists. Please use a different value.";
  }
  if (msg.includes("row-level security") || msg.includes("permission denied")) {
    return "You don't have permission to do that.";
  }
  if (msg.includes("violates foreign key")) {
    return "This can't be completed because it's linked to other records.";
  }
  if (msg.includes("violates not-null") || msg.includes("null value in column")) {
    return "Please fill in all required fields.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (msg.includes("user already registered") || msg.includes("already been registered")) {
    return "An account with that email already exists.";
  }
  if (msg.includes("jwt") || msg.includes("refresh_token") || (msg.includes("session") && msg.includes("expired"))) {
    return "Your session has expired. Please sign in again.";
  }
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed")) {
    return "Couldn't connect. Please check your internet connection and try again.";
  }

  return raw.trim() || fallback;
}
