FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8082 19000 19001 19002
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "8082"]
