FUNC=$1; PROMPT=$2
SRC=functions/index.solana.js
BACKUP=/tmp/backup_$(date +%s).js
cp "$SRC" "$BACKUP"
fail() { echo "❌ $1"; cp "$BACKUP" "$SRC"; exit 1; }
cp /tmp/func_$FUNC.js ./ctx_$FUNC.js 2>/dev/null || true
[ -f ./ctx_$FUNC.js ] || fail "нет контекста ctx_$FUNC.js"
node openrouter.js --save resp_$FUNC.md "$PROMPT" ctx_$FUNC.js || fail "запрос упал"
node extract.js resp_$FUNC.md new_$FUNC.js || fail "не извлёкся код"
LINES=$(wc -l < new_$FUNC.js)
if [ "$LINES" -gt 300 ]; then fail "модель вернула слишком много ($LINES строк)"; fi
START=$(grep -n "^/\*\* $FUNC\." "$SRC" | head -1 | cut -d: -f1)
[ -z "$START" ] && fail "не найдена секция $FUNC"
NEXT=$(grep -n "^/\*\* [0-9]" "$SRC" | awk -F: -v s="$START" '$1 > s {print $1; exit}')
if [ -z "$NEXT" ]; then NEXT=$(wc -l < "$SRC"); NEXT=$((NEXT+1)); fi
END=$((NEXT-1))
echo "Замена строк $START..$END"
head -$((START-1)) "$SRC" > patched.js
cat new_$FUNC.js >> patched.js
tail -n +$((END+1)) "$SRC" >> patched.js
mv patched.js "$SRC"
node --check "$SRC" || fail "синтаксис сломан"
echo "✅ Секция $FUNC заменена"
