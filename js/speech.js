/* ===================================================================
   PRONONCIATION — synthèse vocale via l'API Web Speech native du
   navigateur. Aucune clé API, aucun service externe.
   Détecte l'absence de voix coréenne et prévient l'utilisateur une
   seule fois au lieu d'échouer silencieusement à chaque clic.
=================================================================== */

let koreanVoiceWarningShown = false;

function hasKoreanVoice() {
  if (!("speechSynthesis" in window)) return false;
  return window.speechSynthesis.getVoices().some(v => v.lang.startsWith("ko"));
}

function speakKorean(text, cardEl) {
  if (!("speechSynthesis" in window)) {
    alert("La synthèse vocale n'est pas supportée par ce navigateur.");
    return;
  }

  if (!hasKoreanVoice()) {
    if (!koreanVoiceWarningShown) {
      koreanVoiceWarningShown = true;
      alert(
        "Aucune voix coréenne n'est installée sur cet appareil/navigateur.\n\n" +
        "La prononciation ne peut pas fonctionner sans elle. " +
        "Il faut ajouter une voix coréenne dans les paramètres de langue de ton système \n\n" +
        "Ou essaye directement avec CHROME"
      );
    }
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 0.85;
  utterance.volume = userPrefs.voiceVolume;

  if (cardEl) {
    utterance.onstart = () => cardEl.classList.add("speaking");
    utterance.onend = () => cardEl.classList.remove("speaking");
    utterance.onerror = () => cardEl.classList.remove("speaking");
  }

  window.speechSynthesis.speak(utterance);
}

/* Chrome charge la liste des voix de façon asynchrone : on la
   "réveille" dès que possible pour que hasKoreanVoice() soit fiable
   le plus tôt possible plutôt qu'au premier clic seulement. */
if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}