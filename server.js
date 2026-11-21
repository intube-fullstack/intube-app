const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = "admin@intube.local";

const DATA_FILE = path.join(__dirname, "intube-db.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(__dirname));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const upload = multer({ storage });

const initialDB = {
  channels: {
    "codewithali@intube.local": {
      ownerEmail: "codewithali@intube.local",
      name: "CodeWithAli",
      handle: "@codewithali",
      bio: "Web development & coding tutorials in simple words.",
      subscribers: 1250,
      logoUrl: "",
      bannerUrl: ""
    },
    "futuretech@intube.local": {
      ownerEmail: "futuretech@intube.local",
      name: "FutureTech",
      handle: "@futuretech",
      bio: "AI tools, tech reviews & future trends.",
      subscribers: 890,
      logoUrl: "",
      bannerUrl: ""
    }
  },
  videos: [
    {
      id: "vid_1",
      title: "Build a Full Website in 15 Minutes | HTML CSS JS",
      description: "Complete crash course on building a modern responsive website from scratch.",
      channel: "CodeWithAli",
      ownerEmail: "codewithali@intube.local",
      category: "Coding",
      visibility: "public",
      isShort: false,
      views: 24000,
      likes: 1240,
      dislikes: 18,
      thumbnailUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&q=80",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      comments: [
        { id: "c_1", author: "@usman_dev", text: "Bohat clear aur helpful tutorial hai!", createdAt: "2 days ago" }
      ],
      createdAt: Date.now() - 86400000 * 2
    },
    {
      id: "vid_2",
      title: "Top 5 AI Tools You Must Try in 2026",
      description: "Best AI productivity, coding, and video tools explained in simple words.",
      channel: "FutureTech",
      ownerEmail: "futuretech@intube.local",
      category: "AI & Tech",
      visibility: "public",
      isShort: false,
      views: 43200,
      likes: 2150,
      dislikes: 34,
      thumbnailUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=80",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      comments: [],
      createdAt: Date.now() - 86400000 * 4
    },
    {
      id: "vid_short_1",
      title: "1-Min CSS Grid Trick #Shorts",
      description: "Quick layout trick in under 60 seconds.",
      channel: "CodeWithAli",
      ownerEmail: "codewithali@intube.local",
      category: "Shorts",
      visibility: "public",
      isShort: true,
      views: 9500,
      likes: 610,
      dislikes: 5,
      thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&q=80",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      comments: [],
      createdAt: Date.now() - 86400000 * 1
    }
  ],
  users: {}
};

function readDB() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialDB, null, 2));
  }
  const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (!db.channels) db.channels = {};
  return db;
}

function writeDB(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function defaultHandleFromEmail(email) {
  const base = (email.split("@")[0] || "creator").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `@${base}`;
}

function defaultNameFromEmail(email) {
  const raw = email.split("@")[0] || "Creator";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function ensureChannelForUser(db, email) {
  const key = (email || "guest@intube.local").toLowerCase();
  if (!db.channels[key]) {
    db.channels[key] = {
      ownerEmail: key,
      name: `${defaultNameFromEmail(key)} Channel`,
      handle: defaultHandleFromEmail(key),
      bio: "Welcome to my InTube channel!",
      subscribers: 0,
      logoUrl: "",
      bannerUrl: ""
    };
  }
  return db.channels[key];
}

function getOrCreateUser(db, email) {
  const key = (email || "guest@intube.local").toLowerCase();
  if (!db.users[key]) {
    db.users[key] = {
      email: key,
      subscribedChannels: [],
      watchLater: [],
      likedVideos: [],
      dislikedVideos: [],
      history: []
    };
  }
  return db.users[key];
}

function canManageVideo(video, requesterEmail, isAdminMode) {
  const email = (requesterEmail || "").toLowerCase();
  if (email === ADMIN_EMAIL || isAdminMode) return true;
  return video.ownerEmail && video.ownerEmail.toLowerCase() === email;
}

// --- ROUTES ---

app.get("/api/state", (req, res) => {
  const db = readDB();
  const userEmail = (req.query.email || "guest@intube.local").toLowerCase();
  const isAdmin = req.query.admin === "true" || userEmail === ADMIN_EMAIL;

  const user = getOrCreateUser(db, userEmail);
  const myChannel = ensureChannelForUser(db, userEmail);

  const visibleVideos = isAdmin
    ? db.videos
    : db.videos.filter((v) => v.visibility === "public" || v.ownerEmail === userEmail);

  res.json({
    myChannel,
    channels: db.channels,
    videos: visibleVideos,
    user,
    isAdminUser: userEmail === ADMIN_EMAIL
  });
});

app.post("/api/auth", (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email required" });

  const db = readDB();
  const user = getOrCreateUser(db, email);
  const myChannel = ensureChannelForUser(db, email);
  writeDB(db);
  res.json({ user, myChannel });
});

// Update Specific User's Channel Branding
app.post(
  "/api/channel",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 }
  ]),
  (req, res) => {
    const db = readDB();
    const ownerEmail = (req.body.ownerEmail || req.body.email || "guest@intube.local").toLowerCase();
    const ch = ensureChannelForUser(db, ownerEmail);
    const oldName = ch.name;

    if (req.body.name) ch.name = req.body.name.trim();
    if (req.body.handle) {
      const h = req.body.handle.trim();
      ch.handle = h.startsWith("@") ? h : `@${h}`;
    }
    if (req.body.bio !== undefined) ch.bio = req.body.bio.trim();

    if (req.files && req.files.logo && req.files.logo[0]) {
      ch.logoUrl = `/uploads/${req.files.logo[0].filename}`;
    }
    if (req.files && req.files.banner && req.files.banner[0]) {
      ch.bannerUrl = `/uploads/${req.files.banner[0].filename}`;
    }

    // Keep user's uploaded videos synced with updated channel name
    if (oldName !== ch.name) {
      db.videos.forEach((v) => {
        if (v.ownerEmail === ownerEmail) {
          v.channel = ch.name;
        }
      });
    }

    writeDB(db);
    res.json({ channel: ch });
  }
);

