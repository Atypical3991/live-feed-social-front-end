package com.authapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.ReactInstanceManager
import com.facebook.react.bridge.ReactContext

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "AuthApp"

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

        // Log intent details
        Log.d("IntentData", "Intent received: $intent")
        Log.d("IntentData", "Action: ${intent.action}")
        Log.d("IntentData", "Data: ${intent.data?.toString() ?: "null"}")
        Log.d("IntentData", "Extras: ${intent.extras?.toString() ?: "null"}")

        // Handle deep link data
        val data: Uri? = intent.data
        if (data != null) {
            Log.d("IntentData", "Deep link received: $data")
            sendDeepLinkToReactNative(data.toString())
        } else {
            Log.d("IntentData", "No deep link data in intent")
        }

        // Handle extras
        intent.extras?.let { extras ->
            val token = extras.getString("token")
            if (token != null) {
                Log.d("IntentData", "Token extra: $token")
                sendDeepLinkToReactNative("token=$token")
            }
        }
    }

    private fun sendDeepLinkToReactNative(deepLink: String) {
        val reactApp = application as? ReactApplication
        val reactInstanceManager = reactApp?.reactNativeHost?.reactInstanceManager
        val reactContext = reactInstanceManager?.currentReactContext

        if (reactContext != null) {
            // React context is ready
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("DeepLink", deepLink)
            Log.d("IntentData", "Sent deep link to React Native: $deepLink")
        } else {
            // Define listener
            val listener = object : ReactInstanceManager.ReactInstanceEventListener {
                override fun onReactContextInitialized(context: ReactContext) {
                    context
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("DeepLink", deepLink)
                    Log.d("IntentData", "Sent deep link after React context initialized: $deepLink")
                    reactInstanceManager?.removeReactInstanceEventListener(this)
                }
            }

            // Add listener
            reactInstanceManager?.addReactInstanceEventListener(listener)

            // Start context if not already started
            if (reactInstanceManager != null && !reactInstanceManager.hasStartedCreatingInitialContext()) {
                reactInstanceManager.createReactContextInBackground()
            }
        }
    }
}
