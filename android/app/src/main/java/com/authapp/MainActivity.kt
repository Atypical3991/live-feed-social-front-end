package com.authapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "AuthApp"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flag [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIntent(intent) // Handle initial intent
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent) // Handle new intent
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null) {
            Log.e("IntentData", "Intent is null")
            return
        }

        // Log intent details for debugging
        Log.d("IntentData", "Intent received: ${intent.toString()}")
        Log.d("IntentData", "Action: ${intent.action}")
        Log.d("IntentData", "Data: ${intent.data?.toString() ?: "null"}")
        Log.d("IntentData", "Extras: ${intent.extras?.toString() ?: "null"}")

        // Handle deep link
        val data: Uri? = intent.data
        if (data != null) {
            Log.d("IntentData", "Deep link received: $data")
            // Pass deep link to React Native
            sendDeepLinkToReactNative(data.toString())
        } else {
            Log.d("IntentData", "No deep link data in intent")
        }

        // Handle extras (if any)
        intent.extras?.let { extras ->
            Log.d("IntentData", "Processing extras: $extras")
            // Example: Extract a specific extra
            val token = extras.getString("token")
            if (token != null) {
                Log.d("IntentData", "Token extra: $token")
                // Pass to React Native if needed
                sendDeepLinkToReactNative("token=$token")
            }
        }
    }

    private fun sendDeepLinkToReactNative(deepLink: String) {
        // Send the deep link to JavaScript
        reactInstanceManager.currentReactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("DeepLink", deepLink)
            ?: Log.e("IntentData", "React context not available to send deep link")
    }
}