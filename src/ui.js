import { setAudioEnabled, playUIClick } from './audio.js';
import { MAP_SIZE, HALF_MAP, supplyCrates } from './terrain.js';

export class UIManager {
  constructor(callbacks) {
    this.cb = callbacks;

    // DOM Elements
    this.elLoading = document.getElementById('loading');
    this.elFatal = document.getElementById('fatal');
    this.elFatalMsg = document.getElementById('fatal-message');
    this.elLobby = document.getElementById('lobby');
    this.elHud = document.getElementById('hud');
    this.elPause = document.getElementById('pause');
    this.elResults = document.getElementById('results');

    // Panels
    this.panelPlay = document.getElementById('play-panel');
    this.panelGuide = document.getElementById('guide-panel');
    this.panelSettings = document.getElementById('settings-panel');
    this.navTabs = document.querySelectorAll('.nav-tab');

    // HUD Stats
    this.elAlive = document.getElementById('alive');
    this.elKills = document.getElementById('kills');
    this.elBearing = document.getElementById('bearing');
    this.elMinimap = document.getElementById('minimap');
    this.minimapCtx = this.elMinimap ? this.elMinimap.getContext('2d') : null;
    this.elZoneLabel = document.getElementById('zone-label');
    this.elKillfeed = document.getElementById('killfeed');
    this.elAnnouncement = document.getElementById('announcement');
    this.elZoneWarning = document.getElementById('zone-warning');
    this.elHitmarker = document.getElementById('hitmarker');
    this.elDamageFlash = document.getElementById('damage-flash');
    this.elHpNumber = document.getElementById('hp-number');
    this.elHealthBar = document.getElementById('health-bar');
    this.elArmorBar = document.getElementById('armor-bar');
    this.elMedkits = document.getElementById('medkits');
    this.elActionStatus = document.getElementById('action-status');
    this.elWeaponName = document.getElementById('weapon-name');
    this.elAmmo = document.getElementById('ammo');
    this.elReserve = document.getElementById('reserve');
    this.elWeaponMode = document.getElementById('weapon-mode');

    // Scopes
    this.elScopeOverlay = document.getElementById('scope-overlay');
    this.elScopeBadge = document.getElementById('scope-badge');
    this.elActiveScopeName = document.getElementById('active-scope-name');
    this.elTouchScope = document.getElementById('touch-scope');

    // Overlays
    this.elInventory = document.getElementById('inventory-overlay');
    this.elMap = document.getElementById('map-overlay');
    this.elBigMap = document.getElementById('big-map');
    this.bigMapCtx = this.elBigMap ? this.elBigMap.getContext('2d') : null;

    this.invPrimaryName = document.getElementById('inv-primary-name');
    this.invPrimaryAmmo = document.getElementById('inv-primary-ammo');
    this.invSecondaryName = document.getElementById('inv-secondary-name');
    this.invSecondaryAmmo = document.getElementById('inv-secondary-ammo');
    this.invHolsterName = document.getElementById('inv-holster-name');
    this.invHolsterAmmo = document.getElementById('inv-holster-ammo');
    this.invArmorStatus = document.getElementById('inv-armor-status');
    this.invArmorPoints = document.getElementById('inv-armor-points');
    this.invMedkits = document.getElementById('inv-medkits');
    this.slotPrimary = document.getElementById('slot-primary');
    this.slotSecondary = document.getElementById('slot-secondary');
    this.slotHolster = document.getElementById('slot-holster');

    // Results
    this.elResultKicker = document.getElementById('result-kicker');
    this.elResultTitle = document.getElementById('result-title');
    this.elResultCopy = document.getElementById('result-copy');
    this.elResultPlace = document.getElementById('result-place');
    this.elResultKills = document.getElementById('result-kills');
    this.elResultTime = document.getElementById('result-time');

    // Settings
    this.settings = {
      quality: 'balanced',
      difficulty: 'regular',
      sensitivity: 1.0,
      sound: true,
      touch: false
    };

    // Radar scanner animation
    this.radarAngle = 0;
    this.radarPings = [];

    this.bindEvents();
  }

