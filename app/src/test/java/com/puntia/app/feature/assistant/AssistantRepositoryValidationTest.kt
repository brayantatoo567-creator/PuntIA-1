package com.puntia.app.feature.assistant

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class AssistantRepositoryValidationTest {
    @Test fun rejectsBlankMessagesBeforeNetworkAccess() {
        val repository = AssistantRepository("https://example.invalid")
        val error = assertThrows(IllegalArgumentException::class.java) {
            repository.sendMessage("   ")
        }
        assertEquals("Escribe un mensaje.", error.message)
    }

    @Test fun rejectsMessagesOverLimitBeforeNetworkAccess() {
        val repository = AssistantRepository("https://example.invalid")
        val error = assertThrows(IllegalArgumentException::class.java) {
            repository.sendMessage("x".repeat(8001))
        }
        assertEquals("El mensaje supera el límite de 8000 caracteres.", error.message)
    }
}
