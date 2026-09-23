/* =========================================================
   VOLTYX LAUNCHER — manifest.js
   Configuration des versions Minecraft + mods embarqués
   ========================================================= */

module.exports = {
  // Version de Minecraft
  minecraftVersion: "1.16.5",

  // Version de Forge
  forgeVersion: "1.16.5-36.2.34",

  // Version de Java requise (pour info)
  javaVersion: 8,

  // Serveur par défaut
  serverSlug: "lumalia",

  // Liste des mods embarqués dans le launcher
  // ⚠️ Les fichiers sont dans launcher/minecraft/mods/
  mods: [
    { name: "Dynmap", filename: "Dynmap-3.5-forge-1.16.5.jar" },
    { name: "MCW Furniture", filename: "mcw-furniture-3.4.1-mc1.16.5forge.jar" },
    { name: "Mod IDL", filename: "modid-1.0.jar" },
    { name: "PacketFixer", filename: "packetfixer-forge-2.0.1-1.16.5.jar" },
    { name: "WorldEdit", filename: "worldedit-mod-7.2.5-dist.jar" }
  ]
};