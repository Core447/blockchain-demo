import { createMiddleware as createNemoMiddleware, type MiddlewareFunctionProps } from "@rescale/nemo"
import { NextResponse } from "next/server";

const middlewares = {
    '/':
        async ({ request }: MiddlewareFunctionProps) => {
            return NextResponse.redirect(new URL('/com', request.url));
        },
}

export const middleware = createNemoMiddleware(middlewares);

export const config = {
    matcher: ['/((?!_next/|_static|_vercel|assets|api/|[\\w-]+\\.\\w+).*)'],
};