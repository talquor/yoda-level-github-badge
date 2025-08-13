# -------- build stage --------
FROM node:20-alpine AS build
WORKDIR /app

# copy everything (simplest + robust when no lockfile)
COPY . .

# install deps, build Next, then prune dev deps
RUN npm install
RUN npm run build
RUN npm prune --omit=dev

# -------- runtime stage --------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# bring over built app + pruned node_modules
COPY --from=build /app /app

EXPOSE 3000
CMD ["npx","next","start","-H","0.0.0.0","-p","3000"]
