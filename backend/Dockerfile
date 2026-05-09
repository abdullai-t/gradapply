# Build from monorepo root: `docker build -f backend/Dockerfile .`
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile --filter @gradapply/backend...

COPY backend ./backend

WORKDIR /app/backend
RUN pnpm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
