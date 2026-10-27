import { NotificationService } from '../../server/src/services/notificationService';

async function main() {
  console.log('Testing NotificationService direct dispatch:');
  const regResult = NotificationService.registerToken({
    pushToken: 'fcm_android_device_sample_token_8899',
    userId: 'client_sample_01',
    role: 'CLIENT',
    platform: 'android',
  });
  console.log('Register token result:', regResult);

  const tokens = NotificationService.getTokens({ userId: 'client_sample_01' });
  console.log('Retrieved tokens:', tokens);

  const dispatchResult = await NotificationService.sendPush({
    to: tokens,
    title: 'THE TRUCKX - Delivery Update',
    body: 'Trip #TRP-8821 lorry has arrived at the destination warehouse.',
    data: {
      icon: 'notification_icon',
      tripId: 'TRP-8821',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
  });

  console.log('Dispatch result:', JSON.stringify(dispatchResult, null, 2));
}

main();
