FROM node:22-alpine
# Chrome deps for Puppeteer PDF export
ENV PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/uploads && addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3005/health | grep -q success
CMD ["node", "src/server.js"]
