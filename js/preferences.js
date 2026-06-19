/* ===================================================================
   PRÉFÉRENCES D'AFFICHAGE — romanisation et décomposition jamo,
   activables/désactivables, sauvegardées dans localStorage.
=================================================================== */

const PREFS_KEY = "vocab-prefs-v1";

function loadPrefs() {
  const defaults = { showRomanization: false, showJamoOnHover: true, compactMode: false, flipCards: false, soundEnabled: true, voiceVolume: 1 };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (e) {
    return defaults;
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    // ignore
  }
}

let userPrefs = loadPrefs();

function initOptionsPanel() {
  const toggleBtn = document.getElementById("options-toggle");
  const panel = document.getElementById("options-panel");
  const romaCheckbox = document.getElementById("opt-romanization");
  const jamoCheckbox = document.getElementById("opt-jamo");

  romaCheckbox.checked = userPrefs.showRomanization;
  jamoCheckbox.checked = userPrefs.showJamoOnHover;

  const compactCheckbox = document.getElementById("opt-compact");
  compactCheckbox.checked = userPrefs.compactMode;
  compactCheckbox.addEventListener("change", () => {
    userPrefs.compactMode = compactCheckbox.checked;
    savePrefs(userPrefs);
    document.getElementById("kr-grid").classList.toggle("compact", userPrefs.compactMode);
  });
  
  const flipCheckbox = document.getElementById("opt-flip");
  flipCheckbox.checked = userPrefs.flipCards;
  flipCheckbox.addEventListener("change", () => {
    userPrefs.flipCards = flipCheckbox.checked;
    savePrefs(userPrefs);
    refreshKorean();
  });

  const soundCheckbox = document.getElementById("opt-sound");
  soundCheckbox.checked = userPrefs.soundEnabled;
  soundCheckbox.addEventListener("change", () => {
    userPrefs.soundEnabled = soundCheckbox.checked;
    savePrefs(userPrefs);
    refreshKorean();
  });
  
  const volumeSlider = document.getElementById("opt-volume");
  const volumeValue = document.getElementById("opt-volume-value");
  volumeSlider.value = Math.round(userPrefs.voiceVolume * 100);
  volumeValue.textContent = `${volumeSlider.value}%`;

  volumeSlider.addEventListener("input", () => {
    userPrefs.voiceVolume = parseInt(volumeSlider.value, 10) / 100;
    volumeValue.textContent = `${volumeSlider.value}%`;
    savePrefs(userPrefs);
  });
  
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("show");
  });

  // empêche un clic à l'intérieur du panneau de le refermer immédiatement
  panel.addEventListener("click", (e) => e.stopPropagation());

  // ferme le panneau si on clique n'importe où ailleurs sur la page
  document.addEventListener("click", () => {
    panel.classList.remove("show");
  });

  romaCheckbox.addEventListener("change", () => {
    userPrefs.showRomanization = romaCheckbox.checked;
    savePrefs(userPrefs);
    refreshKorean(); // redessine les cartes avec la nouvelle préférence
  });

  jamoCheckbox.addEventListener("change", () => {
    userPrefs.showJamoOnHover = jamoCheckbox.checked;
    savePrefs(userPrefs);
    refreshKorean();
  });
  document.getElementById("kr-grid").classList.toggle("compact", userPrefs.compactMode);
}

document.addEventListener("DOMContentLoaded", initOptionsPanel);