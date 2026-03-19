FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
ARG NEXT_PUBLIC_WS_URL=http://localhost:8080
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3001
ENV PORT=3001

CMD ["npm", "start"]
