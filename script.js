const API = "/api";
const ADMIN_EMAIL = "admin@intube.local";

let state = {
  myChannel: null,
  channels: {},
  videos: [],
  user: null,
  isAdminUser: false
};

let currentUserEmail = localStorage.getItem("intube_email") || "guest@intube.local";
let isLoggedIn = Boolean(localStorage.getItem("intube_email"));
let studioMode = false;
let currentCategory = "All";
let currentVideo = null;
let viewedChannelEmail = currentUserEmail;

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function canManage(vid) {
  const email = (currentUserEmail || "").toLowerCase();
  if (email === ADMIN_EMAIL || studioMode) return true;
  return vid.ownerEmail && vid.ownerEmail.toLowerCase() === email;
}

async function fetchState() {
  const res = await fetch(
    `${API}/state?email=${encodeURIComponent(currentUserEmail)}&admin=${studioMode}`
  );
  state = await res.json();
  renderAll();
}

function renderAll() {
  renderNavbar();
  if (studioMode) {
    renderStudio();
  }
  if (!document.getElementById("playerSection").classList.contains("hidden") && currentVideo) {
    const fresh = state.videos.find((v) => v.id === currentVideo.id);
    if (fresh) openPlayer(fresh, false);
  } else if (!document.getElementById("channelPage").classList.contains("hidden")) {
    renderChannelPage(viewedChannelEmail);
  } else {
    renderFeed();
  }
}

function renderNavbar() {
  const badge = document.getElementById("userBadge");
  const authBtn = document.getElementById("openAuthBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const avatar = document.getElementById("navAvatar");

  if (isLoggedIn) {
    badge.classList.remove("hidden");
    badge.innerText = currentUserEmail;
    authBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
    authBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }

  const ch = state.myChannel;
  if (ch?.logoUrl) {
    avatar.innerHTML = `<img src="${ch.logoUrl}" class="avatar" alt="Logo" />`;
  } else {
    avatar.innerText = (ch?.name || currentUserEmail || "I")[0].toUpperCase();
  }
}

function findChannelByOwnerOrName(ownerEmail, channelName) {
  if (ownerEmail && state.channels?.[ownerEmail.toLowerCase()]) {
    return state.channels[ownerEmail.toLowerCase()];
  }
  if (channelName && state.channels) {
    const match = Object.values(state.channels).find((c) => c.name === channelName);
    if (match) return match;
  }
  return {
    ownerEmail: ownerEmail || currentUserEmail,
    name: channelName || "Creator Channel",
    handle: "@creator",
    bio: "InTube Creator Channel",
    subscribers: 0,
    logoUrl: "",
    bannerUrl: ""
  };
}

function renderChannelPage(ownerEmail) {
  const targetEmail = (ownerEmail || currentUserEmail).toLowerCase();
  viewedChannelEmail = targetEmail;
  const ch = findChannelByOwnerOrName(targetEmail);

  document.getElementById("channelName").innerText = ch.name;
  document.getElementById("channelHandle").innerText =
    `${ch.handle} • ${(ch.subscribers || 0).toLocaleString()} subscribers`;
  document.getElementById("channelBio").innerText = ch.bio || "";

  document.getElementById("channelBannerImg").src =
    ch.bannerUrl || "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80";

  const logoImg = document.getElementById("channelLogoImg");
  const fallback = document.getElementById("channelLogoFallback");
  if (ch.logoUrl) {
    logoImg.src = ch.logoUrl;
    logoImg.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    logoImg.classList.add("hidden");
    fallback.classList.remove("hidden");
    fallback.innerText = (ch.name || "I")[0].toUpperCase();
  }

  const actionsEl = document.getElementById("channelPageActions");
  const isOwnChannel = targetEmail === currentUserEmail.toLowerCase() || currentUserEmail.toLowerCase() === ADMIN_EMAIL;

  if (isOwnChannel) {
    actionsEl.innerHTML = `
      <button class="edit-btn" onclick="openChannelModal()"><i class="fa-solid fa-pen"></i> Customize Channel</button>
      <button class="create-btn" onclick="openUploadModal()"><i class="fa-solid fa-video"></i> Upload Video</button>
    `;
  } else {
    const isSub = (state.user?.subscribedChannels || []).includes(ch.name);
    actionsEl.innerHTML = `
      <button class="sub-btn ${isSub ? "subscribed" : ""}" onclick="subscribeChannelByName('${ch.name}', '${targetEmail}')">
        ${isSub ? "Subscribed" : "Subscribe"}
      </button>
    `;
  }

  const chVideos = state.videos.filter(
    (v) => (v.ownerEmail && v.ownerEmail.toLowerCase() === targetEmail) || v.channel === ch.name
  );
  const grid = document.getElementById("channelVideosGrid");
  grid.innerHTML = "";
  if (!chVideos.length) {
    grid.innerHTML = `<p style="color:#aaa">Is channel par abhi koi video upload nahi hui.</p>`;
    return;
  }
  chVideos.forEach((vid) => grid.appendChild(createCard(vid)));
}

function createCard(vid) {
  const card = document.createElement("div");
  card.className = "video-card";
  card.innerHTML = `
    <img src="${vid.thumbnailUrl}" alt="${vid.title}" class="thumbnail" />
    <div class="video-info">
      <div class="channel-avatar">${(vid.channel || "C")[0].toUpperCase()}</div>
      <div class="video-details">
        <h4>${vid.title}</h4>
        <p>${vid.channel}</p>
        <p>${(vid.views || 0).toLocaleString()} views • ${vid.category}</p>
      </div>
    </div>
  `;
  card.onclick = () => openPlayer(vid, true);
  return card;
}

function renderFeed(customList = null, headingText = "") {
  const grid = document.getElementById("videoGrid");
  const heading = document.getElementById("feedHeading");
  const query = document.getElementById("searchInput").value.trim().toLowerCase();

  let list = customList || state.videos;
  if (!customList && currentCategory !== "All") {
    list = list.filter((v) => v.category === currentCategory);
  }
  if (query) {
    list = list.filter(
      (v) =>
        v.title.toLowerCase().includes(query) ||
        (v.channel || "").toLowerCase().includes(query) ||
        (v.category || "").toLowerCase().includes(query)
    );
  }

  if (headingText) {
    heading.classList.remove("hidden");
    heading.innerText = headingText;
  } else {
    heading.classList.add("hidden");
  }

  grid.classList.remove("hidden");
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `<p style="color:#aaa">Koi video nahi mili.</p>`;
    return;
  }
  list.forEach((vid) => grid.appendChild(createCard(vid)));
}

