package com.crosspaste.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives FCM push notifications from the relay.
 *
 * When the phone is on mobile data (not the same Wi-Fi as the laptop), the
 * WebSocket can't reach it. The relay falls back to FCM push, which wakes the
 * app and delivers the clipboard text here.
 *
 * Note: FCM data payloads have a 4 KB limit. The relay truncates text to 4000
 * chars before sending. Phase 2B Step 2 will add encryption; for now the relay
 * sees plaintext (it's your own laptop).
 */
class CrossPasteFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        Log.i(TAG, "FCM token rotated: ${token.take(20)}…")
        // Persist so the foreground service can send it to the relay on next connect.
        getSharedPreferences("crosspaste", MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val type = message.data["type"]
        if (type == "clipboard") {
            val text = message.data["text"] ?: return
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("CrossPaste", text))
            Log.i(TAG, "Wrote ${text.length} chars to clipboard via FCM")
        } else {
            Log.w(TAG, "Unknown FCM message type: $type")
        }
    }

    companion object {
        const val TAG = "CrossPasteFCM"
    }
}
