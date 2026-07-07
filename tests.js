/* QuestKeep logic tests — mirrors index.html implementations exactly.
   Runs in Node (v19+ has WebCrypto at globalThis.crypto). */
const assert = require("assert");
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));

async function deriveKey(pass, saltB64) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: unb64(saltB64), iterations: 250000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptJSON(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
  return JSON.stringify({ iv: b64(iv), ct: b64(ct) });
}
async function decryptJSON(payload, key) {
  const { iv, ct } = JSON.parse(payload);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
  return JSON.parse(dec.decode(pt));
}

/* fake localStorage with a settable quota, mirroring sSet in the app */
function makeStorage(quotaBytes = Infinity) {
  const store = new Map();
  let used = 0;
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      const delta = v.length - (store.get(k)?.length || 0);
      if (used + delta > quotaBytes) {
        const e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
      }
      store.set(k, v); used += delta;
    },
    removeItem: (k) => { used -= store.get(k)?.length || 0; store.delete(k); },
  };
}
function sSet(ls, k, v) {
  try { ls.setItem(k, v); return { ok: true }; }
  catch (e) { return { ok: false, quota: e.name === "QuotaExceededError" }; }
}

(async () => {
  const results = [];
  const t = (name, fn) => fn().then(() => results.push("PASS  " + name))
    .catch((e) => results.push("FAIL  " + name + "  →  " + e.message));

  const PASS = "correct horse battery";
  const sampleVault = {
    activities: ["Security+ study", "OSRS"],
    days: { "2026-07-07": { blocks: [{ id: "x1", label: "Unity dev", start: "18:00", end: "19:30", done: true, kind: "custom" }], hiddenAuto: [], doneAuto: ["auto-work"], note: "private journal entry — should never appear in ciphertext" } },
    settings: { autoWork: true, workStart: "08:00", workEnd: "17:00", driveMin: 30 },
  };

  await t("1. encrypt → decrypt round-trip preserves vault exactly", async () => {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const key = await deriveKey(PASS, salt);
    const out = await decryptJSON(await encryptJSON(sampleVault, key), key);
    assert.deepStrictEqual(out, sampleVault);
  });

  await t("2. ciphertext leaks no plaintext (journal text absent from stored blob)", async () => {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const key = await deriveKey(PASS, salt);
    const blob = await encryptJSON(sampleVault, key);
    assert(!blob.includes("journal"), "plaintext leaked");
    assert(!blob.includes("Unity"), "plaintext leaked");
  });

  await t("3. wrong passphrase fails decryption (does not return garbage)", async () => {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const key = await deriveKey(PASS, salt);
    const wrong = await deriveKey("hunter2wrong", salt);
    const blob = await encryptJSON(sampleVault, key);
    await assert.rejects(() => decryptJSON(blob, wrong));
  });

  await t("4. export → import → unlock on 'new device' restores identical vault", async () => {
    // device A
    const lsA = makeStorage();
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const keyA = await deriveKey(PASS, salt);
    lsA.setItem("qk:meta", JSON.stringify({ salt, check: await encryptJSON({ ok: true }, keyA), v: 1 }));
    lsA.setItem("qk:vault", await encryptJSON(sampleVault, keyA));
    // export (exact app logic)
    const exportFile = JSON.stringify({ app: "questkeep", fmt: 1, exported: new Date().toISOString(),
      meta: JSON.parse(lsA.getItem("qk:meta")), vault: JSON.parse(lsA.getItem("qk:vault")) });
    // device B: import
    const lsB = makeStorage();
    const p = JSON.parse(exportFile);
    assert(["questkeep", "shift-ledger"].includes(p.app) && p.meta?.salt && p.meta?.check && p.vault?.ct, "format check");
    lsB.setItem("qk:meta", JSON.stringify(p.meta));
    lsB.setItem("qk:vault", JSON.stringify(p.vault));
    // device B: unlock with original passphrase
    const metaB = JSON.parse(lsB.getItem("qk:meta"));
    const keyB = await deriveKey(PASS, metaB.salt);
    await decryptJSON(metaB.check, keyB);                     // passphrase verification
    const restored = await decryptJSON(lsB.getItem("qk:vault"), keyB);
    assert.deepStrictEqual(restored, sampleVault);
  });

  await t("5. import rejects malformed / non-QuestKeep files", async () => {
    for (const bad of ['{"app":"other"}', '{"app":"questkeep"}', "not json at all"]) {
      let rejected = false;
      try {
        const p = JSON.parse(bad);
        if (!["questkeep", "shift-ledger"].includes(p.app) || !p.meta?.salt || !p.meta?.check || !p.vault?.ct) rejected = true;
      } catch { rejected = true; }
      assert(rejected, "accepted bad file: " + bad);
    }
  });

  await t("6. QUOTA FULL: save fails gracefully, flags quota, data still exportable from memory+meta", async () => {
    const ls = makeStorage(5000); // tiny quota
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const key = await deriveKey(PASS, salt);
    assert(sSet(ls, "qk:meta", JSON.stringify({ salt, check: await encryptJSON({ ok: true }, key), v: 1 })).ok);
    // grow the vault until it can't fit
    const fat = structuredClone(sampleVault);
    fat.days["2026-07-07"].note = "x".repeat(20000);
    const res = sSet(ls, "qk:vault", await encryptJSON(fat, key));
    assert.strictEqual(res.ok, false, "should fail");
    assert.strictEqual(res.quota, true, "should flag quota");
    // banner-export path: encrypt from MEMORY, meta from storage — no disk write needed
    const rescueFile = JSON.stringify({ app: "questkeep", fmt: 1,
      meta: JSON.parse(ls.getItem("qk:meta")), vault: JSON.parse(await encryptJSON(fat, key)) });
    const p = JSON.parse(rescueFile);
    const rKey = await deriveKey(PASS, p.meta.salt);
    const rescued = await decryptJSON(JSON.stringify(p.vault), rKey);
    assert.strictEqual(rescued.days["2026-07-07"].note.length, 20000, "rescued data intact");
  });

  await t("7. legacy .slv (shift-ledger) backups still import", async () => {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const key = await deriveKey(PASS, salt);
    const legacy = { app: "shift-ledger", fmt: 1,
      meta: { salt, check: await encryptJSON({ ok: true }, key), v: 1 },
      vault: JSON.parse(await encryptJSON(sampleVault, key)) };
    const p = legacy;
    assert(["questkeep", "shift-ledger"].includes(p.app) && p.meta?.salt && p.meta?.check && p.vault?.ct);
    const out = await decryptJSON(JSON.stringify(p.vault), await deriveKey(PASS, p.meta.salt));
    assert.deepStrictEqual(out, sampleVault);
  });

  console.log(results.join("\n"));
  if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
})();
