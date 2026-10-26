package com.puntia.app.feature.assistant

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class AssistantUiState(
    val messages: List<Pair<String, String>> = listOf("PuntIA" to "¡Hola! Soy PuntIA. ¿Qué te gustaría tejer hoy?"),
    val loading: Boolean = false,
    val error: String? = null
)

class AssistantViewModel(
    private val repository: AssistantRepository
) : ViewModel() {
    var state: AssistantUiState = AssistantUiState()
        private set
    var onStateChanged: (() -> Unit)? = null
        set(value) { field = value; field?.invoke() }

    fun send(text: String) {
        val message = text.trim()
        if (message.isEmpty() || state.loading) return
        if (message.length > 8000) {
            state = state.copy(error = "El mensaje supera el límite de 8000 caracteres.")
            onStateChanged?.invoke()
            return
        }
        state = state.copy(
            messages = state.messages + ("Tú" to message),
            loading = true,
            error = null
        )
        onStateChanged?.invoke()
        viewModelScope.launch {
            try {
                val reply = withContext(Dispatchers.IO) { repository.sendMessage(message) }
                state = state.copy(messages = state.messages + ("PuntIA" to reply.text), loading = false)
            } catch (e: Exception) {
                state = state.copy(loading = false, error = e.message ?: "Ocurrió un error.")
            }
            onStateChanged?.invoke()
        }
    }
}
