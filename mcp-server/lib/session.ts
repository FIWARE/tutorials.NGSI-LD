// The caller's identity for one tool call. Broker calls in ngsi-ld.ts have no request
// context, so this rides an AsyncLocalStorage instead of being threaded through every endpoint.

import { AsyncLocalStorage } from 'node:async_hooks';

export interface Session extends Record<string, unknown> {
    token: string;
    sub: string;
    username: string;
    roles: string[];
    scopes: string[];
}

const store = new AsyncLocalStorage<Session>();

export function currentSession(): Session | undefined {
    return store.getStore();
}

export function currentToken(): string | undefined {
    return store.getStore()?.token;
}

// Wraps a fastmcp handler so `context.session` is in scope for the whole call,
// including the broker fetches it triggers.
export function withSession<A, C extends { session?: Session | undefined }, R>(
    handler: (args: A, context: C) => Promise<R>
): (args: A, context: C) => Promise<R> {
    return (args, context) => {
        const session = context?.session;
        return session ? store.run(session, () => handler(args, context)) : handler(args, context);
    };
}

// Same, for a resource `load()` callback — fastmcp passes the session as the first
// argument there, not on a context object.
export function withSessionLoad<R>(handler: () => Promise<R>): (session?: Session | undefined) => Promise<R> {
    return (session) => (session ? store.run(session, handler) : handler());
}
