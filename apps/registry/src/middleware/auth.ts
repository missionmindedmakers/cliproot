import type { Context, Next } from "hono";
import type { AppContext } from "../app.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

// Store authenticated user on the request object via a WeakMap
// to avoid Hono typed context issues.
const requestUserMap = new WeakMap<Request, AuthUser>();

export function getAuthUser(c: Context): AuthUser | undefined {
  return requestUserMap.get(c.req.raw);
}

/**
 * Middleware that requires authentication on write endpoints when authRequired is true.
 * Uses BetterAuth's bearer plugin to validate session tokens from Authorization headers.
 * When authRequired is false, passes through without authentication (backward compat).
 */
export function requireAuth(ctx: AppContext) {
  return async (c: Context, next: Next) => {
    if (!ctx.config.authRequired) {
      return next();
    }

    const authHeader = c.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "unauthorized",
            message: "Authentication required. Provide a Bearer token.",
          },
        },
        401,
      );
    }

    // Use BetterAuth's API to validate the session from the bearer token.
    // The bearer plugin converts Authorization: Bearer <token> into a session lookup.
    const session = await ctx.auth.api.getSession({
      headers: new Headers({ authorization: authHeader }),
    });

    if (!session?.user) {
      return c.json(
        {
          error: {
            code: "unauthorized",
            message: "Invalid or expired token.",
          },
        },
        401,
      );
    }

    requestUserMap.set(c.req.raw, {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    return next();
  };
}
