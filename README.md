# 🚀 AnDiX - Commercial Gaming & Streamer Discord Bot Suite

AnDiX යනු Discord Gaming Streamers ලා සහ Server Owners ලා සඳහාම විශේෂයෙන් සකසන ලද Multi-Server Commercial SaaS Bot Platform එකකි.

---

## ✨ Features (ප්‍රධාන විශේෂාංග)

1. **🌐 Marketing Landing Page & Client Portal**:
   - අලුත් client කෙනෙකුට website එකෙන් විස්තර බලා account එකක් register කරගත හැක.
   - Bank transfer slip upload කර payment request එකක් submit කළ හැක.
2. **🛡️ Master Admin Dashboard**:
   - `admin@andix.bot` / `admin123` මගින් ඇතුළු විය හැක.
   - Client ලාගේ Bank Slips check කර Approve / Reject කිරීම.
   - Monthly Recurring Revenue (MRR), Total Revenue සහ Clients කළමනාකරණය.
   - ඕනෑම client කෙනෙකුගේ access suspend / reactivate කිරීම.
3. **🎮 1-Click Server Architect**:
   - Payment approve වූ පසු client ට තම Server ID එක දී එක click එකෙන් professional server layout එකක් (Roles, Channels, Categories, Permissions) ස්වයංක්‍රීයව හදාගත හැක.
4. **🔴 Stream Live Alerts & Announcements**:
   - Twitch, YouTube, Facebook Gaming, Kick stream alerts Web Dashboard එකෙන් කෙලින්ම server එකට යැවීම.
5. **🛡️ AutoMod & Security**:
   - Anti-spam, Anti-flood, Anti-invite links, Mass mentions blocker.
6. **📊 Leveling & Audit Logs**:
   - User XP & Leveling system, Join/Leave logs, Message delete/edit logs.

---

## 💰 Pricing Model

- **Initial Setup Fee**: LKR 2,000 (One-time)
- **Monthly Subscription**: LKR 500 / month

---

## 🛠️ Local Running (පරිගණකයේ Run කිරීම)

1. **Dependencies install කරන්න:**
   ```bash
   npm install
   ```

2. **Slash Commands deploy කරන්න:**
   ```bash
   npm run deploy
   ```

3. **Bot & Web Dashboard Start කරන්න:**
   ```bash
   npm start
   ```
   - **Public Website / Landing Page**: `http://localhost:3000`
   - **Login / Register Portal**: `http://localhost:3000/auth.html`
   - **Client Dashboard**: `http://localhost:3000/client.html`
   - **Master Admin Dashboard**: `http://localhost:3000/admin.html`

---

## ☁️ 100% Free Hosting Guide (නොමිලේ Host කරන ආකාරය)

Discord Bot එකක් දිගටම run වීමට **24/7 Node.js process** එකක් අවශ්‍ය වේ (Vercel Serverless පමණක් ප්‍රමාණවත් නොවේ, මන්ද Discord Gateway WebSockets maintain කළ යුතු බැවිනි). එබැවින් හොඳම ක්‍රමය වන්නේ:

### 1. Database එක Cloud එකට දැමීම (Free MongoDB Atlas):
1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) වෙත ගොස් නොමිලේ Account එකක් සාදන්න.
2. **M0 Free Cluster** එකක් සාදන්න.
3. Database Access එකෙන් Username & Password සාදන්න. Network Access එකෙන් `0.0.0.0/0` (Allow Anywhere) දෙන්න.
4. Connection string එක (`mongodb+srv://...`) copy කර `.env` file එකේ `MONGODB_URI` එකට paste කරන්න.

### 2. GitHub එකට Code එක Upload කිරීම:
```bash
git init
git add .
git commit -m "AnDiX SaaS Bot Platform Ready"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/andix-bot.git
git push -u origin main
```
*( `.gitignore` එක මගින් ඔබගේ `.env` සහ `data/` ආරක්ෂිතව ignore කර ඇත )*

### 3. Railway / Render මගින් 24/7 නොමිලේ Host කිරීම:
1. [Railway.app](https://railway.app) හෝ [Render.com](https://render.com) වෙත ගොස් GitHub account එක connect කරන්න.
2. සාදන ලද GitHub Repo එක තෝරන්න.
3. **Environment Variables** (Settings -> Variables) වලට පහත දෑ ඇතුළත් කරන්න:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `ADMIN_EMAIL` (`admin@andix.bot`)
   - `ADMIN_PASSWORD` (ඔබ කැමති රහස්‍ය මුරපදයක්)
   - `JWT_SECRET`
   - `MONGODB_URI` (MongoDB connection string)
   - `PORT` (`3000`)
4. Deploy කරන්න! Railway/Render මගින් ඔබට Public Domain එකක් ලබා දෙන අතර Website එක සහ Bot එක 24/7 Live ක්‍රියාත්මක වේ.
