# Patreon → Telegram Bridge

מחבר בין webhooks של Patreon לבין ניהול קבוצת טלגרם: מנוי חדש/מחודש = קבלת לינק חד-פעמי; ביטול = הוצאה מהקבוצה; פג תוקף אחרי 30 יום = הוצאה אוטומטית.

## התקנה

```bash
npm install
cp .env.example .env
# ערוך את .env עם הערכים שלך
```

## הגדרת טלגרם

1. צור בוט דרך [@BotFather](https://t.me/BotFather), שמור את ה-token.
2. הוסף את הבוט לקבוצה שלך **כאדמין**, עם הרשאות "Invite Users via Link" ו-"Ban Users".
3. קבל את ה-`chat_id` של הקבוצה (מספר שלילי) — למשל ע"י שליחת הודעה בקבוצה ואז קריאה ל-`https://api.telegram.org/bot<TOKEN>/getUpdates`.

## הגדרת פטריון

1. הירשם כ-client ב-[Patreon Platform Portal](https://www.patreon.com/portal/registration/register-clients).
2. צור webhook שמצביע על `https://<your-domain>/webhooks/patreon`.
3. בחר את ה-triggers: `members:pledge:create`, `members:pledge:update`, `members:pledge:delete`.
4. שמור את ה-webhook secret שמוצג שם ל-`.env`.

## הרצה

```bash
npm start
```

לפיתוח מקומי, חשוף את הפורט לאינטרנט עם כלי כמו `ngrok` כדי שפטריון יוכל לשלוח webhooks:

```bash
ngrok http 3000
```

## מה עדיין חסר (לפי הצורך שלך)

- **שליחת הלינק לפועל ללקוח**: כרגע הקוד רק מדפיס אותו ל-log (ראה `TODO` ב-`server.js`). תצטרך לחבר שירות מייל (Resend/SendGrid) או להשתמש ב-DM דרך Patreon.
- **קישור בין Patreon לטלגרם**: כדי לדעת את ה-`telegram_user_id` של כל מנוי (כדי שנוכל לבעוט אותו בביטול), תצטרך צעד קטן שבו המשתמש "מזהה את עצמו" — למשל שהבוט מבקש ממנו `/start` עם קוד ייחודי לפני שהוא מקבל את הלינק, ואתה שומר את ה-mapping ב-DB (`setTelegramUserId`).
- **פריסה (deploy)**: מומלץ Railway/Render/Fly.io — כולם תומכים ב-Node + כותבים ל-disk (ל-SQLite) בקלות. ל-serverless (Vercel) תצטרך DB חיצוני כמו Postgres/Supabase במקום SQLite.

## מבנה הפרויקט

```
src/
  server.js       — נקודת הכניסה, מקבל webhooks
  patreon.js       — אימות חתימה + פענוח payload
  telegram.js       — יצירת לינקים + הוצאת חברים
  db.js             — SQLite: מי מנוי, עד מתי
  cronExpire.js     — עבודה יומית שמוציאה מנויים שפג תוקפם
```