function hideMainSections() {
  document.getElementById("mainVideoPlayer").pause();
  document.getElementById("playerSection").classList.add("hidden");
  document.getElementById("channelPage").classList.add("hidden");
  document.getElementById("videoGrid").classList.add("hidden");
  document.getElementById("feedHeading").classList.add("hidden");
}

function goHome(e) {
  if (e) e.preventDefault();
  currentCategory = "All";
  hideMainSections();
  renderFeed();
}

function filterCategory(cat, el, e) {
  if (e) e.preventDefault();
  document.querySelectorAll(".chip, .side-link").forEach((n) => n.classList.remove("active"));
  if (el) el.classList.add("active");
  currentCategory = cat;
  hideMainSections();
  renderFeed();
}

function openShortsView(el, e) {
  if (e) e.preventDefault();
  document.querySelectorAll(".chip, .side-link").forEach((n) => n.classList.remove("active"));
  if (el) el.classList.add("active");
  hideMainSections();
  const shorts = state.videos.filter((v) => v.isShort || v.category === "Shorts");
  renderFeed(shorts, "InTube Shorts");
}

function openChannelView(ownerEmail, e) {
  if (e) e.preventDefault();
  hideMainSections();
  document.getElementById("channelPage").classList.remove("hidden");
  renderChannelPage(ownerEmail || currentUserEmail);
}

function openCurrentVideoChannel() {
  if (!currentVideo) return;
  const ch = findChannelByOwnerOrName(currentVideo.ownerEmail, currentVideo.channel);
  openChannelView(ch.ownerEmail || currentUserEmail);
}

function openUserTab(tab, el, e) {
  if (e) e.preventDefault();
  document.querySelectorAll(".chip, .side-link").forEach((n) => n.classList.remove("active"));
  if (el) el.classList.add("active");
  hideMainSections();

  const u = state.user || {};
  if (tab === "subscriptions") {
    const subs = u.subscribedChannels || [];
    const list = state.videos.filter((v) => subs.includes(v.channel));
    renderFeed(list, `Subscriptions (${subs.length})`);
  } else if (tab === "watchLater") {
    const list = state.videos.filter((v) => (u.watchLater || []).includes(v.id));
    renderFeed(list, "Watch Later");
  } else if (tab === "liked") {
    const list = state.videos.filter((v) => (u.likedVideos || []).includes(v.id));
    renderFeed(list, "Liked Videos");
  } else if (tab === "history") {
    const hist = u.history || [];
    const list = hist.map((id) => state.videos.find((v) => v.id === id)).filter(Boolean);
    renderFeed(list, "Watch History");
  }
}

