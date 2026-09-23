//! Rust Actix high-performance gateway — stage prototype skeleton.
//! Same API contract as src/os/server.js (see docs/WATCHTOWER_OS_V3.md).
//! Not built in CI on stage/prototype; the Node zero-dep server is canonical there.
use actix_web::{get, web, App, HttpResponse, HttpServer, Responder};

#[get("/api/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "ok": true, "service": "watchtower-os-v3-actix",
        "gameId": "aof", "network": "stage", "stage": "prototype",
        "writes": false, "signerCapability": false
    }))
}

#[get("/api/os/config")]
async fn os_config() -> impl Responder {
    // Delegate to the same stack-v3 data in production; stub returns the header facts.
    HttpResponse::Ok().json(serde_json::json!({
        "gameId": "aof", "version": "v3", "componentsTotal": 33,
        // [AUDIT AOF-H2] real Anchor.toml program ids (localnet == devnet);
        // the two spec placeholders stay as non-address markers.
        "programIds": [
            "AOF_CORE_PROGRAM_ID",
            "4BhD6spJHdvHQ9mgyaU6AUSLU37oJbTMCDcAXyWhMRVo",
            "4fNKhVw2nErWZBBw9hgWD3Metu1UKbDLdhFGWbCewdLU",
            "4rMWC1h9mt6JTfBsUPYLMCydPED4e31cffmix5nZyuRb",
            "Gvbo9wDEW6kCzzhjk3stEcZoVtcScbN8mGv9SNwTUJLv",
            "6ZnnyKkv1kUE4AJqi5uwdh5ZX6VFGfbQiwhGSkfqZ9K5",
            "CgInv111...",
            "STrEaSuRy111..."
        ],
        "controlPanels": { "total": 19 }
    }))
}

#[get("/api/assets/strategy")]
async fn assets_strategy(q: web::Query<std::collections::HashMap<String, String>>) -> impl Responder {
    let item_type = q.get("itemType").map(String::as_str).unwrap_or("common");
    let rarity = q.get("rarity").map(String::as_str).unwrap_or("common");
    let standard = matches!(item_type, "golden_tool" | "land");
    HttpResponse::Ok().json(serde_json::json!({
        "gameId": "aof", "itemType": item_type, "rarity": rarity,
        "standard": if standard { "standard-nft" } else { "cNft" },
        "compression": { "protocol": "Bubblegum v2", "mintCostUsdPerMillion": 110 }
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let host = std::env::var("WATCHTOWER_OS_HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let port: u16 = std::env::var("WATCHTOWER_OS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8788);
    println!("watchtower-os-v3 actix gateway on {host}:{port} (gameId=aof)");
    HttpServer::new(|| {
        App::new()
            .service(health)
            .service(os_config)
            .service(assets_strategy)
    })
    .bind((host, port))?
    .run()
    .await
}
