// State
let authToken = localStorage.getItem('andi_dash_token') || '';
let currentGuildId = localStorage.getItem('andi_current_guild') || '';
let bannedWordsList = [];

// DOM Elements
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const adminPassInput = document.getElementById('admin-pass-input');
const btnLock = document.getElementById('btn-lock');

const serverSelector = document.getElementById('server-selector');
const noServerWarning = document.getElementById('no-server-warning');

// Tab Navigation
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');

function switchTab(tabId) {
  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabId);
  });
  tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
  if (tabId === 'tab-leaderboard' && currentGuildId) {
    loadLeaderboard();
  }
  if (tabId === 'tab-audit' && currentGuildId) {
    loadAuditLogs();
  }
}

navItems.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-green' : 'fa-circle-exclamation text-red'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// API Fetch Helper with Auth
async function apiFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  if (authToken) {
    headers['x-dashboard-auth'] = authToken;
  }
  options.headers = headers;

  const res = await fetch(endpoint, options);
  if (res.status === 401) {
    showLoginModal();
    throw new Error('Unauthorized');
  }
  return res.json();
}

// Auth Handlers
function checkAuth() {
  if (!authToken) {
    showLoginModal();
  } else {
    loginModal.classList.add('hidden');
    loadInitialData();
  }
}

function showLoginModal() {
  loginModal.classList.remove('hidden');
  adminPassInput.focus();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  const password = adminPassInput.value.trim();
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.success) {
      authToken = data.token;
      localStorage.setItem('andi_dash_token', authToken);
      loginModal.classList.add('hidden');
      showToast('Dashboard Unlocked!', 'success');
      loadInitialData();
    } else {
      loginError.classList.remove('hidden');
    }
  } catch (err) {
    loginError.classList.remove('hidden');
  }
});

btnLock.addEventListener('click', () => {
  authToken = '';
  localStorage.removeItem('andi_dash_token');
  showLoginModal();
});

// 1. Load Bot Status & Servers
async function loadStatus() {
  try {
    const data = await apiFetch('/api/status');

    if (data.botUser) {
      document.getElementById('bot-avatar-sidebar').src = data.botUser.avatar;
      document.getElementById('bot-name-sidebar').innerText = data.botUser.username;
      document.getElementById('overview-bot-tag').innerText = data.botUser.tag;
    }

    document.getElementById('stat-ping').innerText = `${data.ping >= 0 ? data.ping : 0} ms`;

    // Format uptime
    const h = Math.floor(data.uptime / 3600);
    const m = Math.floor((data.uptime % 3600) / 60);
    document.getElementById('stat-uptime').innerText = `${h}h ${m}m`;

    document.getElementById('overview-servers-count').innerText = data.guildsCount;
    document.getElementById('overview-members-count').innerText = data.totalUsers;

    // Populate server dropdown
    serverSelector.innerHTML = '';
    if (data.guilds.length === 0) {
      serverSelector.innerHTML = '<option value="">No servers found</option>';
      noServerWarning.classList.remove('hidden');
    } else {
      noServerWarning.classList.add('hidden');
      data.guilds.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.innerText = `${g.name} (${g.memberCount} members)`;
        if (g.id === currentGuildId) opt.selected = true;
        serverSelector.appendChild(opt);
      });

      if (!currentGuildId && data.guilds[0]) {
        currentGuildId = data.guilds[0].id;
        localStorage.setItem('andi_current_guild', currentGuildId);
      }

      if (currentGuildId) {
        loadGuildDetails(currentGuildId);
      }
    }
  } catch (err) {
    console.error('Error loading status:', err);
  }
}

serverSelector.addEventListener('change', (e) => {
  currentGuildId = e.target.value;
  localStorage.setItem('andi_current_guild', currentGuildId);
  if (currentGuildId) {
    loadGuildDetails(currentGuildId);
  }
});

