package com.puntia.app

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.core.app.ActivityScenario
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AssistantLaunchTest {
    @Test fun mainScreenLaunches() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                assert(activity.title != null || activity.findViewById<android.view.View>(android.R.id.content) != null)
            }
        }
    }
}
