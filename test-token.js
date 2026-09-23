// === TEST TEMPORAIRE ===
if (process.argv.includes("--test-token")) {
  const microsoftAuth = require("./launcher/auth/microsoft");
  app.whenReady().then(async () => {
    const token = await microsoftAuth.getMinecraftToken();
    if (!token) {
      console.log("❌ Token null");
      app.quit();
      return;
    }
    console.log("👤 Profile      :", token.profile?.name);
    console.log("🆔 UUID         :", token.profile?.id);
    console.log("🔑 mcToken      :", token.mcToken?.length, "chars");
    console.log("🔑 getToken(true):", token.getToken(true)?.length, "chars");
    console.log("🔍 Égaux ?      :", token.mcToken === token.getToken(true));
    console.log("🔍 validate()   :", token.validate());
    console.log("🔍 xuid         :", token.xuid);
    app.quit();
  });
  return; // court-circuite le reste de main.js
}