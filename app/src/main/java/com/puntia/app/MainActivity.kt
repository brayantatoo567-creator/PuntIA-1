package com.puntia.app

import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.puntia.app.feature.assistant.AssistantRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Initial native screen proving the Android client can talk to the existing API. */
class MainActivity : AppCompatActivity() {
    private lateinit var transcript: LinearLayout
    private lateinit var input: EditText
    private lateinit var sendButton: Button
    private lateinit var status: TextView
    private lateinit var scroll: ScrollView
    private val repository by lazy { AssistantRepository(BuildConfig.PUNTIA_API_BASE_URL) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        appendMessage("PuntIA", "¡Hola! Soy PuntIA, tu asistente de crochet y amigurumi. ¿Qué quieres crear?")
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 28, 24, 16)
            setBackgroundColor(0xFFFFF8F4.toInt())
        }
        root.addView(TextView(this).apply {
            text = "PuntIA 🧶"
            textSize = 28f
            setTextColor(0xFF382B46.toInt())
        })
        root.addView(TextView(this).apply {
            text = "Tu asistente de crochet y amigurumi"
            textSize = 14f
            setTextColor(0xFF62566D.toInt())
        })
        scroll = ScrollView(this)
        transcript = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 16, 0, 16)
        }
        scroll.addView(transcript)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        status = TextView(this).apply { textSize = 13f; setTextColor(0xFF8A4B18.toInt()) }
        root.addView(status)
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        input = EditText(this).apply {
            hint = "Pregúntame sobre tu proyecto…"
            maxLines = 4
            setPadding(12, 8, 12, 8)
        }
        row.addView(input, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        sendButton = Button(this).apply {
            text = "Enviar"
            setOnClickListener { submit() }
        }
        row.addView(sendButton)
        root.addView(row)
        setContentView(root)
    }

    private fun submit() {
        val message = input.text.toString().trim()
        if (message.isEmpty()) { input.error = "Escribe un mensaje."; return }
        if (message.length > 8000) { input.error = "Máximo 8000 caracteres."; return }
        input.setText("")
        sendButton.isEnabled = false
        status.text = "PuntIA está pensando…"
        lifecycleScope.launch {
            try {
                val reply = withContext(Dispatchers.IO) { repository.sendMessage(message) }
                appendMessage("Tú", message)
                appendMessage("PuntIA", reply.text)
                status.text = ""
            } catch (e: Exception) {
                appendMessage("Tú", message)
                status.text = e.message ?: "No se pudo obtener respuesta."
            } finally {
                sendButton.isEnabled = true
            }
        }
    }

    private fun appendMessage(author: String, message: String) {
        transcript.addView(TextView(this).apply {
            text = "$author\n$message"
            textSize = 16f
            setTextColor(0xFF382B46.toInt())
            setPadding(14, 12, 14, 12)
            setBackgroundColor(if (author == "PuntIA") 0xFFFFFFFF.toInt() else 0xFFEDE4FF.toInt())
        }, LinearLayout.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = 12
        })
        scroll.post { scroll.fullScroll(ScrollView.FOCUS_DOWN) }
    }
}
