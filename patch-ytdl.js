import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const infoPath = path.join(__dirname, "node_modules", "@distube", "ytdl-core", "lib", "info.js");

const replacementStr = `  let playErr = utils.playError(info.player_response);
  if (playErr) {
    const errMsg = playErr.message || "";
    if (
      errMsg.includes("confirm you're not a bot") ||
      errMsg.includes("confirm you’re not a bot") ||
      errMsg.includes("not a bot") ||
      errMsg.includes("bot check") ||
      errMsg.includes("LOGIN_REQUIRED") ||
      info.player_response?.playabilityStatus?.status === "LOGIN_REQUIRED"
    ) {
      console.warn("[ytdl-core] WEB player blocked by bot check. Attempting fallback clients to fetch player_response... (v2)");
      let fallbackSuccess = false;
      const clientsToTry = ["TV", "WEB_EMBEDDED", "ANDROID", "IOS"];
      
      // Ensure html5player is resolved to a full URL if it is already present relative-style
      if (info.html5player) {
         if (!info.html5player.startsWith("http")) {
            try {
              info.html5player = new URL(info.html5player, BASE_URL).toString();
            } catch (e) {
              info.html5player = "https://www.youtube.com" + (info.html5player.startsWith("/") ? "" : "/") + info.html5player;
            }
         }
      } else {
         const watchBody = await getWatchHTMLPageBody(id, options).catch(() => "");
         const parsedPlayer = getHTML5player(watchBody) || getHTML5player(await getEmbedPageBody(id, options).catch(() => ""));
         if (parsedPlayer) {
            if (!parsedPlayer.startsWith("http")) {
              info.html5player = new URL(parsedPlayer, BASE_URL).toString();
            } else {
              info.html5player = parsedPlayer;
            }
         }
      }

      for (const client of clientsToTry) {
        try {
          console.log(\`[ytdl-core] Trying client \${client} as fallback...\`);
          let response;
          if (client === "ANDROID") {
            response = await fetchAndroidJsonPlayer(id, options);
          } else if (client === "IOS") {
            response = await fetchIosJsonPlayer(id, options);
          } else if (client === "TV") {
            if (info.html5player) {
              response = await fetchTvPlayer(id, info, options);
            }
          } else if (client === "WEB_EMBEDDED") {
            if (info.html5player) {
              response = await fetchWebEmbeddedPlayer(id, info, options);
            }
          }

          if (response && response.videoDetails) {
            const fallbackPlayErr = utils.playError(response);
            if (!fallbackPlayErr) {
              console.log(\`[ytdl-core] Fallback to client \${client} succeeded!\`);
              info.player_response = response;
              playErr = null;
              fallbackSuccess = true;
              break;
            } else {
              console.warn(\`[ytdl-core] Fallback client \${client} returned play error:\`, fallbackPlayErr.message);
            }
          }
        } catch (fallbackErr) {
          console.warn(\`[ytdl-core] Fallback to client \${client} failed with error:\`, fallbackErr.message || fallbackErr);
        }
      }
      if (!fallbackSuccess) {
        console.error("[ytdl-core] All fallback clients failed to retrieve a non-blocked player response.");
        throw playErr;
      }
    } else {
      throw playErr;
    }
  }`;

try {
  if (fs.existsSync(infoPath)) {
    let content = fs.readFileSync(infoPath, "utf-8");

    if (content.includes("WEB player blocked by bot check") && !content.includes("(v2)")) {
      const startIndex = content.indexOf("  let playErr = utils.playError(info.player_response);\n  if (playErr) {");
      const endIndex = content.indexOf("  Object.assign(info, {", startIndex);
      if (startIndex !== -1 && endIndex !== -1) {
        content = content.substring(0, startIndex) + replacementStr + "\n\n" + content.substring(endIndex);
        fs.writeFileSync(infoPath, content, "utf-8");
        console.log("[ytdl-patch] Build-time: info.js old patch successfully upgraded to (v2)!");
      }
    } else if (!content.includes("WEB player blocked by bot check")) {
      const targetStr = "  const playErr = utils.playError(info.player_response);\n  if (playErr) throw playErr;";
      content = content.replace(targetStr, replacementStr);
      fs.writeFileSync(infoPath, content, "utf-8");
      console.log("[ytdl-patch] Build-time: info.js patched successfully with (v2)!");
    } else {
      console.log("[ytdl-patch] Build-time: info.js is already patched and upgraded to (v2).");
    }
  } else {
    console.error(`[ytdl-patch] info.js file not found at ${infoPath}. Skip patching.`);
  }
} catch (patchErr) {
  console.error("[ytdl-patch] Failed to patch info.js:", patchErr);
}
