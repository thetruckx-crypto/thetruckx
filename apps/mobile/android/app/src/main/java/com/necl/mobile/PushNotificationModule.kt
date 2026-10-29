package com.necl.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.util.concurrent.atomic.AtomicInteger

class PushNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val CHANNEL_CLIENT = "thetruckx_client_alerts"
        const val CHANNEL_VENDOR = "thetruckx_vendor_alerts"
        const val CHANNEL_DRIVER = "thetruckx_driver_alerts"
        const val CHANNEL_ALERTS = "thetruckx_alerts"
        const val CHANNEL_DEFAULT = "default"

        private val clientCounter = AtomicInteger(100000)
        private val vendorCounter = AtomicInteger(200000)
        private val driverCounter = AtomicInteger(300000)
        private val generalCounter = AtomicInteger(400000)

        fun createNotificationChannels(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val notificationManager =
                    context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                        ?: return

                val vibration = longArrayOf(0, 250, 250, 250)

                // 1. Client Alerts Channel
                val clientChannel = NotificationChannel(
                    CHANNEL_CLIENT,
                    "THE TRUCKX - Client Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Live booking status, quote updates, vehicle dispatch & payment notifications for Clients"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = vibration
                    setShowBadge(true)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(clientChannel)

                // 2. Vendor Alerts Channel
                val vendorChannel = NotificationChannel(
                    CHANNEL_VENDOR,
                    "THE TRUCKX - Vendor Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Freight RFQs, quotation status, trip settlements & POD requirements for Transporters & Fleet Owners"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = vibration
                    setShowBadge(true)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(vendorChannel)

                // 3. Driver Alerts Channel
                val driverChannel = NotificationChannel(
                    CHANNEL_DRIVER,
                    "THE TRUCKX - Driver Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Trip assignments, loading schedules, turn-by-turn alerts & e-POD verification for Drivers"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = vibration
                    setShowBadge(true)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(driverChannel)

                // 4. General Alerts Channel
                val alertChannel = NotificationChannel(
                    CHANNEL_ALERTS,
                    "THE TRUCKX Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Real-time dispatch, vehicle assignment, and digital POD alerts"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = vibration
                    setShowBadge(true)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(alertChannel)

                // 5. Default Channel (FCM fallback)
                val defaultChannel = NotificationChannel(
                    CHANNEL_DEFAULT,
                    "THE TRUCKX Dispatch Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Standard operational notifications"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = vibration
                    setShowBadge(true)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(defaultChannel)
            }
        }
    }

    override fun getName(): String = "PushNotificationModule"

    @ReactMethod
    fun createChannels(promise: Promise) {
        try {
            createNotificationChannels(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CHANNEL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun displayPushNotification(
        title: String,
        body: String,
        data: ReadableMap?,
        promise: Promise?
    ) {
        try {
            createNotificationChannels(reactContext)

            val role = data?.getString("role")?.uppercase() ?: "GENERAL"
            val channelId = when (role) {
                "CLIENT" -> CHANNEL_CLIENT
                "VENDOR" -> CHANNEL_VENDOR
                "DRIVER" -> CHANNEL_DRIVER
                else -> CHANNEL_ALERTS
            }

            val intent = Intent(reactContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                if (data != null) {
                    val keyIterator = data.keySetIterator()
                    while (keyIterator.hasNextKey()) {
                        val key = keyIterator.nextKey()
                        try {
                            putExtra(key, data.getString(key))
                        } catch (_: Exception) {}
                    }
                }
            }

            val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            // Zero collision ID generation per role
            val notificationId = when (role) {
                "CLIENT" -> clientCounter.incrementAndGet()
                "VENDOR" -> vendorCounter.incrementAndGet()
                "DRIVER" -> driverCounter.incrementAndGet()
                else -> generalCounter.incrementAndGet()
            }

            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                notificationId,
                intent,
                pendingIntentFlags
            )

            // Resolve small icon
            var iconRes = reactContext.resources.getIdentifier(
                "notification_icon",
                "drawable",
                reactContext.packageName
            )
            if (iconRes == 0) {
                iconRes = reactContext.resources.getIdentifier(
                    "ic_launcher",
                    "mipmap",
                    reactContext.packageName
                )
            }
            if (iconRes == 0) {
                iconRes = android.R.drawable.ic_dialog_info
            }

            val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val builder = NotificationCompat.Builder(reactContext, channelId)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setVibrate(longArrayOf(0, 250, 250, 250))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setGroup("thetruckx_${role.lowercase()}")
                .setContentIntent(pendingIntent)

            val notificationManager = NotificationManagerCompat.from(reactContext)
            notificationManager.notify(notificationId, builder.build())

            promise?.resolve(notificationId)
        } catch (e: Exception) {
            promise?.reject("NOTIF_ERROR", e.message, e)
        }
    }
}
