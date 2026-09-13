PART=$1
cp functions/index.solana.js /tmp/aof_snapshot.js 2>/dev/null
fail() { echo "❌ $1 — повтори: bash build.sh $PART"; cp /tmp/aof_snapshot.js functions/index.solana.js 2>/dev/null; exit 1; }
echo "===== ЧАСТЬ $PART ====="
if [ "$PART" = "A" ]; then
  node openrouter.js --save respA.md @promptA.md solana/aofClient.ts solCore.js || fail "запрос упал"
  node extract.js respA.md functions/index.solana.js || fail "не извлёкся код"
else
  node openrouter.js --save resp$PART.md @prompt$PART.md functions/index.solana.js solCore.js || fail "запрос упал"
  node extract.js resp$PART.md part$PART.js || fail "не извлёкся код"
  cat part$PART.js >> functions/index.solana.js
fi
node --check functions/index.solana.js || fail "синтаксис сломан"
echo "✅ Часть $PART готова"
