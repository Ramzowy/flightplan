# FlightPlan web (Next.js App Router BFF). Multi-stage, standalone output.
# Requires `output: "standalone"` in next.config.ts.

FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_DEMO_MODE=true
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/ is optional in the source tree; make sure it exists for the runner COPY.
RUN mkdir -p public && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ARG NEXT_PUBLIC_DEMO_MODE=true
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup --system --gid 10001 nodejs \
    && adduser --system --uid 10001 --ingroup nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
