import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import ytdl from "@distube/ytdl-core";
import ffmpegPath from "ffmpeg-static";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";

// Dynamic filesystem patch for ytdl-core bot check fallback
try {
  const infoPath = path.join(process.cwd(), "node_modules", "@distube", "ytdl-core", "lib", "info.js");
  if (fs.existsSync(infoPath)) {
    let content = fs.readFileSync(infoPath, "utf-8");
    
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

    if (content.includes("WEB player blocked by bot check") && !content.includes("(v2)")) {
      const startIndex = content.indexOf("  let playErr = utils.playError(info.player_response);\n  if (playErr) {");
      const endIndex = content.indexOf("  Object.assign(info, {", startIndex);
      if (startIndex !== -1 && endIndex !== -1) {
        content = content.substring(0, startIndex) + replacementStr + "\n\n" + content.substring(endIndex);
        fs.writeFileSync(infoPath, content, "utf-8");
        console.log("[ytdl-patch] info.js old patch successfully upgraded to (v2)!");
      }
    } else if (!content.includes("WEB player blocked by bot check")) {
      const targetStr = "  const playErr = utils.playError(info.player_response);\n  if (playErr) throw playErr;";
      content = content.replace(targetStr, replacementStr);
      fs.writeFileSync(infoPath, content, "utf-8");
      console.log("[ytdl-patch] info.js patched successfully with (v2)!");
    } else {
      console.log("[ytdl-patch] info.js is already patched and upgraded to (v2).");
    }
  }
} catch (patchErr) {
  console.error("[ytdl-patch] Failed to dynamically patch info.js:", patchErr);
}

function parseCookies(cookiesInput: string): any[] {
  let trimmed = cookiesInput.trim();
  if (!trimmed) return [];
  
  // Strip outer quotes if copied with quotes
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim();
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim();
  }
  
  // 1. JSON Array format
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(c => ({
          ...c,
          // Ensure expirationDate is mapped correctly so ytdl-core's convertCookie can read it
          expirationDate: typeof c.expirationDate === 'number' ? c.expirationDate : (typeof c.expires === 'number' ? c.expires : undefined),
          expires: typeof c.expires === 'number' ? c.expires : (typeof c.expirationDate === 'number' ? c.expirationDate : undefined),
          domain: c.domain || '.youtube.com',
          path: c.path || '/'
        }));
      }
    } catch (e) {
      console.error("Failed to parse cookies as JSON array:", e);
    }
  }
  
  // 2. Netscape cookies format
  if (trimmed.includes('\t') || trimmed.includes('# Netscape HTTP Cookie File')) {
    try {
      const cookies: any[] = [];
      const lines = trimmed.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim() || line.startsWith('#')) continue;
        const parts = line.split(/\t/);
        if (parts.length >= 7) {
          const expSeconds = parseInt(parts[4], 10) || undefined;
          cookies.push({
            domain: parts[0],
            path: parts[2],
            secure: parts[3] === 'TRUE',
            expirationDate: expSeconds,
            expires: expSeconds,
            name: parts[5],
            value: parts[6].trim()
          });
        }
      }
      if (cookies.length > 0) return cookies;
    } catch (e) {
      console.error("Failed to parse cookies as Netscape format:", e);
    }
  }
  
  // 3. Raw header cookie string ("name=value; name2=value2")
  try {
    const cookies: any[] = [];
    const pairs = trimmed.split(';');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const key = pair.substring(0, eqIdx).trim();
      const val = pair.substring(eqIdx + 1).trim();
      if (key && val) {
        cookies.push({
          name: key,
          value: val,
          domain: '.youtube.com',
          path: '/'
        });
      }
    }
    return cookies;
  } catch (e) {
    console.error("Failed to parse cookies as header string:", e);
  }
  
  return [];
}

