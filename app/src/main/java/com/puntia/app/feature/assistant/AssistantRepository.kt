package com.puntia.app.feature.assistant

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class AssistantReply(val text: String, val emotion: String = "happy")

class AssistantException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** Small HTTP client for the existing PuntIA Express API. Never stores AI credentials on-device. */
class AssistantRepository(
    private val baseUrl: String,
    private val connectionFactory: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection }
) {
    fun sendMessage(message: String, userId: String = "android-user"): AssistantReply {
        val cleaned = message.trim()
        require(cleaned.isNotEmpty()) { "Escribe un mensaje." }
        require(cleaned.length <= 8000) { "El mensaje supera el límite de 8000 caracteres." }

        val endpoint = URL(baseUrl.trimEnd('/') + "/api/puntia/chat")
        val connection = connectionFactory(endpoint)
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 10_000
            connection.readTimeout = 45_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            val payload = JSONObject().put("message", cleaned).put("userId", userId).toString()
            connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.use { input ->
                BufferedReader(InputStreamReader(input, Charsets.UTF_8)).readText()
            }.orEmpty()
            val json = try { JSONObject(body) } catch (e: Exception) {
                throw AssistantException("El servidor devolvió una respuesta no válida.", e)
            }
            if (status !in 200..299) {
                throw AssistantException(json.optString("error").ifBlank {
                    "No se pudo conectar con PuntIA (HTTP $status)."
                })
            }
            val reply = json.optString("reply").trim()
            if (reply.isEmpty()) throw AssistantException("PuntIA devolvió una respuesta vacía.")
            return AssistantReply(reply, json.optString("emotion", "happy"))
        } catch (e: AssistantException) {
            throw e
        } catch (e: Exception) {
            throw AssistantException("No se pudo conectar con PuntIA. Revisa tu conexión e inténtalo de nuevo.", e)
        } finally {
            connection.disconnect()
        }
    }
}
