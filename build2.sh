PART=$1; TARGET=$2
cp "$TARGET" /tmp/fe_snap.jsx 2>/dev/null
fail() { echo "❌ $1 — повтори: bash build2.sh $PART $TARGET"; cp /tmp/fe_snap.jsx "$TARGET" 2>/dev/null; exit 1; }
echo "===== $PART → $TARGET ====="
node openrouter.js --save resp$PART.md @prompt$PART.md "$TARGET" src/firebase.js api_backend.txt || fail "запрос упал"
node extract.js resp$PART.md /tmp/chunk_$PART.jsx || fail "не извлёкся код"
cp /tmp/chunk_$PART.jsx "$TARGET"
echo "✅ $PART готов: $TARGET"