// 2. Load Guild Details (Channels, Roles, Settings)
async function loadGuildDetails(guildId) {
  if (!guildId) return;

  try {
    const data = await apiFetch(`/api/guild/${guildId}`);
    const settings = data.settings || {};

    // Helper to populate select
    const populateSelect = (selectId, items, selectedValue, defaultLabel) => {
      const el = document.getElementById(selectId);
      el.innerHTML = `<option value="">${defaultLabel}</option>`;
      items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.innerText = item.name;
        if (item.id === selectedValue) opt.selected = true;
        el.appendChild(opt);
      });
    };

    populateSelect('setting-streamChannel', data.channels, settings.streamChannel, 'None (Select a Channel)');
    populateSelect('setting-welcomeChannel', data.channels, settings.welcomeChannel, 'None (Select a Channel)');
    populateSelect('setting-modLogChannel', data.channels, settings.modLogChannel, 'None (Select a Channel)');
    populateSelect('setting-goodbyeChannel', data.channels, settings.goodbyeChannel, 'None (Select a Channel)');

    populateSelect('setting-autoRoleId', data.roles, settings.autoRoleId, 'None (Select a Role)');
    populateSelect('setting-streamPingRole', data.roles, settings.streamPingRole, 'None (Select a Role)');

    populateSelect('setting-tempVoiceHubChannel', data.voiceChannels || [], settings.tempVoiceHubChannel, 'None (Select a Voice Channel)');
    populateSelect('ann-channel', data.channels, '', 'Select Target Channel');

    // Tickets & Verify dropdowns
    populateSelect('ticket-verify-chan', data.channels, settings.verificationChannel, 'Select Channel');
    populateSelect('ticket-verify-role', data.roles, settings.verificationRole, 'Select Role');
    populateSelect('ticket-panel-chan', data.channels, settings.ticketChannel, 'Select Channel');
  } catch (err) {
    console.error('Error loading guild:', err);
  }
}

// 3. Save Guild Channel & Role Settings
document.getElementById('setup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentGuildId) {
    return showToast('Please select a server first!', 'error');
  }

  const payload = {
    streamChannel: document.getElementById('setting-streamChannel').value || null,
    welcomeChannel: document.getElementById('setting-welcomeChannel').value || null,
    modLogChannel: document.getElementById('setting-modLogChannel').value || null,
    goodbyeChannel: document.getElementById('setting-goodbyeChannel').value || null,
    autoRoleId: document.getElementById('setting-autoRoleId').value || null,
    streamPingRole: document.getElementById('setting-streamPingRole').value || null,
    tempVoiceHubChannel: document.getElementById('setting-tempVoiceHubChannel').value || null
  };

  try {
    const res = await apiFetch(`/api/guild/${currentGuildId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('Channels & Roles successfully saved to Discord!', 'success');
    }
  } catch (err) {
    showToast('Failed to save settings: ' + err.message, 'error');
  }
});

// 4. Load & Save AutoMod & Config
async function loadConfig() {
  try {
    const config = await apiFetch('/api/config');

    // AutoMod
    document.getElementById('automod-enabled').checked = config.automod?.enabled !== false;
    document.getElementById('automod-blockInvites').checked = config.automod?.blockDiscordInvites !== false;
    document.getElementById('automod-maxMessages').value = config.automod?.maxMessagesPerInterval || 5;
    document.getElementById('automod-interval').value = config.automod?.intervalSeconds || 4;
    document.getElementById('automod-duplicates').value = config.automod?.duplicateMessageThreshold || 3;
    document.getElementById('automod-maxMentions').value = config.automod?.maxMentions || 4;
    document.getElementById('automod-timeoutMins').value = config.automod?.autoTimeoutMinutes || 5;

    bannedWordsList = config.automod?.bannedWords || [];
    renderBannedWords();

    // Socials
    document.getElementById('social-name').value = config.streamer?.name || '';
    document.getElementById('social-youtube').value = config.streamer?.youtube || '';
    document.getElementById('social-twitch').value = config.streamer?.twitch || '';
    document.getElementById('social-kick').value = config.streamer?.kick || '';
    document.getElementById('social-tiktok').value = config.streamer?.tiktok || '';
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

function renderBannedWords() {
  const container = document.getElementById('banned-words-tags');
  container.innerHTML = '';
  bannedWordsList.forEach((word, idx) => {
    const tag = document.createElement('span');
    tag.className = 'tag-badge';
    tag.innerHTML = `<span>${word}</span> <i class="fa-solid fa-xmark" data-idx="${idx}"></i>`;
    container.appendChild(tag);
  });

  container.querySelectorAll('i').forEach(icon => {
    icon.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      bannedWordsList.splice(idx, 1);
      renderBannedWords();
    });
  });
}

document.getElementById('btn-add-word').addEventListener('click', () => {
  const input = document.getElementById('new-banned-word');
  const val = input.value.trim().toLowerCase();
  if (val && !bannedWordsList.includes(val)) {
    bannedWordsList.push(val);
    renderBannedWords();
    input.value = '';
  }
});

document.getElementById('new-banned-word').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btn-add-word').click();
  }
});

document.getElementById('automod-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    automod: {
      enabled: document.getElementById('automod-enabled').checked,
      blockDiscordInvites: document.getElementById('automod-blockInvites').checked,
      maxMessagesPerInterval: parseInt(document.getElementById('automod-maxMessages').value),
      intervalSeconds: parseInt(document.getElementById('automod-interval').value),
      duplicateMessageThreshold: parseInt(document.getElementById('automod-duplicates').value),
      maxMentions: parseInt(document.getElementById('automod-maxMentions').value),
      autoTimeoutMinutes: parseInt(document.getElementById('automod-timeoutMins').value),
      bannedWords: bannedWordsList
    }
  };

  try {
    const res = await apiFetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.success) {
      showToast('AutoMod rules and protection levels updated!', 'success');
    }
  } catch (err) {
    showToast('Failed to save AutoMod rules: ' + err.message, 'error');
  }
});

// 5. Socials Form
document.getElementById('socials-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    streamer: {
      name: document.getElementById('social-name').value.trim(),
      youtube: document.getElementById('social-youtube').value.trim(),
      twitch: document.getElementById('social-twitch').value.trim(),
      kick: document.getElementById('social-kick').value.trim(),
      tiktok: document.getElementById('social-tiktok').value.trim()
    }
  };

  try {
    const res = await apiFetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.success) {
      showToast('Streamer profiles and social links saved!', 'success');
    }
  } catch (err) {
    showToast('Failed to save socials: ' + err.message, 'error');
  }
});

// 6. Live Stream Broadcaster & Live Discord Preview
const streamTitle = document.getElementById('stream-title');
const streamGame = document.getElementById('stream-game');
const streamPlatform = document.getElementById('stream-platform');
const streamImage = document.getElementById('stream-image');

const previewTitle = document.getElementById('preview-title');
const previewGame = document.getElementById('preview-game');
const previewPlatform = document.getElementById('preview-platform');
const previewBtnPlat = document.getElementById('preview-btn-plat');
const previewImageBox = document.getElementById('preview-image-box');
const previewImg = document.getElementById('preview-img');

function updateLivePreview() {
  previewTitle.innerText = streamTitle.value.trim() || '💥 Road to Radiant! Rank Grind with Viewers';
  previewGame.innerText = streamGame.value.trim() || 'Valorant';
  previewPlatform.innerText = streamPlatform.value;
  previewBtnPlat.innerText = streamPlatform.value;

  const imgVal = streamImage.value.trim();
  if (imgVal) {
    previewImg.src = imgVal;
    previewImageBox.classList.remove('hidden');
  } else {
    previewImageBox.classList.add('hidden');
  }
}

[streamTitle, streamGame, streamPlatform, streamImage].forEach(input => {
  input.addEventListener('input', updateLivePreview);
  input.addEventListener('change', updateLivePreview);
});

document.getElementById('stream-broadcast-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentGuildId) {
    return showToast('Select a Discord server first!', 'error');
  }

  const btn = document.getElementById('btn-send-stream');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> BROADCASTING...';

  const payload = {
    title: streamTitle.value.trim(),
    game: streamGame.value.trim(),
    platform: streamPlatform.value,
    url: document.getElementById('stream-url').value.trim(),
    imageUrl: streamImage.value.trim() || null,
    pingType: document.getElementById('stream-ping-type').value
  };

  try {
    const res = await apiFetch(`/api/guild/${currentGuildId}/stream-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('🔴 Live Stream Alert successfully posted to Discord!', 'success');
    } else {
      showToast(res.error || 'Failed to post alert', 'error');
    }
  } catch (err) {
    showToast('Failed to broadcast: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> BROADCAST TO DISCORD NOW';
  }
});