// --- Player & User Actions ---
async function openPlayer(vid, countView = true) {
  currentVideo = vid;
  hideMainSections();
  document.getElementById("playerSection").classList.remove("hidden");

  if (countView) {
    await fetch(`${API}/videos/${vid.id}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentUserEmail })
    });
    const res = await fetch(`${API}/state?email=${encodeURIComponent(currentUserEmail)}&admin=${studioMode}`);
    state = await res.json();
    vid = state.videos.find((v) => v.id === vid.id) || vid;
    currentVideo = vid;
  }

  const player = document.getElementById("mainVideoPlayer");
  if (player.src !== location.origin + vid.videoUrl && player.src !== vid.videoUrl) {
    player.src = vid.videoUrl;
  }

  document.getElementById("playerTitle").innerText = vid.title;
  document.getElementById("playerChannel").innerText = vid.channel;
  document.getElementById("playerAvatar").innerText = (vid.channel || "C")[0].toUpperCase();
  document.getElementById("playerViews").innerText = `${(vid.views || 0).toLocaleString()} views`;
  document.getElementById("likeCount").innerText = vid.likes || 0;
  document.getElementById("dislikeCount").innerText = vid.dislikes || 0;
  document.getElementById("playerDescription").innerText = vid.description || "No description provided.";

  const u = state.user || {};
  const isLiked = (u.likedVideos || []).includes(vid.id);
  const isDisliked = (u.dislikedVideos || []).includes(vid.id);
  const isSaved = (u.watchLater || []).includes(vid.id);
  const isSub = (u.subscribedChannels || []).includes(vid.channel);

  document.getElementById("likeBtn").classList.toggle("active", isLiked);
  document.getElementById("dislikeBtn").classList.toggle("active", isDisliked);
  document.getElementById("watchLaterBtn").classList.toggle("active", isSaved);
  document.getElementById("watchLaterText").innerText = isSaved ? "Saved" : "Watch Later";

  const subBtn = document.getElementById("subBtn");
  subBtn.classList.toggle("subscribed", isSub);
  subBtn.innerText = isSub ? "Subscribed" : "Subscribe";

  renderComments(vid);
}

function renderComments(vid) {
  const comments = vid.comments || [];
  document.getElementById("commentCount").innerText = comments.length;
  const list = document.getElementById("commentList");
  list.innerHTML = "";
  const allowDelete = canManage(vid);

  comments.forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div><strong>${c.author}</strong> <span style="color:#888;font-size:12px">• ${c.createdAt}</span><br/>${c.text}</div>
      ${allowDelete ? `<button class="del-comment-btn" onclick="deleteComment('${vid.id}','${c.id}')">Delete</button>` : ""}
    `;
    list.appendChild(li);
  });
}

async function reactVideo(type) {
  if (!currentVideo) return;
  await fetch(`${API}/videos/${currentVideo.id}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, email: currentUserEmail })
  });
  await fetchState();
}

async function toggleWatchLater() {
  if (!currentVideo) return;
  await fetch(`${API}/watch-later`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId: currentVideo.id, email: currentUserEmail })
  });
  await fetchState();
}

async function subscribeChannelByName(channelName, ownerEmail = "") {
  await fetch(`${API}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channelName, ownerEmail, email: currentUserEmail })
  });
  await fetchState();
}

async function toggleSubscribe() {
  if (!currentVideo) return;
  await subscribeChannelByName(currentVideo.channel, currentVideo.ownerEmail || "");
}

function shareCurrentVideo() {
  if (!currentVideo) return;
  navigator.clipboard?.writeText(location.href);
  alert("InTube link copy ho gaya!");
}

