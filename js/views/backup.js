// Backup & transfer between devices: file (download / share sheet), copy-paste code,
// import with preview and a choice between merging and replacing.
import {
  state, exportData, summarize, validateImport, mergeData, replaceData, markBackedUp, toCode, fromCode,
} from '../store.js';
import { icon, esc, toast, openSheet, closeSheet, relDays, dayKey, $ } from '../util.js';
import { applySettings, rerender } from '../app.js';

export function mountBackup(root) {
  const sum = summarize(state);
  const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }));
  root.innerHTML = `
    <div class="page-head"><h1>Sauvegarde & transfert</h1>
      <p>Tes données (mots, progression, réglages) restent sur cet appareil. Sauvegarde-les ou envoie-les vers ton autre appareil.</p></div>
    <div class="card" style="padding:14px 16px;margin-top:12px">
      <div class="row" style="flex-wrap:wrap"><b>Sur cet appareil (${esc(state.meta.device)})</b><span class="spacer"></span>
        <span class="small muted">Dernière sauvegarde : ${relDays(state.meta.lastBackup)}</span></div>
      <ul class="summary-list"><li>${sum.words} mots (${sum.known} connus)</li><li>${sum.read} textes lus</li><li>${sum.days} jours d’activité</li></ul>
      ${state.meta.lastBackup && Date.now() - state.meta.lastBackup < 7 * 864e5 ? '' : '<div class="warn">Sur téléphone, le navigateur peut effacer les données d’un site peu utilisé. Fais une sauvegarde de temps en temps.</div>'}
    </div>

    <h2 class="section-title">Envoyer vers un autre appareil</h2>
    <div class="big-actions">
      ${canShareFiles ? `<button class="card big-action" data-act="share"><span class="ic">${icon('share')}</span><span><b>Partager le fichier</b><span>Par e-mail, Drive, WhatsApp, Quick Share, AirDrop… puis ouvre-le sur l’autre appareil.</span></span></button>` : ''}
      <button class="card big-action" data-act="download"><span class="ic">${icon('backup')}</span><span><b>Télécharger le fichier</b><span>Un fichier .json à garder ou à importer ailleurs.</span></span></button>
      <button class="card big-action" data-act="code"><span class="ic">${icon('copy')}</span><span><b>Copier un code de transfert</b><span>Colle le code dans un message à toi-même (e-mail, notes, messagerie).</span></span></button>
    </div>

    <h2 class="section-title">Recevoir depuis un autre appareil</h2>
    <div class="big-actions">
      <label class="card big-action" style="cursor:pointer"><span class="ic">${icon('upload')}</span><span><b>Importer un fichier</b><span>Choisis le fichier .json de sauvegarde.</span></span>
        <input type="file" accept=".json,application/json" id="file" class="sr-only"></label>
      <button class="card big-action" data-act="paste"><span class="ic">${icon('paste')}</span><span><b>Coller un code</b><span>Le code commence par DADOK1.</span></span></button>
    </div>
    <p class="small muted" style="margin-top:18px">Astuce : « Fusionner » combine les deux appareils (aucun mot perdu, la progression la plus avancée gagne). « Remplacer » copie exactement l’autre appareil.</p>`;

  const fname = () => `dadok-sauvegarde-${dayKey()}.json`;
  const blob = () => new Blob([JSON.stringify(exportData(), null, 1)], { type: 'application/json' });

  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'download') {
      const url = URL.createObjectURL(blob());
      Object.assign(document.createElement('a'), { href: url, download: fname() }).click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      markBackedUp(); toast('Fichier de sauvegarde téléchargé');
    }
    if (a === 'share') {
      try {
        await navigator.share({ files: [new File([blob()], fname(), { type: 'application/json' })], title: 'Sauvegarde 다독+' });
        markBackedUp(); toast('Sauvegarde partagée');
      } catch (err) { if (err.name !== 'AbortError') toast('Partage impossible, utilise « Télécharger ».'); }
    }
    if (a === 'code') {
      const code = await toCode(exportData());
      const sheet = openSheet(`<h2>Code de transfert</h2>
        <p class="muted small">${(code.length / 1024).toFixed(1).replace('.', ',')} Ko · copie-le puis colle-le sur l’autre appareil dans « Coller un code ».</p>
        <textarea class="code-box" readonly>${esc(code)}</textarea>
        <div class="sheet-actions"><button class="btn primary wide" data-c="copy">${icon('copy', 18)} Copier</button></div>`, { label: 'Code de transfert' });
      sheet.querySelector('[data-c="copy"]').onclick = async () => {
        try { await navigator.clipboard.writeText(code); toast('Code copié ✓'); markBackedUp(); }
        catch { sheet.querySelector('textarea').select(); toast('Sélectionne le texte et copie-le'); }
      };
    }
    if (a === 'paste') {
      const sheet = openSheet(`<h2>Coller un code</h2>
        <textarea class="code-box" id="pc" placeholder="DADOK1.z…" style="background:var(--surface)"></textarea>
        <div class="sheet-actions"><button class="btn" data-c="clip">${icon('paste', 18)} Depuis le presse-papiers</button>
        <button class="btn primary" data-c="go">Continuer</button></div>`, { label: 'Coller un code' });
      sheet.addEventListener('click', async (ev) => {
        const c = ev.target.closest('[data-c]')?.dataset.c;
        if (c === 'clip') { try { $('#pc', sheet).value = await navigator.clipboard.readText(); } catch { toast('Colle le code à la main (appui long → Coller)'); } }
        if (c === 'go') {
          try { preview(validateImport(await fromCode($('#pc', sheet).value))); }
          catch (err) { toast(err.message || 'Code invalide'); }
        }
      });
    }
  });

  $('#file', root).addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { preview(validateImport(JSON.parse(await f.text()))); }
    catch (err) { toast(err.message?.startsWith('Ce fichier') || err.message?.startsWith('Sauvegarde') ? err.message : 'Fichier illisible'); }
    e.target.value = '';
  });

  function preview(data) {
    const o = summarize(data), m = summarize(state);
    const when = o.date ? new Date(o.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '?';
    const sheet = openSheet(`<h2>Importer ces données ?</h2>
      <p class="muted">Sauvegarde du ${esc(when)} (${esc(o.device)})</p>
      <div class="card" style="padding:12px 14px"><table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><th></th><th style="text-align:right">Ici</th><th style="text-align:right">Fichier</th></tr>
        <tr><td>Mots</td><td style="text-align:right">${m.words}</td><td style="text-align:right">${o.words}</td></tr>
        <tr><td>Mots connus</td><td style="text-align:right">${m.known}</td><td style="text-align:right">${o.known}</td></tr>
        <tr><td>Textes lus</td><td style="text-align:right">${m.read}</td><td style="text-align:right">${o.read}</td></tr>
        <tr><td>Jours d’activité</td><td style="text-align:right">${m.days}</td><td style="text-align:right">${o.days}</td></tr></table></div>
      <div class="sheet-actions">
        <button class="btn primary wide" data-i="merge">Fusionner (recommandé)</button>
        <button class="btn danger wide" data-i="replace">Remplacer tout ce qu’il y a ici</button>
      </div>`, { label: 'Confirmer l’import' });
    sheet.addEventListener('click', (ev) => {
      const k = ev.target.closest('[data-i]')?.dataset.i;
      if (!k) return;
      if (k === 'replace' && !confirm('Remplacer toutes les données de cet appareil par celles du fichier ?')) return;
      k === 'merge' ? mergeData(data) : replaceData(data);
      closeSheet(); applySettings();
      toast(k === 'merge' ? 'Données fusionnées ✓' : 'Données remplacées ✓');
      rerender();
    });
  }
}
