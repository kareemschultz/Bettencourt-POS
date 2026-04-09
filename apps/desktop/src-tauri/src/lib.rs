use tauri::Manager;

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

    match app.updater() {
        Ok(updater) => {
            if let Ok(Some(update)) = updater.check().await {
                // Notify the frontend — the JS side shows the update banner
                let _ = app.emit("update-available", serde_json::json!({
                    "version": update.version,
                    "body": update.body,
                }));

                // Download and install silently; relaunch on next app start
                if let Ok(mut bytes) = update.download(|_, _| {}, || {}).await {
                    let _ = update.install(&mut bytes);
                }
            }
        }
        Err(_) => {
            // Updater not configured or no endpoint — skip silently
        }
    }
}
