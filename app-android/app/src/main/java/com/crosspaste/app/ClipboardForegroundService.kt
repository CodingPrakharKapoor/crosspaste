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
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Foreground service that holds the WebSocket to the relay open while the
 * app is backgrounded.
 *
 * Phase 2B.2 stability fixes (replacing the old "spawn a Thread on every
 * disconnect" approach that caused the reconnect storm we saw in logs):
 *
 *   1. Single reconnect job on a Handler. removeCallbacks is called before
 *      every postDelayed, so there is never more than one pending reconnect.
 *      The old code spawned a fresh Thread on every onClosed AND onFailure,
 *      which doubled on each disconnect and exploded into 30+ reconnects/min.
 *
 *   2. isConnecting flag prevents concurrent connectWebSocket calls. Without
 *      it, two pending reconnects could both fire and create two sockets,
 *      each failing, each scheduling two more, etc.
 *
 *   3. Exponential backoff: 2s -> 4s -> 8s -> 16s -> 30s (capped). Reset to
 *      2s on a successful onOpen. The relay's rate limiter (max 5 conns/10s
 *      per IP, then 30s cooldown) is the backstop if the client still
 *      reconnects too fast.
 *
 *   4. Periodic HTTP HEAD to /health every 5 minutes. Render's free tier
 *      sleeps services after 15 min of "HTTP inactivity"; the WebSocket's
 *      built-in ping frames don't always count, so this explicit HTTP
 *      request is the reliable keep-alive. (cron-job.org is the external
 *      backup for when the phone itself is off.)
 */
class ClipboardForegroundService : Service() {

    private var webSocket: WebSocket? = null
    private var client: OkHttpClient? = null
    private var relayUrl: String = ""

    @Volatile private var shouldReconnect = false
    @Volatile private var isConnecting = false
    @Volatile private var backoffMs = INITIAL_BACKOFF_MS

    private val handler = Handler(Looper.getMainLooper())

    private val reconnectRunnable = Runnable {
        if (shouldReconnect && !isConnecting && relayUrl.isNotEmpty()) {
            Log.i(TAG, "Reconnecting (backoff=${backoffMs}ms)...")
            connectWebSocket()
        }
    }

