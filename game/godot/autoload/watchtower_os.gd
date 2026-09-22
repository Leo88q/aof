extends Node
## Watchtower OS v3 client autoload (game_id aof, network stage/prototype).
## Config source of truth: GET /api/os/config (33 components) + GET /api/sdk/*?gameId=aof.

const GAME_ID := "aof"
const OS_API := "http://127.0.0.1:8787"  # set WATCHTOWER_OS_URL in production

func config() -> Dictionary:
	return _get("/api/os/config")

func sdk(id: String) -> Dictionary:
	return _get("/api/sdk/%s?gameId=%s" % [id, GAME_ID])

func asset_strategy(item_type: String, rarity: String) -> Dictionary:
	return _get("/api/assets/strategy?gameId=%s&itemType=%s&rarity=%s" % [GAME_ID, item_type, rarity])

func control_panels() -> Dictionary:
	return _get("/api/os/control-panels?gameId=%s" % GAME_ID)

func handoff() -> Dictionary:
	return _get("/api/os/handoff?gameId=%s" % GAME_ID)

func _get(path: String) -> Dictionary:
	var http := HTTPRequest.new()
	add_child(http)
	var err := http.request(OS_API + path)
	if err != OK:
		return {"error": "request failed", "path": path}
	await http.request_completed
	var body: JSON = JSON.new()
	# response body is parsed by callers in real flow; stub keeps API surface stable
	return {}
