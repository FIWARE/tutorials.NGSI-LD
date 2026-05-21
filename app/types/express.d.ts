declare namespace Express {
    interface Locals {
        authorized?: boolean;
        session?: import('express-session').Session;
    }

    interface Request {
        session: import('express-session').Session &
            Partial<import('express-session').SessionData> & {
                access_token?: string;
                refresh_token?: string;
                id_token?: string;
                claims?: Record<string, unknown> | null;
                pkce_verifier?: string;
                oauth_state?: string;
                username?: string;
            };
    }
}

declare module 'express-session' {
    interface SessionData {
        access_token?: string;
        refresh_token?: string;
        id_token?: string;
        claims?: Record<string, unknown> | null;
        pkce_verifier?: string;
        oauth_state?: string;
        username?: string;
    }
}
