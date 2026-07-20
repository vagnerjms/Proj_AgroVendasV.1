#!/bin/bash
# ==============================================================================
# AgroVendas - Script de Implantação e Build Automático via GitHub na VPS
# ==============================================================================

set -e

echo "🚀 Iniciando Implantação do AgroVendas a partir do GitHub..."

# 1. Garantir arquivo SWAP para evitar estouro de memória (OOM) durante o build do Next.js
if [ $(free -m | grep -i swap | awk '{print $2}') -eq 0 ]; then
  echo "📦 Criando memória SWAP temporária de 2GB no servidor para garantir compilação sem falhas..."
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo "✅ SWAP ativada!"
fi

# 2. Atualizar código a partir do repositório remoto Git
echo "📥 Atualizando código a partir do Git..."
git pull || true

# 3. Garantir existência do arquivo .env
if [ ! -f .env ]; then
  echo "⚙️ Criando arquivo .env de produção..."
  SERVER_IP=$(curl -s ifconfig.me || echo "127.0.0.1")
  cat <<EOT > .env
APP_NAME=AgroVenda Broker
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/agrovenda_broker
MONGO_URI=mongodb://mongodb:27017/agrovenda_broker
JWT_SECRET=AgroVenda_2026_Secure_JWT_Token_Key_Secret!
JWT_EXPIRES_IN=8h
BACKEND_PORT=3001
FRONTEND_PORT=3000
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_BASICAUTH=true
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=AgroVenda2026!Secured
NEXT_PUBLIC_API_URL=http://${SERVER_IP}:3001
EOT
  echo "✅ Arquivo .env criado com IP: ${SERVER_IP}!"
fi

# 4. Limpar e reconstruir containers com Docker Compose
echo "🛠️ Construindo e iniciando containers Docker..."
docker compose down --remove-orphans || true
docker compose up -d --build

echo ""
echo "======================================================================"
echo "🎉 IMPLANTAÇÃO CONCLUÍDA COM SUCESSO!"
echo "======================================================================"
docker compose ps
