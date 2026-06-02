FROM node:23-slim

WORKDIR /app

# Копируем манифесты зависимостей
COPY package.json package-lock.json ./

# Устанавливаем зависимости (offline-режим совместим с npm 11)
RUN npm install --prefer-offline --no-audit --no-fund

# Копируем исходный код
COPY . .

EXPOSE 4200