// Upload Video + Thumbnail by Any User
app.post(
  "/api/videos",
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  (req, res) => {
    const db = readDB();
    const thumbFile = req.files?.thumbnail?.[0];
    const videoFile = req.files?.video?.[0];

    if (!thumbFile || !videoFile) {
      return res.status(400).json({ error: "Thumbnail aur Video dono files zaroori hain." });
    }

    const ownerEmail = (req.body.ownerEmail || "guest@intube.local").toLowerCase();
    const userChannel = ensureChannelForUser(db, ownerEmail);
    const category = req.body.category || "Coding";

    const newVideo = {
      id: `vid_${Date.now()}`,
      title: (req.body.title || "Untitled Video").trim(),
      description: (req.body.description || "").trim(),
      channel: (req.body.channel || userChannel.name).trim(),
      ownerEmail,
      category,
      visibility: req.body.visibility || "public",
      isShort: category === "Shorts" || req.body.isShort === "true",
      views: 1,
      likes: 0,
      dislikes: 0,
      thumbnailUrl: `/uploads/${thumbFile.filename}`,
      videoUrl: `/uploads/${videoFile.filename}`,
      comments: [],
      createdAt: Date.now()
    };

    db.videos.unshift(newVideo);
    writeDB(db);
    res.status(201).json({ video: newVideo });
  }
);

// Edit Video (Owner or Admin)
app.put("/api/videos/:id", (req, res) => {
  const db = readDB();
  const vid = db.videos.find((v) => v.id === req.params.id);
  if (!vid) return res.status(404).json({ error: "Video nahi mili" });

  if (!canManageVideo(vid, req.body.requesterEmail, req.body.isAdmin)) {
    return res.status(403).json({ error: "Aap sirf apni videos edit kar sakte hain." });
  }

  if (req.body.title !== undefined) vid.title = req.body.title.trim();
  if (req.body.description !== undefined) vid.description = req.body.description.trim();
  if (req.body.category !== undefined) {
    vid.category = req.body.category;
    vid.isShort = req.body.category === "Shorts";
  }
  if (req.body.visibility !== undefined) vid.visibility = req.body.visibility;

  writeDB(db);
  res.json({ video: vid });
});

