# Village Water on Expo Go

1. Run **mobile/setup.sql** in your Supabase SQL Editor. This enables Realtime for the village readings.
2. Fill in **.env** beside the village-atlas README with SUPABASE_URL and the private SUPABASE_SERVICE_ROLE_KEY. Fill in **mobile/.env** with EXPO_PUBLIC_SUPABASE_URL (the same URL) and EXPO_PUBLIC_SUPABASE_ANON_KEY (the public anon key). Both files have .env.example templates.
3. From village-atlas run `python3 tools/phone_server.py`. Open http://127.0.0.1:8046/?tour=1&phones=1 on the laptop.
4. In a second terminal, from mobile run `npm install` and `npm start`. With the phone on the same Wi-Fi, scan the terminal QR code in Expo Go. Restart Expo after editing mobile/.env.
5. Open **Alerts** and tap **Enable alerts & test warning sound**, allow notifications and listen for the test sound. Keep the app visible on the phone. Advance the tour to the cloudy-water stop. The projector closes the valve, Supabase broadcasts the event, and the phone shows the alert and plays the same three-note warning tone. To test chlorine, use Village systems → Try another device → Low chlorine.

Tank readings update about every five seconds. Supply changes publish immediately. Adjust the phone's media volume during the sound test. When the app is reopened, Recent alerts shows missed events.