// 7. Custom Announcement Sender
document.getElementById('announcement-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentGuildId) return showToast('Please select a server first!', 'error');

  const btn = document.getElementById('btn-send-ann');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> DISPATCHING...';

  const payload = {
    channelId: document.getElementById('ann-channel').value,
    pingType: document.getElementById('ann-ping').value,
    title: document.getElementById('ann-title').value.trim(),
    message: document.getElementById('ann-message').value.trim(),
    imageUrl: document.getElementById('ann-image').value.trim() || null,
    color: document.getElementById('ann-color').value
  };

  try {
    const res = await apiFetch(`/api/guild/${currentGuildId}/announcement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast(res.message, 'success');
      document.getElementById('ann-title').value = '';
      document.getElementById('ann-message').value = '';
      document.getElementById('ann-image').value = '';
    } else {
      showToast(res.error || 'Failed to dispatch', 'error');
    }
  } catch (err) {
    showToast('Failed to dispatch announcement: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> DISPATCH ANNOUNCEMENT';
  }
});

// 8. Leaderboard Loader
async function loadLeaderboard() {
  if (!currentGuildId) return;

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading top gamers...</td></tr>';

  try {
    const data = await apiFetch(`/api/guild/${currentGuildId}/leaderboard`);

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No XP or coin records yet! Chat in Discord to climb the leaderboard.</td></tr>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    tbody.innerHTML = data.map((user, idx) => {
      const medal = medals[idx] || `#${idx + 1}`;
      const avatarSrc = user.avatar || 'https://cdn-icons-png.flaticon.com/512/847/847969.png';
      const coins = user.coins || 0;
      return `
        <tr>
          <td><strong>${medal}</strong></td>
          <td>
            <div class="gamer-cell">
              <img src="${avatarSrc}" class="gamer-avatar" alt="Avatar">
              <span>${user.username}</span>
            </div>
          </td>
          <td>
            <span class="badge badge-gaming">Level ${user.level}</span>
          </td>
          <td><strong>${user.totalXp.toLocaleString()} XP</strong></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red">Failed to load leaderboard</td></tr>';
  }
}

document.getElementById('btn-refresh-stats').addEventListener('click', loadStatus);
document.getElementById('btn-refresh-leaderboard').addEventListener('click', loadLeaderboard);

function loadInitialData() {
  loadStatus();
  loadConfig();
}

// 9. 1-Click Server Auto-Builder
const btnAutoBuilder = document.getElementById('btn-run-autobuilder');
const builderStatus = document.getElementById('builder-status');

if (btnAutoBuilder) {
  btnAutoBuilder.addEventListener('click', async () => {
    if (!currentGuildId) return showToast('Please select a server first!', 'error');

    if (!confirm('Are you sure you want to run the 1-Click Server Auto-Builder? This will generate professional gaming categories, channels, and roles for this server.')) {
      return;
    }

    btnAutoBuilder.disabled = true;
    btnAutoBuilder.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ARCHITECTING SERVER (CREATING ROLES & CHANNELS)...';
    builderStatus.className = 'alert-box warning';
    builderStatus.classList.remove('hidden');
    builderStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Building server layout... please wait ~5-10 seconds.';

    try {
      const res = await apiFetch(`/api/guild/${currentGuildId}/auto-setup`, {
        method: 'POST'
      });

      if (res.success) {
        showToast('Server successfully architected and secured!', 'success');
        builderStatus.className = 'alert-box success';
        builderStatus.style.background = 'rgba(0, 255, 163, 0.15)';
        builderStatus.style.border = '1px solid var(--success)';
        builderStatus.innerHTML = `
          <strong>✔ Complete Server Architecture Deployed!</strong><br>
          • <strong>Roles Created:</strong> ${res.summary.rolesCreated.length}<br>
          • <strong>Categories:</strong> ${res.summary.categoriesCreated.length}<br>
          • <strong>Channels:</strong> ${res.summary.channelsCreated.length}<br>
          All default settings (welcome, stream, mod logs, squad voice) have been auto-configured!
        `;
        loadGuildDetails(currentGuildId);
      } else {
        showToast(res.error || 'Setup failed', 'error');
        builderStatus.classList.add('hidden');
      }
    } catch (err) {
      showToast('Error during setup: ' + err.message, 'error');
      builderStatus.classList.add('hidden');
    } finally {
      btnAutoBuilder.disabled = false;
      btnAutoBuilder.innerHTML = '<i class="fa-solid fa-bolt"></i> RUN 1-CLICK SERVER AUTO-SETUP NOW';
    }
  });
}

// 10. Live Audit Logs Loader
async function loadAuditLogs() {
  if (!currentGuildId) return;

  const tbody = document.getElementById('audit-table-body');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading audit logs...</td></tr>';

  try {
    const logs = await apiFetch(`/api/guild/${currentGuildId}/audit-logs`);

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No audit events recorded yet. Try deleting or editing a message in Discord!</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      let badgeClass = 'badge-gaming';
      if (log.action.includes('Delete') || log.action.includes('Ban')) badgeClass = 'badge-accent';
      else if (log.action.includes('Joined')) badgeClass = 'text-green';

      return `
        <tr>
          <td><span style="color:var(--text-muted); font-size:12px;">${time}</span></td>
          <td><span class="badge ${badgeClass}">${log.action}</span></td>
          <td><strong>${log.target || 'Unknown'}</strong></td>
          <td><code>#${log.channel || 'server'}</code></td>
          <td style="font-size:13px; color:#dbdee1;">${log.details || '—'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red">Failed to load audit logs</td></tr>';
  }
}

document.getElementById('btn-refresh-audit')?.addEventListener('click', loadAuditLogs);

// Kickoff
checkAuth();
setInterval(loadStatus, 20000); // Poll status every 20s