async function addComment() {
  const input = document.getElementById("commentInput");
  const text = input.value.trim();
  if (!text || !currentVideo) return;

  const author = isLoggedIn ? "@" + currentUserEmail.split("@")[0] : "@guest";
  await fetch(`${API}/videos/${currentVideo.id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ author, text })
  });
  input.value = "";
  await fetchState();
}

async function deleteComment(videoId, commentId) {
  await fetch(
    `${API}/videos/${videoId}/comments/${commentId}?email=${encodeURIComponent(currentUserEmail)}&admin=${studioMode}`,
    { method: "DELETE" }
  );
  await fetchState();
}

// --- Creator / Admin Studio ---
function toggleStudioMode(e) {
  if (e) e.preventDefault();
  studioMode = !studioMode;
  document.getElementById("studioPanel").classList.toggle("hidden", !studioMode);
  fetchState();
}

function renderStudio() {
  const isSuperAdmin = currentUserEmail.toLowerCase() === ADMIN_EMAIL;
  const managedVideos = isSuperAdmin
    ? state.videos
    : state.videos.filter((v) => v.ownerEmail && v.ownerEmail.toLowerCase() === currentUserEmail.toLowerCase());

  document.getElementById("studioTitle").innerHTML = isSuperAdmin
    ? `<i class="fa-solid fa-shield-halved"></i> InTube Admin Studio (All Creators)`
    : `<i class="fa-solid fa-sliders"></i> Creator Studio (${state.myChannel?.name || currentUserEmail})`;

  document.getElementById("studioSubtitle").innerText = isSuperAdmin
    ? "Poore platform ki videos aur channels manage karein"
    : "Sirf aapki apni videos ka dashboard (upload, edit, visibility, delete)";

  const totalViews = managedVideos.reduce((s, v) => s + (v.views || 0), 0);
  const totalLikes = managedVideos.reduce((s, v) => s + (v.likes || 0), 0);

  document.getElementById("studioStats").innerHTML = `
    <div class="stat-card"><span>My Videos</span><h3>${managedVideos.length}</h3></div>
    <div class="stat-card"><span>Total Views</span><h3>${totalViews.toLocaleString()}</h3></div>
    <div class="stat-card"><span>Total Likes</span><h3>${totalLikes.toLocaleString()}</h3></div>
    <div class="stat-card"><span>Subscribers</span><h3>${(state.myChannel?.subscribers || 0).toLocaleString()}</h3></div>
  `;

  const tbody = document.getElementById("studioVideoRows");
  tbody.innerHTML = "";
  if (!managedVideos.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:#aaa">Abhi koi video nahi hai. "+ Upload Video" se pehli video dalein!</td></tr>`;
    return;
  }

  managedVideos.forEach((vid) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${vid.title}</strong><br/><span style="color:#888;font-size:12px">${vid.channel}</span></td>
      <td>${vid.category}</td>
      <td><span class="badge-vis">${vid.visibility || "public"}</span></td>
      <td>${(vid.views || 0).toLocaleString()}</td>
      <td>${vid.likes || 0}</td>
      <td>
        <button class="tbl-btn tbl-edit" onclick="openEditVideoModal('${vid.id}')">Edit</button>
        <button class="tbl-btn tbl-del" onclick="deleteVideoOwner('${vid.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openEditVideoModal(videoId) {
  const vid = state.videos.find((v) => v.id === videoId);
  if (!vid || !canManage(vid)) {
    alert("Aap sirf apni videos edit kar sakte hain.");
    return;
  }
  document.getElementById("uploadModalTitle").innerText = "Edit Video";
  document.getElementById("editingVideoId").value = vid.id;
  document.getElementById("vidTitle").value = vid.title;
  document.getElementById("vidChannel").value = vid.channel;
  document.getElementById("vidCategory").value = vid.category;
  document.getElementById("vidVisibility").value = vid.visibility || "public";
  document.getElementById("vidDesc").value = vid.description || "";
  document.getElementById("fileInputsGroup").classList.add("hidden");
  document.getElementById("vidThumbFile").required = false;
  document.getElementById("vidFile").required = false;
  document.getElementById("saveVideoBtn").innerText = "Update Video";
  document.getElementById("uploadModal").classList.remove("hidden");
}

async function deleteVideoOwner(videoId) {
  if (!confirm("Kya aap ye video permanently delete karna chahte hain?")) return;
  const res = await fetch(
    `${API}/videos/${videoId}?email=${encodeURIComponent(currentUserEmail)}&admin=${studioMode}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || "Delete nahi ho saka.");
    return;
  }
  if (currentVideo?.id === videoId) {
    currentVideo = null;
    goHome();
  }
  await fetchState();
}

// --- Upload / Update Form ---
function openUploadModal() {
  if (!isLoggedIn) {
    alert("Apni video upload karne ke liye pehle Sign In karein!");
    openAuthModal();
    return;
  }
  document.getElementById("uploadModalTitle").innerText = "Upload Video to Your Channel";
  document.getElementById("editingVideoId").value = "";
  document.getElementById("uploadForm").reset();
  document.getElementById("vidChannel").value = state.myChannel?.name || currentUserEmail.split("@")[0];
  document.getElementById("fileInputsGroup").classList.remove("hidden");
  document.getElementById("vidThumbFile").required = true;
  document.getElementById("vidFile").required = true;
  document.getElementById("saveVideoBtn").innerText = "Publish";
  document.getElementById("uploadStatus").innerText = "";
  document.getElementById("uploadModal").classList.remove("hidden");
}

document.getElementById("uploadForm").onsubmit = async (e) => {
  e.preventDefault();
  const editId = document.getElementById("editingVideoId").value;
  const statusEl = document.getElementById("uploadStatus");

  if (editId) {
    const res = await fetch(`${API}/videos/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requesterEmail: currentUserEmail,
        isAdmin: studioMode,
        title: document.getElementById("vidTitle").value,
        category: document.getElementById("vidCategory").value,
        visibility: document.getElementById("vidVisibility").value,
        description: document.getElementById("vidDesc").value
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Update error");
      return;
    }
    closeModal("uploadModal");
    await fetchState();
    return;
  }

  const fd = new FormData();
  fd.append("title", document.getElementById("vidTitle").value);
  fd.append("channel", document.getElementById("vidChannel").value);
  fd.append("ownerEmail", currentUserEmail);
  fd.append("category", document.getElementById("vidCategory").value);
  fd.append("visibility", document.getElementById("vidVisibility").value);
  fd.append("description", document.getElementById("vidDesc").value);
  fd.append("thumbnail", document.getElementById("vidThumbFile").files[0]);
  fd.append("video", document.getElementById("vidFile").files[0]);

  statusEl.innerText = "Uploading to your channel...";
  const res = await fetch(`${API}/videos`, { method: "POST", body: fd });
  if (!res.ok) {
    statusEl.innerText = "Upload error!";
    return;
  }
  closeModal("uploadModal");
  await fetchState();
};

