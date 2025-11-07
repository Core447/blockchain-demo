# Blockchain

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Start the peerjs server

If you want to run the peerjs server locally, follow these steps:

docs: https://github.com/peers/peerjs-server

```bash
peerjs --port 9000 --key peerjs --path /blockchain --allow_discovery
```

Otherwise, make sure to set these environment variables in your `.env`:
```
NEXT_PUBLIC_PEERJS_SERVER_IP=peerjs.blockchain.core447.com
NEXT_PUBLIC_PEERJS_SERVER_PORT=443
NEXT_PUBLIC_PEERJS_SERVER_SECURE=true
```