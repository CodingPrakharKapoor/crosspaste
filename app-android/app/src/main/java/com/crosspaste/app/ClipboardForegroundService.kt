package com.crosspaste.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class ClipboardForegroundService : Service() {

    private var webSocket: WebSocket? = null
    private var client: OkHttpClient? = null
    private var host: String = ""
    @Volatile private var shouldReconnect = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                shouldReconnect = false
                webSocket?.close(1000, "user stopped")
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                host = intent.getStringExtra(EXTRA_HOST) ?: ""
                if (host.isEmpty()) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                shouldReconnect = true
                val notification = buildNotification("Connecting to $host:8080...")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    )
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
                connectWebSocket()
                return START_STICKY
            }
        }
        return START_NOT_STICKY
    }

    private fun connectWebSocket() {
        if (client == null) {
            client = OkHttpClient.Builder()
                .pingInterval(15, TimeUnit.SECONDS)
                .build()
        }
        webSocket?.cancel()
        val req = Request.Builder()
            .url("ws://$host:8080")
            .build()
        webSocket = client!!.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.i(TAG, "WebSocket open")
                updateNotification("Connected - ready to paste")
                // Send our FCM token to the relay so it can push us when we're
                // not on the same Wi-Fi (mobile data).
                val token = getSharedPreferences("crosspaste", MODE_PRIVATE)
                    .getString("fcm_token", null)
                if (token != null) {
                    val reg = JSONObject()
                        .put("type", "register")
                        .put("fcmToken", token)
                        .toString()
                    ws.send(reg)
                    Log.i(TAG, "Sent FCM token to relay")
                } else {
                    Log.w(TAG, "No FCM token yet - relay will only push via LAN")
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleIncomingMessage(text)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket closed: $code $reason")
                updateNotification("Disconnected - reconnecting...")
                scheduleReconnect()
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure", t)
                updateNotification("Reconnecting...")
                scheduleReconnect()
            }
        })
    }

    private fun handleIncomingMessage(raw: String) {
        try {
            val json = JSONObject(raw)
            if (json.optString("type") == "clipboard") {
                val text = json.getString("text")
                writeToClipboard(text)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse: $raw", e)
        }
    }

    private fun writeToClipboard(text: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("CrossPaste", text))
        val preview = if (text.length > 40) text.take(40) + "..." else text
        updateNotification("Last: $preview")
        Log.i(TAG, "Wrote ${text.length} chars to clipboard")
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect) return
        Thread {
            try {
                Thread.sleep(2000)
            } catch (e: InterruptedException) {
                return@Thread
            }
            if (shouldReconnect && host.isNotEmpty()) {
                Log.i(TAG, "Reconnecting...")
                connectWebSocket()
            }
        }.start()
    }

    override fun onDestroy() {
        shouldReconnect = false
        webSocket?.close(1000, "service destroyed")
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "CrossPaste service",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Keeps the clipboard sync running in the background"
        }
        val mgr = getSystemService(NotificationManager::class.java)
        mgr.createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CrossPaste")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val mgr = getSystemService(NotificationManager::class.java)
        mgr.notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        const val ACTION_START = "com.crosspaste.app.START"
        const val ACTION_STOP = "com.crosspaste.app.STOP"
        const val EXTRA_HOST = "host"
        const val NOTIFICATION_ID = 1
        const val CHANNEL_ID = "crosspaste_service"
        const val TAG = "CrossPaste"
    }
}
