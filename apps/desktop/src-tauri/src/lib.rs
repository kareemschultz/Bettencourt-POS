use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Check for updates silently in the background on startup.
            // If an update is found, the frontend receives an "update-available"
            // event and shows the update banner via the JS bridge.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_update(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn check_for_update(app: tauri::AppHandle) {
    use tauri_plugin_updater::UpdaterExt;

    let updater = match app.updater() {
        Ok(u) => u,
        Err(_) => return, // Updater not configured — skip silently
    };

    let update = match updater.check().await {
        Ok(Some(u)) => u,
        _ => return, // No update available or check failed
    };

    // Notify the frontend — JS side shows the update banner
    let _ = app.emit("update-available", serde_json::json!({
        "version": update.version,
        "body": update.body,
    }));

    // Download and install silently; user restarts via the banner
    let _ = update.download_and_install(|_, _| {}, || {}).await;
}
