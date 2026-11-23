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

        val ipInput = findViewById<EditText>(R.id.ipInput)
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
            val ip = ipInput.text?.toString()?.trim().orEmpty()
            if (ip.isEmpty()) {
                ipInput.error = "Enter the laptop IP (printed by the relay)"
                return@setOnClickListener
            }
            val intent = Intent(this, ClipboardForegroundService::class.java).apply {
                action = ClipboardForegroundService.ACTION_START
                putExtra(ClipboardForegroundService.EXTRA_HOST, ip)
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
}
