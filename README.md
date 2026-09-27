# 🎮 Play the Game

Click the button below to start playing!

[![Play Game](https://img.shields.io/badge/▶%20PLAY%20GAME-Click%20Here-brightgreen?style=for-the-badge)](https://panithan1991.github.io/test/)

> 🌐 **Live Game:** https://panithan1991.github.io/test/




# Monkey Swing — Jungle Run

เกม HTML Canvas สำหรับ GitHub Pages เล่นได้ไม่จำกัดระยะทาง มีคอมโบ กล้วย โบนัสเถาวัลย์ทอง หนึ่งชีวิต และ Ranking แรงกระโดดมาจากจังหวะแกว่ง ณ เวลาที่ผู้เล่นกด ไม่มีระบบเล็งให้จับอัตโนมัติ

## เล่นและทดสอบในเครื่อง

เปิดเซิร์ฟเวอร์ไฟล์สถิติก่อน เพราะ `game.js` เป็น ES module:

```powershell
python -m http.server 8000
```

เข้า `http://localhost:8000/` จากเบราว์เซอร์ หรือใช้ `npx serve .` หากมี Node.js

## Ranking ออนไลน์ฟรีด้วย Firebase Spark

อันดับในเครื่องใช้ได้ทันที แม้ยังไม่ตั้งค่า Firebase หรืออินเทอร์เน็ตขัดข้อง ส่วนอันดับทั่วโลกต้องตั้งค่าครั้งเดียว:

1. สร้างโปรเจกต์ที่ [Firebase Console](https://console.firebase.google.com/) โดยเลือก **Spark (no cost)** และไม่เชื่อมบัญชี Cloud Billing
2. เพิ่ม Web app ใน Project settings แล้วนำค่า `firebaseConfig` สาธารณะที่ได้ไปวางแทน `null` ใน `firebase-config.js`
3. เปิด **Authentication → Sign-in method → Anonymous**
4. สร้าง **Cloud Firestore (Standard edition)** ฐานข้อมูลแรกของโปรเจกต์
5. ใน Firestore → Rules ให้วางเนื้อหา `firestore.rules` แล้ว Publish
6. อัปโหลดไฟล์เกมทั้งหมดขึ้น GitHub Pages; โหลดหน้าจอใหม่แล้วแท็บ **ทั่วโลก** จะอ่านอันดับได้

ไม่มี service account key หรือ token ส่วนตัวในเว็บ Firebase Web config เป็นตัวระบุโปรเจกต์สาธารณะ สิทธิ์การเขียนควบคุมด้วย Authentication และ Firestore Rules

โควตา Spark สำหรับ Firestore Standard ปัจจุบัน: 50,000 document reads ต่อวัน, 20,000 writes ต่อวัน, 1 GiB storage โปรแกรมอ่าน Top 20 เฉพาะเมื่อเปิด Ranking และเขียนเมื่อผู้เล่นทำคะแนนสูงสุดของตนเองเท่านั้น คง Spark และอย่าเชื่อม Cloud Billing เพื่อไม่ให้เกิดค่าใช้จ่าย หากโควตาหมด เกมยังใช้ Ranking ในเครื่องได้

**ข้อจำกัดความยุติธรรม:** เกมทำงานในเบราว์เซอร์ จึงไม่สามารถยืนยันคะแนนว่าเล่นจริงด้วย Firestore Rules เพียงอย่างเดียว Rules จำกัดสิทธิ์ให้แก้ได้เฉพาะคะแนนของตัวเองและจำกัดรูปแบบข้อมูล แต่ผู้เล่นที่แก้ JavaScript ในเบราว์เซอร์ยังส่งคะแนนเท็จได้ Ranking นี้เหมาะกับเกมเล่นสนุกทั่วไป