  bindEvents() {
    this.navTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        playUIClick();
        this.switchLobbyTab(tab.dataset.panel);
      });
    });

    document.querySelectorAll('.back-play').forEach((btn) => {
      btn.addEventListener('click', () => {
        playUIClick();
        this.switchLobbyTab('play');
      });
    });

    const quickGuide = document.getElementById('quick-guide');
    if (quickGuide) {
      quickGuide.addEventListener('click', () => {
        playUIClick();
        this.switchLobbyTab('guide');
      });
    }

    const deployBtn = document.getElementById('deploy');
    if (deployBtn) {
      deployBtn.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onDeploy) this.cb.onDeploy();
      });
    }

    const fsBtn = document.getElementById('fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        playUIClick();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    const pauseBtn = document.getElementById('pause-button');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onPause) this.cb.onPause();
      });
    }

    const resumeBtn = document.getElementById('resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onResume) this.cb.onResume();
      });
    }

    const leaveBtn = document.getElementById('leave');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onLeave) this.cb.onLeave();
      });
    }

    const redeployBtn = document.getElementById('redeploy');
    if (redeployBtn) {
      redeployBtn.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onRedeploy) this.cb.onRedeploy();
      });
    }

    const closeInvBtn = document.getElementById('close-inventory');
    if (closeInvBtn) {
      closeInvBtn.addEventListener('click', () => {
        playUIClick();
        this.toggleInventory(false);
      });
    }

    const closeMapBtn = document.getElementById('close-map');
    if (closeMapBtn) {
      closeMapBtn.addEventListener('click', () => {
        playUIClick();
        this.toggleMap(false);
      });
    }

    if (this.slotPrimary) {
      this.slotPrimary.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onSelectSlot) this.cb.onSelectSlot('primary');
      });
    }
    if (this.slotSecondary) {
      this.slotSecondary.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onSelectSlot) this.cb.onSelectSlot('secondary');
      });
    }
    if (this.slotHolster) {
      this.slotHolster.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onSelectSlot) this.cb.onSelectSlot('holster');
      });
    }

    if (this.elScopeBadge) {
      this.elScopeBadge.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onCycleScope) this.cb.onCycleScope();
      });
    }

    if (this.elTouchScope) {
      this.elTouchScope.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onCycleScope) this.cb.onCycleScope();
      });
    }

    const resultLobbyBtn = document.getElementById('result-lobby');
    if (resultLobbyBtn) {
      resultLobbyBtn.addEventListener('click', () => {
        playUIClick();
        if (this.cb.onLeave) this.cb.onLeave();
      });
    }

    // Settings
    const selQuality = document.getElementById('quality');
    if (selQuality) {
      selQuality.addEventListener('change', (e) => {
        this.settings.quality = e.target.value;
        if (this.cb.onQualityChange) this.cb.onQualityChange(this.settings.quality);
      });
    }

    const selDiff = document.getElementById('difficulty');
    if (selDiff) {
      selDiff.addEventListener('change', (e) => {
        this.settings.difficulty = e.target.value;
        if (this.cb.onDifficultyChange) this.cb.onDifficultyChange(this.settings.difficulty);
      });
    }

    const rngSens = document.getElementById('sensitivity');
    if (rngSens) {
      rngSens.addEventListener('input', (e) => {
        this.settings.sensitivity = parseFloat(e.target.value);
      });
    }

    const chkSound = document.getElementById('sound');
    if (chkSound) {
      chkSound.addEventListener('change', (e) => {
        this.settings.sound = e.target.checked;
        setAudioEnabled(this.settings.sound);
      });
    }

    const chkTouch = document.getElementById('touch');
    if (chkTouch) {
      chkTouch.addEventListener('change', (e) => {
        this.settings.touch = e.target.checked;
        this.updateTouchUI();
      });
    }

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this.settings.touch = true;
      if (chkTouch) chkTouch.checked = true;
      this.updateTouchUI();
    }
  }

  updateTouchUI() {
    if (this.settings.touch) {
      document.body.classList.add('touch-enabled');
    } else {
      document.body.classList.remove('touch-enabled');
    }
  }

  switchLobbyTab(panelName) {
    this.navTabs.forEach(t => t.classList.toggle('active', t.dataset.panel === panelName));
    this.panelPlay.hidden = panelName !== 'play';
    this.panelGuide.hidden = panelName !== 'guide';
    this.panelSettings.hidden = panelName !== 'settings';
  }

  hideLoading() {
    if (this.elLoading) this.elLoading.hidden = true;
  }

  showFatal(message) {
    if (this.elFatal) {
      this.elFatal.hidden = false;
      if (this.elFatalMsg) this.elFatalMsg.textContent = message;
    }
  }

  showLobby() {
    document.body.classList.remove('playing');
    if (this.elLobby) this.elLobby.hidden = false;
    if (this.elHud) this.elHud.hidden = true;
    if (this.elPause) this.elPause.hidden = true;
    if (this.elResults) this.elResults.hidden = true;
    this.switchLobbyTab('play');
  }

  showHUD() {
    document.body.classList.add('playing');
    if (this.elLobby) this.elLobby.hidden = true;
    if (this.elHud) this.elHud.hidden = false;
    if (this.elPause) this.elPause.hidden = true;
    if (this.elResults) this.elResults.hidden = true;
    if (this.elInventory) this.elInventory.hidden = true;
    if (this.elMap) this.elMap.hidden = true;
  }

  toggleInventory(forceState) {
    if (this.elMap && !this.elMap.hidden) {
      this.elMap.hidden = true;
    }
    if (this.elInventory) {
      const nextState = forceState !== undefined ? forceState : this.elInventory.hidden;
      this.elInventory.hidden = !nextState;
      if (this.cb.onOverlayChange) this.cb.onOverlayChange(this.isOverlayOpen());
    }
  }

  toggleMap(forceState) {
    if (this.elInventory && !this.elInventory.hidden) {
      this.elInventory.hidden = true;
    }
    if (this.elMap) {
      const nextState = forceState !== undefined ? forceState : this.elMap.hidden;
      this.elMap.hidden = !nextState;
      if (this.cb.onOverlayChange) this.cb.onOverlayChange(this.isOverlayOpen());
    }
  }

  closeOverlays() {
    if (this.elInventory) this.elInventory.hidden = true;
    if (this.elMap) this.elMap.hidden = true;
    if (this.cb.onOverlayChange) this.cb.onOverlayChange(this.isOverlayOpen());
  }

  isOverlayOpen() {
    return (
      (this.elInventory && !this.elInventory.hidden) ||
      (this.elMap && !this.elMap.hidden) ||
      (this.elPause && !this.elPause.hidden) ||
      (this.elResults && !this.elResults.hidden)
    );
  }

  showPause(isPaused) {
    if (this.elPause) this.elPause.hidden = !isPaused;
    if (isPaused) {
      if (this.elInventory) this.elInventory.hidden = true;
      if (this.elMap) this.elMap.hidden = true;
    }
    if (this.cb.onOverlayChange) this.cb.onOverlayChange(this.isOverlayOpen());
  }

  showResults(results) {
    if (this.elResults) {
      this.elResults.hidden = false;
      const isWin = results.placement === 1;

      this.elResultKicker.textContent = isWin ? 'CHAMPION OF THE FRONTIER' : 'OPERATIVE ELIMINATED';
      this.elResultTitle.textContent = isWin ? 'VICTORY ROYALE.' : 'MISSION TERMINATED.';
      this.elResultCopy.textContent = isWin
        ? `Supreme Operative. You outmaneuvered 15 combatants and conquered Operation Dust Horizon!`
        : `Defeated in the Badlands. Regroup, inspect the manual, and redeploy!`;

      this.elResultPlace.textContent = `#${results.placement}`;
      this.elResultKills.textContent = `${results.kills}`;

      const mins = Math.floor(results.survivalTime / 60);
      const secs = Math.floor(results.survivalTime % 60);
      this.elResultTime.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    }
  }

  updatePlayerHUD(player, storm, aliveCount) {
    this.elAlive.textContent = `${aliveCount}`;
    this.elKills.textContent = `${player.kills}`;

    const hp = Math.max(0, Math.ceil(player.health));
    const armor = Math.max(0, Math.ceil(player.armor || 0));

    this.elHpNumber.textContent = `${hp} HP · ${armor} AP`;
    this.elHealthBar.style.width = `${hp}%`;
    this.elHealthBar.style.background = hp < 30 ? '#ff2b2b' : (hp < 60 ? '#f0b848' : '#00e5ff');
    this.elHealthBar.style.boxShadow = hp < 30 ? '0 0 12px #ff2b2b' : '0 0 10px #00e5ff55';

    if (this.elArmorBar) {
      this.elArmorBar.style.width = `${armor}%`;
    }

    this.elMedkits.textContent = `✚ ${player.medkits} MEDKITS`;

    if (player.isGliding) {
      this.elActionStatus.innerHTML = `<span style="color:#00e5ff;font-weight:700">🪂 AIRBORNE (IMMUNE)</span>`;
    } else if (player.isShielded) {
      const shieldSec = Math.max(0, Math.ceil(player.shieldTimer));
      this.elActionStatus.innerHTML = `<span style="color:#00e5ff;font-weight:700">🛡️ LANDING SHIELD (${shieldSec}s)</span>`;
    } else {
      this.elActionStatus.textContent = player.actionStatus;
    }

    this.elWeaponName.textContent = player.currentWeapon.name;
    this.elAmmo.textContent = `${player.currentAmmo}`;
    this.elReserve.textContent = `${player.currentReserve}`;

    this.elZoneLabel.textContent = storm.getTimerText();
    const isOut = storm.isOutsideSafeZone(player.position.x, player.position.z);
    this.elZoneWarning.hidden = !isOut;
  }

  updateActiveScope(scope) {
    if (this.elActiveScopeName && scope) {
      this.elActiveScopeName.textContent = scope.hudName;
    }
  }

  updateScopeOverlay(isAiming, currentScope) {
    if (!this.elScopeOverlay) return;
    const isMagnified = isAiming && currentScope && (currentScope.id === 'sniper' || currentScope.id === 'acog');
    if (isMagnified) {
      this.elScopeOverlay.hidden = false;
      document.body.classList.add('scope-active');
    } else {
      this.elScopeOverlay.hidden = true;
      document.body.classList.remove('scope-active');
    }
  }

  updateCompass(yawRadians) {
    let degrees = Math.round((-yawRadians * (180 / Math.PI)) % 360);
    if (degrees < 0) degrees += 360;

    const cardinalPoints = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(degrees / 45) % 8;
    this.elBearing.innerHTML = `<span style="color:#00e5ff;font-weight:800">${cardinalPoints[idx]}</span> &nbsp; ${degrees}°`;
  }

  triggerHitmarker() {
    this.elHitmarker.style.opacity = '1';
    this.elHitmarker.style.transform = 'translate(-50%, -50%) scale(1.4)';
    clearTimeout(this._hitmarkerTimeout);
    this._hitmarkerTimeout = setTimeout(() => {
      this.elHitmarker.style.opacity = '0';
      this.elHitmarker.style.transform = 'translate(-50%, -50%) scale(1.0)';
    }, 110);
  }

  triggerDamageFlash() {
    this.elDamageFlash.style.opacity = '1';
    clearTimeout(this._flashTimeout);
    this._flashTimeout = setTimeout(() => {
      this.elDamageFlash.style.opacity = '0';
    }, 240);
  }

  showAnnouncement(text, duration = 3000) {
    if (!this.elAnnouncement) return;
    this.elAnnouncement.textContent = text;
    this.elAnnouncement.style.opacity = '1';
    clearTimeout(this._announceTimeout);
    this._announceTimeout = setTimeout(() => {
      this.elAnnouncement.style.opacity = '0';
    }, duration);
  }

  addKillfeed(killer, victim) {
    if (!this.elKillfeed) return;
    const entry = document.createElement('div');
    const isPlayerKiller = killer === 'PATHFINDER';
    const isPlayerVictim = victim === 'PATHFINDER';

    entry.innerHTML = `<span style="color:${isPlayerKiller ? '#00e5ff' : '#ffffff'};font-weight:700">${killer}</span> <span style="color:#edc57b;margin:0 4px">☠</span> <span style="color:${isPlayerVictim ? '#ff3322' : '#aab7b3'}">${victim}</span>`;

    this.elKillfeed.prepend(entry);
    setTimeout(() => {
      if (entry.parentNode) entry.parentNode.removeChild(entry);
    }, 5500);

    while (this.elKillfeed.children.length > 5) {
      this.elKillfeed.removeChild(this.elKillfeed.lastChild);
    }
  }

  addRadarPing(x, z) {
    this.radarPings.push({ x, z, life: 1.6 });
  }

  renderMinimap(playerPos, playerYaw, storm, delta) {
    if (!this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const size = 200;
    const scale = size / MAP_SIZE; // 200 / 360

    ctx.clearRect(0, 0, size, size);

    // Dark high-tech radar background
    ctx.fillStyle = '#101e1d';
    ctx.fillRect(0, 0, size, size);

    // Subtle radar concentric grid rings
    ctx.strokeStyle = '#223835';
    ctx.lineWidth = 1;
    [40, 75, 110].forEach(r => {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Helper: World (x, z) to Canvas
    const toCanvas = (wx, wz) => ({
      x: (wx + HALF_MAP) * scale,
      y: (wz + HALF_MAP) * scale
    });

    // Animated Radar Sweep Line
    this.radarAngle += delta * 2.5;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(this.radarAngle);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.35)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, size / 2, 0, Math.PI * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // POI Markers
    const pois = [
      { name: 'BASE', x: -55, z: -45 },
      { name: 'RUINS', x: 65, z: -60 },
      { name: 'OASIS', x: -70, z: 65 },
      { name: 'RADIO', x: 60, z: 55 }
    ];
    ctx.fillStyle = '#ffffff35';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    pois.forEach((p) => {
      const c = toCanvas(p.x, p.z);
      ctx.fillText(p.name, c.x, c.y);
    });

    // Supply Crates
    supplyCrates.forEach((crate) => {
      if (crate.collected) return;
      const cp = toCanvas(crate.position.x, crate.position.z);
      ctx.fillStyle = crate.type === 'gold' ? '#ffdf55' : '#00e5ff';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Safe Zone (Next Circle) - Dotted Gold
    const nextC = toCanvas(storm.nextCenter.x, storm.nextCenter.y);
    const nextR = storm.nextRadius * scale;
    ctx.beginPath();
    ctx.strokeStyle = '#ffea66';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.arc(nextC.x, nextC.y, Math.max(1, nextR), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Storm Boundary - Glowing Cyan/Blue
    const curC = toCanvas(storm.currentCenter.x, storm.currentCenter.y);
    const curR = storm.currentRadius * scale;
    ctx.beginPath();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.2;
    ctx.arc(curC.x, curC.y, Math.max(1, curR), 0, Math.PI * 2);
    ctx.stroke();

    // Gunfire Sonar Pings
    for (let i = this.radarPings.length - 1; i >= 0; i--) {
      const ping = this.radarPings[i];
      ping.life -= delta;
      if (ping.life <= 0) {
        this.radarPings.splice(i, 1);
        continue;
      }
      const pp = toCanvas(ping.x, ping.z);
      const alpha = ping.life / 1.6;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 50, 40, ${alpha * 0.9})`;
      ctx.arc(pp.x, pp.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Direction Pointer
    const pp = toCanvas(playerPos.x, playerPos.z);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(-playerYaw);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.5, 6);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-4.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  updateInventoryUI(weaponSystem, player) {
    if (!this.elInventory || this.elInventory.hidden) return;

    if (weaponSystem && weaponSystem.inventory) {
      const p = weaponSystem.inventory.primary;
      const s = weaponSystem.inventory.secondary;
      const h = weaponSystem.inventory.holster;

      if (this.invPrimaryName) this.invPrimaryName.textContent = p.name;
      if (this.invPrimaryAmmo) this.invPrimaryAmmo.textContent = `${p.currentMag} / ${p.currentReserve}`;

      if (this.invSecondaryName) this.invSecondaryName.textContent = s.name;
      if (this.invSecondaryAmmo) this.invSecondaryAmmo.textContent = `${s.currentMag} / ${s.currentReserve}`;

      if (this.invHolsterName) this.invHolsterName.textContent = h.name;
      if (this.invHolsterAmmo) this.invHolsterAmmo.textContent = `${h.currentMag} / ${h.currentReserve}`;

      this.slotPrimary?.classList.toggle('active-slot', weaponSystem.activeSlot === 'primary');
      this.slotSecondary?.classList.toggle('active-slot', weaponSystem.activeSlot === 'secondary');
      this.slotHolster?.classList.toggle('active-slot', weaponSystem.activeSlot === 'holster');
    }

    if (player) {
      if (this.invArmorPoints) this.invArmorPoints.textContent = `${Math.ceil(player.armor)} AP`;
      if (this.invMedkits) this.invMedkits.textContent = `${player.medkits} MEDKITS`;
    }
  }

  renderBigMap(playerPos, playerYaw, storm) {
    if (!this.bigMapCtx || !this.elMap || this.elMap.hidden) return;
    const ctx = this.bigMapCtx;
    const size = 420;
    const scale = size / MAP_SIZE;

    ctx.clearRect(0, 0, size, size);

    // Dark Map Grid Canvas
    ctx.fillStyle = '#142526';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.lineWidth = 1;
    const step = size / 6;
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, x);
      ctx.lineTo(size, x);
      ctx.stroke();
    }

    const toCanvas = (wx, wz) => ({
      x: (wx + HALF_MAP) * scale,
      y: (wz + HALF_MAP) * scale
    });

    // POIs
    const pois = [
      { name: 'FORWARD BASE DELTA', x: -55, z: -45 },
      { name: 'SUNKEN RUINS', x: 65, z: -60 },
      { name: 'OASIS REFINERY', x: -70, z: 65 },
      { name: 'RADIO OUTPOST', x: 60, z: 55 },
      { name: 'CENTRAL DROP', x: 0, z: 0 }
    ];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    pois.forEach((p) => {
      const c = toCanvas(p.x, p.z);
      ctx.fillText(p.name, c.x, c.y);
    });

    // Supply Crates
    supplyCrates.forEach((crate) => {
      if (crate.collected) return;
      const cp = toCanvas(crate.position.x, crate.position.z);
      ctx.fillStyle = crate.type === 'gold' ? '#ffe688' : '#77e0ff';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Next Safe Zone Circle
    const nextC = toCanvas(storm.nextCenter.x, storm.nextCenter.y);
    const nextR = storm.nextRadius * scale;
    ctx.beginPath();
    ctx.strokeStyle = '#edc57b';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([8, 6]);
    ctx.arc(nextC.x, nextC.y, Math.max(1, nextR), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Storm Boundary
    const curC = toCanvas(storm.currentCenter.x, storm.currentCenter.y);
    const curR = storm.currentRadius * scale;
    ctx.beginPath();
    ctx.strokeStyle = '#00a2ff';
    ctx.lineWidth = 3.0;
    ctx.arc(curC.x, curC.y, Math.max(1, curR), 0, Math.PI * 2);
    ctx.stroke();

    // Player Marker with Yaw Arrow
    const pp = toCanvas(playerPos.x, playerPos.z);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(-playerYaw);

    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

