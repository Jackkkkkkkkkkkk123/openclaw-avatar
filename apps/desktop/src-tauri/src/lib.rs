use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use tauri::command;

/// TTS 请求参数
#[derive(Debug, Deserialize)]
pub struct TtsRequest {
    pub text: String,
    pub api_key: String,
    pub reference_id: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_format")]
    pub format: String,
}

fn default_model() -> String {
    "s1".to_string()
}

fn default_format() -> String {
    "mp3".to_string()
}

/// TTS 响应
#[derive(Debug, Serialize)]
pub struct TtsResponse {
    pub success: bool,
    pub audio_base64: Option<String>,
    pub error: Option<String>,
}

/// Fish Audio TTS 代理 - 绕过 CORS
#[command]
async fn tts_synthesize(request: TtsRequest) -> TtsResponse {
    let client = reqwest::Client::new();
    
    let body = serde_json::json!({
        "text": request.text,
        "reference_id": request.reference_id,
        "format": request.format
    });

    let result = client
        .post("https://api.fish.audio/v1/tts")
        .header("Authorization", format!("Bearer {}", request.api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;

    match result {
        Ok(response) => {
            if response.status().is_success() {
                match response.bytes().await {
                    Ok(bytes) => {
                        let audio_base64 = STANDARD.encode(&bytes);
                        TtsResponse {
                            success: true,
                            audio_base64: Some(audio_base64),
                            error: None,
                        }
                    }
                    Err(e) => TtsResponse {
                        success: false,
                        audio_base64: None,
                        error: Some(format!("读取响应失败: {}", e)),
                    },
                }
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                TtsResponse {
                    success: false,
                    audio_base64: None,
                    error: Some(format!("API错误 {}: {}", status, error_text)),
                }
            }
        }
        Err(e) => TtsResponse {
            success: false,
            audio_base64: None,
            error: Some(format!("请求失败: {}", e)),
        },
    }
}

#[command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, tts_synthesize])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
