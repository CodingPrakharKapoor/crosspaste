package com.crosspaste.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private val requestNotificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val urlInput = findViewById<EditText>(R.id.ipInput)
        val startBtn = findViewById<Button>(R.id.startBtn)
        val stopBtn = findViewById<Button>(R.id.stopBtn)
        val tokenText = findViewById<TextView>(R.id.tokenText)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // Fetch the FCM token on launch. The token is persisted to SharedPreferences
        // so the foreground service can send it to the relay on WebSocket connect.
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    getSharedPreferences("crosspaste", MODE_PRIVATE)
                        .edit()
                        .putString("fcm_token", token)
                        .apply()
                    tokenText.text = "FCM token: ${token?.take(20)}…"
                } else {
                    tokenText.text = "FCM token: not available yet"
                }
            }

        startBtn.setOnClickListener {
            val raw = urlInput.text?.toString()?.trim().orEmpty()
            if (raw.isEmpty()) {
                urlInput.error = "Enter the relay URL or IP"
                return@setOnClickListener
            }
            val url = normalizeRelayUrl(raw)
            val intent = Intent(this, ClipboardForegroundService::class.java).apply {
                action = ClipboardForegroundService.ACTION_START
                putExtra(ClipboardForegroundService.EXTRA_URL, url)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        }

        stopBtn.setOnClickListener {
            val intent = Intent(this, ClipboardForegroundService::class.java).apply {
                action = ClipboardForegroundService.ACTION_STOP
            }
            startService(intent)
        }
    }

    /**
     * Accept several forms of input and return a valid ws:// or wss:// URL:
     *   "wss://crosspaste-relay.onrender.com"  -> as-is
     *   "crosspaste-relay.onrender.com"        -> "wss://crosspaste-relay.onrender.com"
     *   "192.168.1.10"                         -> "ws://192.168.1.10:8080"
     *   "192.168.1.10:8080"                    -> "ws://192.168.1.10:8080"
     *   "localhost:8080"                       -> "ws://localhost:8080"
     */
    private fun normalizeRelayUrl(input: String): String {
        val trimmed = input.trim()
        return when {
            trimmed.startsWith("ws://") || trimmed.startsWith("wss://") -> trimmed
            trimmed.contains("onrender.com") ||
            trimmed.endsWith(".com") ||
            trimmed.endsWith(".io") ||
            trimmed.endsWith(".app") ||
            trimmed.endsWith(".dev") -> "wss://$trimmed"
            trimmed.contains(":") -> "ws://$trimmed"           // already has a port
            else -> "ws://$trimmed:8080"                       // bare IP / hostname
        }
    }
}