// Delete Video (Owner or Admin)
app.delete("/api/videos/:id", (req, res) => {
  const db = readDB();
  const idx = db.videos.findIndex((v) => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Video nahi mili" });

  const requesterEmail = req.query.email || req.body?.requesterEmail || "";
  const isAdminMode = req.query.admin === "true" || Boolean(req.body?.isAdmin);

  if (!canManageVideo(db.videos[idx], requesterEmail, isAdminMode)) {
    return res.status(403).json({ error: "Aap sirf apni videos delete kar sakte hain." });
  }

  const [removed] = db.videos.splice(idx, 1);
  [removed.thumbnailUrl, removed.videoUrl].forEach((url) => {
    if (url && url.startsWith("/uploads/")) {
      const filePath = path.join(__dirname, url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
    }
  });

  writeDB(db);
  res.json({ deletedId: req.params.id });
});

// Record View + Watch History
app.post("/api/videos/:id/view", (req, res) => {
  const db = readDB();
  const vid = db.videos.find((v) => v.id === req.params.id);
  if (!vid) return res.status(404).json({ error: "Video nahi mili" });

  vid.views = (vid.views || 0) + 1;
  const user = getOrCreateUser(db, req.body.email);
  user.history = [vid.id, ...user.history.filter((id) => id !== vid.id)].slice(0, 50);

  writeDB(db);
  res.json({ video: vid, user });
});

// Toggle Like / Dislike
app.post("/api/videos/:id/react", (req, res) => {
  const { type, email } = req.body;
  const db = readDB();
  const vid = db.videos.find((v) => v.id === req.params.id);
  if (!vid) return res.status(404).json({ error: "Video nahi mili" });

  const user = getOrCreateUser(db, email);
  const likedIdx = user.likedVideos.indexOf(vid.id);
  const dislikedIdx = user.dislikedVideos.indexOf(vid.id);

  if (type === "like") {
    if (likedIdx === -1) {
      user.likedVideos.push(vid.id);
      vid.likes = (vid.likes || 0) + 1;
      if (dislikedIdx !== -1) {
        user.dislikedVideos.splice(dislikedIdx, 1);
        vid.dislikes = Math.max(0, (vid.dislikes || 0) - 1);
      }
    } else {
      user.likedVideos.splice(likedIdx, 1);
      vid.likes = Math.max(0, (vid.likes || 0) - 1);
    }
  } else if (type === "dislike") {
    if (dislikedIdx === -1) {
      user.dislikedVideos.push(vid.id);
      vid.dislikes = (vid.dislikes || 0) + 1;
      if (likedIdx !== -1) {
        user.likedVideos.splice(likedIdx, 1);
        vid.likes = Math.max(0, (vid.likes || 0) - 1);
      }
    } else {
      user.dislikedVideos.splice(dislikedIdx, 1);
      vid.dislikes = Math.max(0, (vid.dislikes || 0) - 1);
    }
  }

  writeDB(db);
  res.json({ video: vid, user });
});

// Toggle Watch Later
app.post("/api/watch-later", (req, res) => {
  const { videoId, email } = req.body;
  const db = readDB();
  const user = getOrCreateUser(db, email);
  const idx = user.watchLater.indexOf(videoId);
  if (idx === -1) user.watchLater.push(videoId);
  else user.watchLater.splice(idx, 1);
  writeDB(db);
  res.json({ user });
});

// Toggle Subscribe (Updates target channel's subscriber count)
app.post("/api/subscribe", (req, res) => {
  const { channelName, ownerEmail, email } = req.body;
  const db = readDB();
  const user = getOrCreateUser(db, email);
  const idx = user.subscribedChannels.indexOf(channelName);

  const targetChannel =
    (ownerEmail && db.channels[ownerEmail.toLowerCase()]) ||
    Object.values(db.channels).find((c) => c.name === channelName);

  if (idx === -1) {
    user.subscribedChannels.push(channelName);
    if (targetChannel) targetChannel.subscribers = (targetChannel.subscribers || 0) + 1;
  } else {
    user.subscribedChannels.splice(idx, 1);
    if (targetChannel) targetChannel.subscribers = Math.max(0, (targetChannel.subscribers || 0) - 1);
  }

  writeDB(db);
  res.json({ channels: db.channels, user });
});

// Add Comment
app.post("/api/videos/:id/comments", (req, res) => {
  const { author, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "Comment empty hai" });

  const db = readDB();
  const vid = db.videos.find((v) => v.id === req.params.id);
  if (!vid) return res.status(404).json({ error: "Video nahi mili" });

  const comment = {
    id: `c_${Date.now()}`,
    author: author || "@guest",
    text: text.trim(),
    createdAt: "Just now"
  };
  vid.comments.unshift(comment);
  writeDB(db);
  res.status(201).json({ comment, comments: vid.comments });
});

// Delete Comment (Video Owner or Admin)
app.delete("/api/videos/:videoId/comments/:commentId", (req, res) => {
  const db = readDB();
  const vid = db.videos.find((v) => v.id === req.params.videoId);
  if (!vid) return res.status(404).json({ error: "Video nahi mili" });

  const requesterEmail = (req.query.email || "").toLowerCase();
  const isAdminMode = req.query.admin === "true" || requesterEmail === ADMIN_EMAIL;

  if (!canManageVideo(vid, requesterEmail, isAdminMode)) {
    return res.status(403).json({ error: "Sirf video owner ya admin comment delete kar sakta hai." });
  }

  vid.comments = vid.comments.filter((c) => c.id !== req.params.commentId);
  writeDB(db);
  res.json({ comments: vid.comments });
});

app.listen(PORT, () => {
  console.log(`InTube server running at http://localhost:${PORT}`);
});