function buildCookieHeaderString(cookies: any[]): string {
  if (!cookies || cookies.length === 0) return "";
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse json requests
  app.use(express.json());

  // Memory store for video clipping jobs
  interface ClipJob {
    id: string;
    url: string;
    startTime: string;
    duration: number;
    quality: string;
    mode: 'fast' | 'precise';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    outputFile?: string;
    error?: string;
    logs: string[];
    title: string;
    cookies?: any[];
  }

  const jobs = new Map<string, ClipJob>();

  // API 1: Analyze YouTube Video URL
  app.get("/api/analyze", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Ju lutemi jepni një URL të vlefshme për YouTube.' });
      }

      // Validate URL first
      const isValid = ytdl.validateURL(url);
      if (!isValid) {
        return res.status(400).json({ error: 'URL-ja e vendosur nuk duket si një vegë e vlefshme YouTube.' });
      }

      const cookiesHeader = req.headers['x-youtube-cookies'] as string;
      let agent: any = undefined;
      if (cookiesHeader) {
        const parsed = parseCookies(cookiesHeader);
        if (parsed.length > 0) {
          try {
            agent = ytdl.createAgent(parsed);
          } catch (agentErr: any) {
            console.error("Error creating ytdl Agent with x-youtube-cookies:", agentErr);
          }
        }
      } else if (process.env.YOUTUBE_COOKIES) {
        const parsed = parseCookies(process.env.YOUTUBE_COOKIES);
        if (parsed.length > 0) {
          try {
            agent = ytdl.createAgent(parsed);
          } catch (agentErr: any) {
            console.error("Error creating ytdl Agent with server environment cookies:", agentErr);
          }
        }
      }

      const videoId = ytdl.getVideoID(url);
      const info = await ytdl.getInfo(url, {
        playerClients: ["IOS", "ANDROID", "TV"],
        ...(agent ? { agent } : {})
      });
      const details = (info.videoDetails || {}) as any;

      // Extract unique resolution labels
      const resolutions = new Set<string>();
      if (info.formats && Array.isArray(info.formats)) {
        info.formats.forEach(f => {
          if (f.qualityLabel) {
            resolutions.add(f.qualityLabel);
          }
        });
      }

      const isLive = !!details.isLiveContent;

      // Sort resolutions descending (1080p, 720p, 480p, 360p, etc)
      const sortedResolutions = Array.from(resolutions).sort((a, b) => {
        const resA = parseInt(a, 10) || 0;
        const resB = parseInt(b, 10) || 0;
        return resB - resA;
      });

      const thumbnailsList = details.thumbnails || details.thumbnail?.thumbnails || [];
      const bestThumbnailUrl = thumbnailsList.length > 0 ? thumbnailsList[thumbnailsList.length - 1]?.url : '';

      res.json({
        id: videoId,
        title: details.title || 'Video pa titull',
        author: details.author?.name || 'Autor i panjohur',
        duration: parseInt(details.lengthSeconds || '', 10) || 0,
        isLive,
        thumbnails: thumbnailsList,
        thumbnail: bestThumbnailUrl || '',
        resolutions: sortedResolutions.length > 0 ? sortedResolutions : ['720p', '480p', '360p'], // fallback
      });
    } catch (error: any) {
      console.error('Error analyzing YouTube video:', error);
      let userFriendlyError = 'Nuk u arrit të analizohej videoja. Sigurohuni që URL është e saktë, videoja nuk ka kufizim moshe dhe është publike.';
      const errMsg = error.message || '';
      if (errMsg.includes("Sign in to confirm you") || errMsg.includes("not a bot") || errMsg.includes("LOGIN_REQUIRED")) {
        userFriendlyError = 'YouTube ka bllokuar kërkesën me mbrojtje kundër bot-ëve. Ju lutemi hapni "Cilësime të avancuara" më poshtë dhe ngjisni "YouTube Cookies" për ta tejkaluar këtë kufizim.';
      }
      res.status(500).json({ 
        error: userFriendlyError,
        details: error.message 
      });
    }
  });

  // API 2: Start clipping job
  app.post("/api/clip", async (req, res) => {
    try {
      const { url, startTime, duration, quality, mode } = req.body;
      if (!url || !startTime) {
        return res.status(400).json({ error: 'U rëndua kërkesa: mungojnë fushë e detyrueshme si URL apo koha e fillimit.' });
      }

      const durationSecs = parseInt(duration, 10);
      if (isNaN(durationSecs) || durationSecs <= 0) {
        return res.status(400).json({ error: 'Kohëzgjatja duhet të jetë një numër pozitiv.' });
      }

      // Guard limits for resource protection
      if (durationSecs > 900) {
        return res.status(400).json({ error: 'Kohëzgjatja maksimale e lejuar për klip është 15 minuta (900 sekonda).' });
      }

      const isValid = ytdl.validateURL(url);
      if (!isValid) {
        return res.status(400).json({ error: 'URL-ja e vendosur është e pavlefshme.' });
      }

      const cookiesHeader = req.headers['x-youtube-cookies'] as string;
      let agent: any = undefined;
      let parsedCookies: any[] | undefined = undefined;
      if (cookiesHeader) {
        parsedCookies = parseCookies(cookiesHeader);
        if (parsedCookies && parsedCookies.length > 0) {
          try {
            agent = ytdl.createAgent(parsedCookies);
          } catch (agentErr) {
            console.error("Error creating ytdl Agent with x-youtube-cookies:", agentErr);
          }
        }
      } else if (process.env.YOUTUBE_COOKIES) {
        parsedCookies = parseCookies(process.env.YOUTUBE_COOKIES);
        if (parsedCookies && parsedCookies.length > 0) {
          try {
            agent = ytdl.createAgent(parsedCookies);
          } catch (agentErr) {
            console.error("Error creating ytdl Agent with server environment cookies:", agentErr);
          }
        }
      }

      const info = await ytdl.getInfo(url, {
        playerClients: ["IOS", "ANDROID", "TV"],
        ...(agent ? { agent } : {})
      });
      const title = info.videoDetails.title;

      const jobId = Math.random().toString(36).substring(2, 11);
      
      const job: ClipJob = {
        id: jobId,
        url,
        startTime,
        duration: durationSecs,
        quality: quality || '720p',
        mode: mode || 'fast',
        status: 'pending',
        progress: 0,
        title,
        logs: ['Po inicializohet procesi i prerjes sekondare...'],
        cookies: parsedCookies
      };

      jobs.set(jobId, job);

      // Start asynchronous cutting background process
      processClipJob(job);

      res.json({ jobId, title });
    } catch (error: any) {
      console.error('Error starting clip:', error);
      let userFriendlyError = 'Dështoi nisja e prerjes së videos. Sqarimi: ' + error.message;
      const errMsg = error.message || '';
      if (errMsg.includes("Sign in to confirm you") || errMsg.includes("not a bot") || errMsg.includes("LOGIN_REQUIRED")) {
        userFriendlyError = 'Dështoi fillimi i prerjes. YouTube bllokoi kërkesën për shkak të mbrojtjes kundër bot-ëve. Ngjisni valid "YouTube Cookies" te "Cilësime të avancuara" më poshtë.';
      }
      res.status(500).json({ error: userFriendlyError });
    }
  });

  // API 3: Fetch active job status
  app.get("/api/status/:jobId", (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Ky proces klipimi nuk ekziston.' });
    }
    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      title: job.title,
      logs: job.logs
    });
  });

  // API 4: Download completed clip file
  app.get("/api/download/:jobId", (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    if (!job || !job.outputFile || job.status !== 'completed') {
      return res.status(404).send('Klipi nuk ekziston ose procesi nuk ka përfunduar ende.');
    }

    if (!fs.existsSync(job.outputFile)) {
      return res.status(404).send('Skedari fizik nuk u gjet (mund të jetë fshirë për siguri apo hapësirë).');
    }

    // Sanitize title for robust attachment headers
    const cleanTitle = job.title.replace(/[^a-zA-Z0-9_\u00c0-\u00ff-]/g, '_').substring(0, 50) || 'video_clip';
    const downloadName = `${cleanTitle}_segment.mp4`;

    res.download(job.outputFile, downloadName, (err) => {
      if (err) {
        console.error('File download delivery error:', err);
      } else {
        // Schedule cleanup after 45 seconds to guarantee secure transfer completed
        setTimeout(() => {
          try {
            if (job.outputFile && fs.existsSync(job.outputFile)) {
              fs.unlinkSync(job.outputFile);
              console.log(`Fshirë me sukses skedari i përkohshëm pas shkarkimit: ${job.outputFile}`);
            }
          } catch (cleanupErr) {
            console.error('Buffer cleanup logic mistake:', cleanupErr);
          }
        }, 45000);
      }
    });
  });

  // Background ffmpeg clipping processor
  async function processClipJob(job: ClipJob) {
    const outputDir = path.join(os.tmpdir(), 'youtube-clipper-downloads');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `clip_${job.id}.mp4`);
    job.status = 'processing';
    job.progress = 5;
    job.logs.push('Marrja e lidhjeve kryesore të transmetimit të YouTube...');

    try {
      if (!ffmpegPath) {
        throw new Error('Nuk u gjet asnjë ekzekutues ffmpeg-static.');
      }

      let agent: any = undefined;
      let parsedCookies: any[] = [];
      if (job.cookies && job.cookies.length > 0) {
        parsedCookies = job.cookies;
        try {
          agent = ytdl.createAgent(parsedCookies);
        } catch (agentErr) {
          console.error("Error creating background agent with job cookies:", agentErr);
        }
      } else if (process.env.YOUTUBE_COOKIES) {
        parsedCookies = parseCookies(process.env.YOUTUBE_COOKIES);
        if (parsedCookies.length > 0) {
          try {
            agent = ytdl.createAgent(parsedCookies);
          } catch (agentErr) {
            console.error("Error creating background agent with server env cookies:", agentErr);
          }
        }
      }

      const info = await ytdl.getInfo(job.url, {
        playerClients: ["IOS", "ANDROID", "TV"],
        ...(agent ? { agent } : {})
      });
      const isLive = info.videoDetails.isLiveContent;

      let ffmpegArgs: string[] = [];
      const cookieHeaderVal = parsedCookies.length > 0 ? buildCookieHeaderString(parsedCookies) : "";

      if (isLive) {
        job.logs.push('Sistemi detektoi: Transmetim LIVE Aktiv.');
        
        // Retrieve standard HLS format with .m3u8 extension
        const hlsFormat = info.formats.find(f => f.isHLS || f.url?.includes('manifest/hls_playlist') || f.mimeType?.includes('mpegURL'));
        if (!hlsFormat) {
          throw new Error('Nuk u gjet asnjë rrjedhë HLS (.m3u8) aktive për këtë transmetim live.');
        }

        const hlsUrl = hlsFormat.url;
        job.logs.push('U krye lidhja me burimin m3u8 të transmetimit.');

        // For live, apply seek if specified (e.g. not 0), then input
        if (job.startTime && job.startTime !== '00:00:00' && job.startTime !== '0' && job.startTime !== '00:00') {
          ffmpegArgs.push('-ss', job.startTime);
          job.logs.push(`Marrja fillon me zhvendosjen kohore (Seek): ${job.startTime}`);
        } else {
          job.logs.push('Klipi fillon nga koha aktuale live...');
        }

        if (cookieHeaderVal) {
          ffmpegArgs.push('-headers', `Cookie: ${cookieHeaderVal}\r\n`);
        }
        ffmpegArgs.push('-i', hlsUrl);
        ffmpegArgs.push('-t', job.duration.toString());

        if (job.mode === 'fast') {
          job.logs.push('Duke përdorur modalitetin Shpejtë (Kopjim i Drejtpërdrejtë)...');
          ffmpegArgs.push('-c:v', 'copy', '-c:a', 'copy');
        } else {
          job.logs.push('Duke përdorur modalitetin Preçiz (Rikodifikim H.264)...');
          ffmpegArgs.push('-c:v', 'libx264', '-preset', 'superfast', '-crf', '23', '-c:a', 'aac');
        }
      } else {
        job.logs.push('Sistemi detektoi: Video standarde e regjistruar.');

        // Fetch discrete audio and video tracks
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        const bestAudio = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

        const videoFormats = info.formats.filter(f => f.hasVideo && !f.hasAudio && f.qualityLabel === job.quality);
        let selectedVideo = videoFormats[0];

        // Fallback quality search if preferred quality is missing
        if (!selectedVideo) {
          const anyVideo = info.formats.filter(f => f.hasVideo && f.qualityLabel);
          selectedVideo = anyVideo.find(f => f.qualityLabel === job.quality) || anyVideo[0] || info.formats.find(f => f.hasVideo);
        }

        if (!selectedVideo) {
          throw new Error(`Nuk u zbulua asnjë format video i pranueshëm për cilësinë ${job.quality}.`);
        }

        job.logs.push(`Zgjedhur rrjedha e videos: ${selectedVideo.qualityLabel} (${selectedVideo.container})`);
        if (bestAudio) {
          job.logs.push(`Zgjedhur rrjedha e audios: ${bestAudio.audioBitrate || 128} kbps`);
        }

        const videoUrl = selectedVideo.url;
        const audioUrl = bestAudio ? bestAudio.url : null;

        if (audioUrl) {
          // Merge audio and video on-the-fly to prevent massive full downloads
          ffmpegArgs.push('-ss', job.startTime);
          if (cookieHeaderVal) {
            ffmpegArgs.push('-headers', `Cookie: ${cookieHeaderVal}\r\n`);
          }
          ffmpegArgs.push('-i', videoUrl);
          ffmpegArgs.push('-ss', job.startTime);
          if (cookieHeaderVal) {
            ffmpegArgs.push('-headers', `Cookie: ${cookieHeaderVal}\r\n`);
          }
          ffmpegArgs.push('-i', audioUrl);
          ffmpegArgs.push('-t', job.duration.toString());
          ffmpegArgs.push('-map', '0:v:0');
          ffmpegArgs.push('-map', '1:a:0');

          if (job.mode === 'fast') {
            job.logs.push('Prerje e shpejtë pa rikodifikim...');
            ffmpegArgs.push('-c:v', 'copy');
          } else {
            job.logs.push('Rikodifikim për saktësi maksimale të kuadrove (H.264)...');
            ffmpegArgs.push('-c:v', 'libx264', '-preset', 'superfast', '-crf', '23');
          }
          ffmpegArgs.push('-c:a', 'aac');
        } else {
          // Format has audio/video integrated
          ffmpegArgs.push('-ss', job.startTime);
          if (cookieHeaderVal) {
            ffmpegArgs.push('-headers', `Cookie: ${cookieHeaderVal}\r\n`);
          }
          ffmpegArgs.push('-i', videoUrl);
          ffmpegArgs.push('-t', job.duration.toString());
          
          if (job.mode === 'fast') {
            ffmpegArgs.push('-c:v', 'copy');
          } else {
            ffmpegArgs.push('-c:v', 'libx264', '-preset', 'superfast', '-crf', '23');
          }
          if (selectedVideo.hasAudio) {
            ffmpegArgs.push('-c:a', 'aac');
          }
        }
      }

      // Add overwrite and output file path
      ffmpegArgs.push('-y', outputPath);

      job.logs.push(`Po niset procesi i FFmpeg për segmentimin e videos...`);
      console.log(`Spawning FFmpeg for job: ${job.id}`);

      const ffmpegProc = spawn(ffmpegPath, ffmpegArgs);

      ffmpegProc.stderr.on('data', (data) => {
        const logStr = data.toString();
        job.logs.push(logStr);
        if (job.logs.length > 60) job.logs.shift(); // Keep logs concise

        // Parse ffmpeg standard progress lines, e.g. 'time=00:02:11.45'
        const timeMatch = logStr.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (timeMatch) {
          const hrs = parseInt(timeMatch[1], 10);
          const mins = parseInt(timeMatch[2], 10);
          const secs = parseInt(timeMatch[3], 10);
          const ms = parseInt(timeMatch[4], 10);
          const totalProcessedSecs = hrs * 3600 + mins * 60 + secs + ms / 100;

          const percentage = Math.min(99, Math.round((totalProcessedSecs / job.duration) * 100));
          job.progress = Math.max(job.progress, percentage);
          job.status = 'processing';
        }
      });

      ffmpegProc.on('close', (code) => {
        if (code === 0) {
          job.progress = 100;
          job.status = 'completed';
          job.outputFile = outputPath;
          job.logs.push('Klipimi përfundoi me sukses të plotë! Skedari është gati për shkarkim.');
          console.log(`Prerja me ffmpeg u krye me sukses për punën: ${job.id}`);
        } else {
          job.status = 'failed';
          job.error = `Zgjedhja ose konvertimi dështoi me kodin ${code}`;
          job.logs.push(`Gabim: FFmpeg riktheu një gabim të brendshëm me kodin ${code}`);
          console.error(`FFmpeg failed for job ${job.id} with exit code ${code}`);
        }
      });

      ffmpegProc.on('error', (err) => {
        job.status = 'failed';
        job.error = err.message;
        job.logs.push(`Gabim i sistemit: ${err.message}`);
        console.error(`Process spawning failed:`, err);
      });

    } catch (err: any) {
      job.status = 'failed';
      const errMsg = err.message || '';
      if (errMsg.includes("Sign in to confirm you") || errMsg.includes("not a bot") || errMsg.includes("LOGIN_REQUIRED")) {
        job.error = 'YouTube bllokoi shkarkimin e këtij klipi por mund ta tejkaloni nëse vendosni valid "YouTube Cookies" te "Cilësime të avancuara" në faqen kryesore.';
        job.logs.push(`Gabim kritik: YouTube bllokoi shkarkimin (Mbrojtje kundër Bot-ëve). Ju lutemi vendosni valid 'YouTube Cookies' në faqen kryesore për të tejkaluar mbrojtjen.`);
      } else {
        job.error = err.message || 'Gabim teknik gjatë shpërbërjes.';
        job.logs.push(`Gabim kritik: ${err.message}`);
      }
      console.error(`Critial job processing error:`, err);
    }
  }

  // Periodic Cleanup Service (Every 5 Minutes) to delete leftover temp files
  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs.entries()) {
      if (job.outputFile && fs.existsSync(job.outputFile)) {
        try {
          const stats = fs.statSync(job.outputFile);
          const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);
          if (ageMinutes > 15) { // delete anything older than 15 minutes
            fs.unlinkSync(job.outputFile);
            jobs.delete(id);
            console.log(`Automatic trash cleaner triggered for stale clip: ${job.outputFile}`);
          }
        } catch (err) {
          console.error(`Err checking cleanup age for ${id}:`, err);
        }
      }
    }
  }, 5 * 60 * 1000);

  // Serve Single-Page Application via Vite (Development) or statically (Production)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Listen on the required container port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[YouTube Clipper] Server is actively listening on port ${PORT}`);
  });
}

startServer();