    private val keepAliveHandler = Handler(Looper.getMainLooper())
    private val keepAliveRunnable = Runnable {
        pingHealthEndpoint()
        // Re-post ourselves - keepalive runs for the lifetime of the service.
        keepAliveHandler.postDelayed(keepAliveRunnable, KEEPALIVE_INTERVAL_MS)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                shouldReconnect = false
                isConnecting = false
                handler.removeCallbacks(reconnectRunnable)
                keepAliveHandler.removeCallbacks(keepAliveRunnable)
                try { webSocket?.close(1000, "user stopped") } catch (e: Exception) {}
                webSocket = null
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                relayUrl = intent.getStringExtra(EXTRA_URL) ?: ""
                if (relayUrl.isEmpty()) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                shouldReconnect = true
                backoffMs = INITIAL_BACKOFF_MS
                val notification = buildNotification("Connecting to $relayUrl...")
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
                // Start the keepalive loop (cancel any pending first).
                keepAliveHandler.removeCallbacks(keepAliveRunnable)
                keepAliveHandler.postDelayed(keepAliveRunnable, KEEPALIVE_INTERVAL_MS)
                return START_STICKY
            }
        }
        return START_NOT_STICKY
    }

    private fun connectWebSocket() {
        if (isConnecting) {
            Log.w(TAG, "connectWebSocket skipped - already connecting")
            return
        }
        isConnecting = true

        if (client == null) {
            client = OkHttpClient.Builder()
                .pingInterval(15, TimeUnit.SECONDS)
                .build()
        }
        // Cancel any stale socket. We don't null its listeners first because
        // isConnecting=true blocks scheduleReconnect from acting on whatever
        // callbacks the old socket fires during teardown.
        try { webSocket?.cancel() } catch (e: Exception) {}

        val req = Request.Builder()
            .url(relayUrl)
            .build()
        webSocket = client!!.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                isConnecting = false
                backoffMs = INITIAL_BACKOFF_MS   // success -> reset backoff
                Log.i(TAG, "WebSocket open: $relayUrl")
                updateNotification("Connected - ready to paste")
                // Re-register the FCM token on every connect. The relay
                // dedups by token, so this is cheap and covers the case
                // where the relay restarted and lost its in-memory set.
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
                    Log.w(TAG, "No FCM token yet - relay will only deliver via WebSocket")
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleIncomingMessage(text)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                isConnecting = false
                Log.i(TAG, "WebSocket closed: $code $reason")
                updateNotification("Disconnected - reconnecting...")
                scheduleReconnect()
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                isConnecting = false
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
        val clipboard = getSystemService(Context.CLIPBOARD_MANAGER) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("CrossPaste", text))
        val preview = if (text.length > 40) text.take(40) + "..." else text
        updateNotification("Last: $preview")
        Log.i(TAG, "Wrote ${text.length} chars to clipboard")
    }

    /**
     * Schedule exactly one reconnect, replacing any previously-pending one.
     * Uses the current backoffMs, then doubles it (capped at MAX_BACKOFF_MS).
     * On a successful onOpen, backoffMs is reset to INITIAL_BACKOFF_MS.
     */
    private fun scheduleReconnect() {
        if (!shouldReconnect) return
        handler.removeCallbacks(reconnectRunnable)
        handler.postDelayed(reconnectRunnable, backoffMs)
        backoffMs = (backoffMs * 2).coerceAtMost(MAX_BACKOFF_MS)
    }

    /**
     * Build the /health URL from the WebSocket URL by swapping the scheme
     * and appending /health. Examples:
     *   wss://crosspaste-relay.onrender.com      -> https://...onrender.com/health
     *   ws://192.168.1.10:8080                   -> http://192.168.1.10:8080/health
     *   wss://relay.example.com/some/path        -> https://relay.example.com/health
     */
    private fun buildHealthUrl(): String? {
        val stripped = relayUrl
            .replaceFirst("wss://", "https://")
            .replaceFirst("ws://", "http://")
        val schemeEnd = stripped.indexOf("://")
        if (schemeEnd < 0) return null
        val pathStart = stripped.indexOf('/', schemeEnd + 3)
        val noPath = if (pathStart >= 0) stripped.substring(0, pathStart) else stripped
        return "$noPath/health"
    }

    /**
     * Async HTTP HEAD to /health. Runs on OkHttp's dispatcher thread so
     * the main looper is never blocked. Failures are logged at WARN and
     * otherwise ignored - keepalive is best-effort.
     */
    private fun pingHealthEndpoint() {
        val healthUrl = buildHealthUrl() ?: run {
            Log.w(TAG, "Could not build health URL from $relayUrl")
            return
        }
        val req = try {
            Request.Builder().url(healthUrl).head().build()
        } catch (e: Exception) {
            Log.w(TAG, "Invalid health URL: $healthUrl")
            return
        }
        // Reuse the same OkHttp client (the pingInterval setting only
        // affects WebSockets, so HTTP calls work normally).
        client?.newCall(req)?.enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                response.close()
                Log.d(TAG, "Keepalive $healthUrl -> ${response.code}")
            }
            override fun onFailure(call: Call, e: IOException) {
                Log.w(TAG, "Keepalive failed: ${e.message}")
            }
        })
    }

    override fun onDestroy() {
        shouldReconnect = false
        isConnecting = false
        handler.removeCallbacks(reconnectRunnable)
        keepAliveHandler.removeCallbacks(keepAliveRunnable)
        try { webSocket?.close(1000, "service destroyed") } catch (e: Exception) {}
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
        const val EXTRA_URL = "url"
        const val NOTIFICATION_ID = 1
        const val CHANNEL_ID = "crosspaste_service"
        const val TAG = "CrossPaste"

        private const val INITIAL_BACKOFF_MS = 2000L       // 2s
        private const val MAX_BACKOFF_MS = 30_000L         // 30s cap
        private const val KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000L  // 5 min
    }
}