// --- Channel Branding Form ---
function openChannelModal() {
  if (!isLoggedIn) {
    alert("Channel customize karne ke liye pehle Sign In karein!");
    openAuthModal();
    return;
  }
  const ch = findChannelByOwnerOrName(viewedChannelEmail);
  document.getElementById("editChName").value = ch.name || "";
  document.getElementById("editChHandle").value = ch.handle || "";
  document.getElementById("editChBio").value = ch.bio || "";
  document.getElementById("channelModal").classList.remove("hidden");
}

document.getElementById("channelForm").onsubmit = async (e) => {
  e.preventDefault();
  const targetOwner =
    currentUserEmail.toLowerCase() === ADMIN_EMAIL && viewedChannelEmail
      ? viewedChannelEmail
      : currentUserEmail;

  const fd = new FormData();
  fd.append("ownerEmail", targetOwner);
  fd.append("name", document.getElementById("editChName").value);
  fd.append("handle", document.getElementById("editChHandle").value);
  fd.append("bio", document.getElementById("editChBio").value);

  const logo = document.getElementById("editChLogo").files[0];
  const banner = document.getElementById("editChBanner").files[0];
  if (logo) fd.append("logo", logo);
  if (banner) fd.append("banner", banner);

  await fetch(`${API}/channel`, { method: "POST", body: fd });
  closeModal("channelModal");
  await fetchState();
};

// --- Auth ---
function openAuthModal() {
  document.getElementById("authModal").classList.remove("hidden");
}

document.getElementById("authForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim().toLowerCase();
  currentUserEmail = email;
  viewedChannelEmail = email;
  isLoggedIn = true;
  localStorage.setItem("intube_email", email);
  await fetch(`${API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  closeModal("authModal");
  await fetchState();
};

function logoutUser() {
  localStorage.removeItem("intube_email");
  currentUserEmail = "guest@intube.local";
  viewedChannelEmail = currentUserEmail;
  isLoggedIn = false;
  studioMode = false;
  document.getElementById("studioPanel").classList.add("hidden");
  fetchState();
}

document.getElementById("menuBtn").onclick = () => {
  document.getElementById("sidebar").classList.toggle("collapsed");
};

// Start
fetchState();