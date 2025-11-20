// ------------------------------------------------------
// manage-photos.js (V3 - Refactor + ZIP Overlay + Admin)
// ------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
window.showLoader = function (msg = "กำลังโหลด...") {
    const l = document.getElementById("globalLoader");
    l.querySelector(".loader-text").textContent = msg;
    l.style.display = "flex";
};

window.hideLoader = function () {
    document.getElementById("globalLoader").style.display = "none";
};

const SUPABASE_URL = "https://meluzbswvmpfyxewlszc.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lbHV6YnN3dm1wZnl4ZXdsc3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzQ0MDgsImV4cCI6MjA3ODYxMDQwOH0.ZYx6H28gPVpFU-tbN4tTD5Dl__OdoM7QABcJp8Z7_8Q";

const BUCKET = "inspection-photos";
const ADMIN_PIN = "240442";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- DOM ----------
const gallery = document.getElementById("gallery");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");

const btnRefresh = document.getElementById("btnRefresh");
const filterMonth = document.getElementById("filterMonth");
const searchInput = document.getElementById("searchInput");
const ageFilter = document.getElementById("ageFilter");

const btnScanOld = document.getElementById("btnScanOld");
const btnExportZip = document.getElementById("btnExportZip");
const btnDeleteOld = document.getElementById("btnDeleteOld");

// ปุ่ม Admin Unlock เพิ่มเข้าไปใน .controls
const pinBtn = document.createElement("button");
pinBtn.textContent = "🔒 Admin Unlock";
pinBtn.className = "btn small";
pinBtn.style.marginRight = "8px";
document.querySelector(".controls")?.prepend(pinBtn);

// ---------- STATE ----------
let adminUnlocked = false;
btnDeleteOld.disabled = true; // เริ่มต้นปิดปุ่มลบรูปเก่า

let inspectionsCache = [];
let photoItemsCache = []; // แปลงจาก row → รูปทีละภาพ

// ------------------------------------------------------
// Overlay สำหรับ ZIP
// ------------------------------------------------------
function showZipLoading(msg = "กำลังสร้างไฟล์ ZIP...") {
  const overlay = document.getElementById("zipOverlay");
  const text = document.getElementById("zipText");
  if (!overlay || !text) return;
  overlay.style.display = "flex";
  text.textContent = msg;
}

function hideZipLoading() {
  const overlay = document.getElementById("zipOverlay");
  if (!overlay) return;
  overlay.style.display = "none";
}

// ------------------------------------------------------
// Admin PIN Toggle
// ------------------------------------------------------
pinBtn.addEventListener("click", () => {
  // ถ้ายังไม่ unlock → ขอ PIN
  if (!adminUnlocked) {
    const pin = prompt("กรุณากรอกรหัส Admin:");
    if (pin === ADMIN_PIN) {
      adminUnlocked = true;
      pinBtn.textContent = "🔓 Admin Locked (Click to Lock)";
      btnDeleteOld.disabled = false;
      alert("ปลดล็อกสำเร็จ! (ปุ่มลบ & ลบรูปเก่าเปิดใช้งาน)");
      renderGallery(); // เพื่อให้ปุ่มลบบน card โชว์
    } else if (pin !== null) {
      alert("รหัสไม่ถูกต้อง");
    }
    return;
  }

  // กรณีอยู่ในสถานะ unlocked → กดเพื่อ lock กลับ
  adminUnlocked = false;
  pinBtn.textContent = "🔒 Admin Unlock";
  btnDeleteOld.disabled = true;
  alert("ล็อกสิทธิ์ Admin แล้ว (ซ่อนปุ่มลบ)");
  renderGallery();
});

// ------------------------------------------------------
// LOAD DATA จาก Supabase
// ------------------------------------------------------
async function loadInspections() {
  setStatus("กำลังโหลดข้อมูล...");
  gallery.innerHTML = "";

  try {
    const { data, error } = await sb
      .from("inspections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    inspectionsCache = data || [];
    photoItemsCache = buildPhotoItems(inspectionsCache);

    populateFilterMonths(inspectionsCache);
    updateSummary();
    renderGallery();

    setStatus(
      `โหลดสำเร็จ (${inspectionsCache.length} งาน, ${photoItemsCache.length} รูป)`
    );
  } catch (err) {
    console.error(err);
    setStatus("โหลดผิดพลาด: " + err.message, true);
  }
}

// แปลงแต่ละ row → รูปทีละรูป
function buildPhotoItems(rows) {
  const items = [];
  rows.forEach((r) => {
    let photos;
    try {
      photos = Array.isArray(r.photos)
        ? r.photos
        : typeof r.photos === "string"
        ? JSON.parse(r.photos)
        : [];
    } catch {
      photos = [];
    }

    photos.forEach((p) => {
      items.push({
        inspectionId: r.id,
        date: r.date, // YYYY-MM-DD
        dept: r.dept,
        owner: r.owner,
        supervisor: r.supervisor,
        created_at: r.created_at,
        spec: r.spec,
        takenAt: p.takenAt,
        name: p.name,
        url: p.url
      });
    });
  });
  return items;
}

function populateFilterMonths(rows) {
  const months = new Set();
  rows.forEach((r) => {
    if (r.date && r.date.length >= 7) months.add(r.date.slice(0, 7));
  });

  filterMonth.innerHTML = `<option value="">ทุกเดือน</option>`;
  [...months]
    .sort((a, b) => b.localeCompare(a))
    .forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      filterMonth.appendChild(opt);
    });
}

// ------------------------------------------------------
// AGE / SUMMARY
// ------------------------------------------------------
function getPhotoAgeDays(item) {
  let baseDate = null;

  if (item.takenAt) baseDate = new Date(item.takenAt);
  else if (item.date) baseDate = new Date(item.date);
  else if (item.created_at) baseDate = new Date(item.created_at);

  if (!baseDate || isNaN(baseDate.getTime())) return null;

  const now = new Date();
  const diffMs = now - baseDate;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function updateSummary() {
  const total = photoItemsCache.length;
  const oldCount = photoItemsCache.filter((p) => {
    const age = getPhotoAgeDays(p);
    return age !== null && age >= 25;
  }).length;

  if (!summaryEl) return;
  summaryEl.textContent =
    total === 0
      ? "ยังไม่มีรูปในระบบ"
      : `รูปทั้งหมด: ${total} รูป • รูปอายุ ≥ 25 วัน: ${oldCount} รูป`;
}

// ------------------------------------------------------
// RENDER GALLERY
// ------------------------------------------------------
function renderGallery() {
  gallery.innerHTML = "";

  if (!photoItemsCache.length) {
    gallery.innerHTML = `<div class="muted small">ยังไม่มีรูปในระบบ</div>`;
    return;
  }

  const q = (searchInput.value || "").trim().toLowerCase();
  const monthFilter = filterMonth.value;
  const ageMode = ageFilter.value; // "", "old", "recent"

  const filtered = photoItemsCache.filter((it) => {
    if (monthFilter && (!it.date || !it.date.startsWith(monthFilter)))
      return false;

    const age = getPhotoAgeDays(it);
    if (ageMode === "old") {
      if (age === null || age < 25) return false;
    } else if (ageMode === "recent") {
      if (age === null || age > 30) return false;
    }

    if (q) {
      const joined = [
        it.name,
        it.dept,
        it.owner,
        it.supervisor,
        it.date
      ]
        .join(" ")
        .toLowerCase();
      if (!joined.includes(q)) return false;
    }

    return true;
  });

  if (!filtered.length) {
    gallery.innerHTML = `<div class="muted small">ไม่พบข้อมูลตามเงื่อนไข</div>`;
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement("div");
    const ageDays = getPhotoAgeDays(item);
    const isOld = ageDays !== null && ageDays >= 25;

    card.className = "photo-card" + (isOld ? " old-photo" : "");

    const ageText =
      ageDays === null
        ? "ไม่ทราบอายุ"
        : `${ageDays} วัน` + (isOld ? " (เกิน 25 วัน)" : "");

    card.innerHTML = `
      <img src="${item.url}" alt="${item.name}">
      <div class="meta">
        <strong>${item.name || "-"}</strong>
        <div>${item.date || "-"} • ${item.dept || "-"}</div>
      </div>
      <div class="meta small">ผู้ทำ: ${item.owner || "-"}</div>
      <div class="meta small">หัวหน้า: ${item.supervisor || "-"}</div>
      <div class="photo-footer">
        <div class="meta small">ถ่ายเมื่อ: ${
          item.takenAt
            ? new Date(item.takenAt).toLocaleString("th-TH")
            : "-"
        }</div>
        <div class="badge ${isOld ? "old" : ""}">
          อายุ: ${ageText}
        </div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "photo-actions";

    const openBtn = document.createElement("a");
    openBtn.className = "btn small";
    openBtn.textContent = "เปิด";
    openBtn.href = item.url;
    openBtn.target = "_blank";
    actions.appendChild(openBtn);

    if (adminUnlocked) {
      const delBtn = document.createElement("button");
      delBtn.className = "btn small danger";
      delBtn.textContent = "ลบ";
      delBtn.addEventListener("click", () => {
        if (confirm("ลบรูปนี้จริงหรือไม่?")) deleteSinglePhoto(item);
      });
      actions.appendChild(delBtn);
    }

    card.appendChild(actions);
    gallery.appendChild(card);
  });
}

// ------------------------------------------------------
// SCAN OLD PHOTOS
// ------------------------------------------------------
function getOldPhotos() {
  return photoItemsCache.filter((p) => {
    const age = getPhotoAgeDays(p);
    return age !== null && age >= 25;
  });
}

btnScanOld.addEventListener("click", () => {
  const old = getOldPhotos();
  if (!old.length) {
    alert("ยังไม่มีรูปที่มีอายุ ≥ 25 วัน");
    return;
  }

  ageFilter.value = "old";
  renderGallery();
  setStatus(`พบรูปอายุ ≥ 25 วัน จำนวน ${old.length} รูป`, false);
});

// ------------------------------------------------------
// ZIP EXPORT V3 (โฟลเดอร์ย่อย + summary.json + overlay)
// ------------------------------------------------------
btnExportZip.addEventListener("click", async () => {
  const old = getOldPhotos();
  if (!old.length) {
    alert("ยังไม่มีรูปที่มีอายุ ≥ 25 วัน สำหรับทำ ZIP");
    return;
  }

  if (!window.JSZip) {
    alert("ไม่พบ JSZip (ตัวสร้าง ZIP) กรุณาเพิ่มสคริปต์ JSZip ใน manage-photos.html");
    return;
  }

  if (
    !confirm(
      `ยืนยันสร้าง ZIP สำหรับรูปเก่าจำนวน ${old.length} รูป? (ระบบอาจใช้เวลาสักครู่)`
    )
  ) {
    return;
  }

  try {
    btnExportZip.disabled = true;
    showZipLoading("กำลังเตรียมข้อมูล ZIP...");

    const zipData = buildZipData(old); // เตรียม zipName, items, summary

    const zipBlob = await generateZip(zipData);

    showZipLoading("กำลังเตรียมดาวน์โหลด...");
    downloadBlob(zipBlob, zipData.zipName);

    hideZipLoading();
    setStatus(`สร้าง ZIP สำเร็จ: ${zipData.zipName}`);

    if (!adminUnlocked) {
      alert(
        "ดาวน์โหลด ZIP เสร็จแล้ว\nหากต้องการลบรูปเก่าจากระบบ กรุณา Admin Unlock ก่อน แล้วใช้ปุ่ม 'ลบรูปเก่า'"
      );
    } else {
      if (
        confirm(
          "ต้องการลบรูปเก่า (≥ 25 วัน) ทั้งหมดจากระบบเลยหรือไม่?\nหมายเหตุ: หลังลบแล้วจะไม่สามารถกู้คืนได้"
        )
      ) {
        await deleteOldPhotos(old);
        await loadInspections();
      }
    }
  } catch (err) {
    console.error(err);
    hideZipLoading();
    setStatus("สร้าง ZIP ผิดพลาด: " + err.message, true);
    alert("สร้าง ZIP ไม่สำเร็จ: " + err.message);
  } finally {
    btnExportZip.disabled = false;
  }
});

// เตรียมข้อมูล ZIP: structure + summary
function buildZipData(oldPhotos) {
  if (!oldPhotos.length) throw new Error("ไม่พบรูปเก่า");

  const dateList = oldPhotos
    .map((p) => p.date || (p.takenAt ? p.takenAt.slice(0, 10) : null))
    .filter(Boolean)
    .sort();

  const startDate = dateList[0];
  const endDate = dateList[dateList.length - 1];

  const zipName =
    "Inspection" +
    formatDateForName(startDate) +
    "-" +
    formatDateForName(endDate) +
    ".zip";

  const items = [];
  const summary = [];

  oldPhotos.forEach((p, idx) => {
    const ageDays = getPhotoAgeDays(p);
    const dateKey =
      p.date || (p.takenAt ? p.takenAt.slice(0, 10) : "unknown");

    const takenDateTime =
      p.takenAt ? new Date(p.takenAt) : p.date ? new Date(p.date) : null;

    const timestamp = takenDateTime
      ? formatDateTimeForFilename(takenDateTime)
      : "unknown";

    const baseName = `${timestamp}_${p.dept || ""}_${p.name || "photo"}_${
      idx + 1
    }.jpg`;
    const safeName = sanitizeFilename(baseName);
    const folder = dateKey || "unknown";
    const filePathInZip = `${folder}/${safeName}`;

    items.push({
      ...p,
      folder,
      fileName: safeName,
      filePathInZip
    });

    summary.push({
      date: dateKey,
      takenAt: p.takenAt || null,
      dept: p.dept || null,
      owner: p.owner || null,
      supervisor: p.supervisor || null,
      line: extractLineFromSpec(p.spec),
      modeOrType: extractModeOrTypeFromSpec(p.spec),
      name: p.name || null,
      inspectionId: p.inspectionId,
      ageDays: ageDays,
      filePathInZip
    });
  });

  return { zipName, items, summary };
}

// ใช้ JSZip สร้างไฟล์ ZIP จริง
async function generateZip(zipData) {
  const zip = new JSZip();
  const folders = new Map();
  const total = zipData.items.length;

  for (let i = 0; i < total; i++) {
    const item = zipData.items[i];
    const key = item.folder || "unknown";

    if (!folders.has(key)) folders.set(key, zip.folder(key));
    const folder = folders.get(key);

    showZipLoading(`กำลังดึงรูปที่ ${i + 1} / ${total}...`);

    const res = await fetch(item.url);
    const blob = await res.blob();

    folder.file(item.fileName, blob);
  }

  // ใส่ summary.json ที่ root
  zip.file("summary.json", JSON.stringify(zipData.summary, null, 2));

  showZipLoading("กำลังบีบอัดไฟล์ ZIP...");
  const content = await zip.generateAsync({ type: "blob" });
  return content;
}

// ดาวน์โหลด blob เป็นไฟล์
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ------------------------------------------------------
// DELETE OLD PHOTOS (bulk) - ลบ row ถ้ารูปหมด
// ------------------------------------------------------
btnDeleteOld.addEventListener("click", async () => {
  if (!adminUnlocked) {
    alert("กรุณา Admin Unlock ก่อน (กดปุ่ม 🔒 Admin Unlock)");
    return;
  }

  const old = getOldPhotos();
  if (!old.length) {
    alert("ไม่มีรูปเก่า (≥ 25 วัน) ให้ลบ");
    return;
  }

  if (
    !confirm(
      `ยืนยันลบรูปเก่า (≥ 25 วัน) จำนวน ${old.length} รูปออกจากระบบ?`
    )
  ) {
    return;
  }

  try {
    await deleteOldPhotos(old);
    await loadInspections();
    alert("ลบรูปเก่าสำเร็จ");
  } catch (err) {
    console.error(err);
    alert("ลบรูปเก่าไม่สำเร็จ: " + err.message);
  }
});

async function deleteOldPhotos(oldPhotos) {
  setStatus("กำลังลบรูปเก่า...");

  const paths = oldPhotos
    .map((p) => extractPathFromPublicUrl(p.url))
    .filter(Boolean);

  if (paths.length) {
    const { error: rmErr } = await sb.storage.from(BUCKET).remove(paths);
    if (rmErr) throw rmErr;
  }

  const byInspection = new Map();
  oldPhotos.forEach((p) => {
    if (!byInspection.has(p.inspectionId)) {
      byInspection.set(p.inspectionId, []);
    }
    byInspection.get(p.inspectionId).push(p.url);
  });

  for (const [inspectionId, urls] of byInspection.entries()) {
    const { data: row, error: rowErr } = await sb
      .from("inspections")
      .select("*")
      .eq("id", inspectionId)
      .single();

    if (rowErr) throw rowErr;

    let photos;
    try {
      photos = Array.isArray(row.photos)
        ? row.photos
        : typeof row.photos === "string"
        ? JSON.parse(row.photos)
        : [];
    } catch {
      photos = [];
    }

    const remain = photos.filter((p) => !urls.includes(p.url));

    if (remain.length === 0) {
      const { error: delErr } = await sb
        .from("inspections")
        .delete()
        .eq("id", inspectionId);
      if (delErr) throw delErr;
    } else {
      const { error: updErr } = await sb
        .from("inspections")
        .update({ photos: remain })
        .eq("id", inspectionId);
      if (updErr) throw updErr;
    }
  }

  setStatus("ลบรูปเก่าออกจากระบบเรียบร้อยแล้ว");
}

// ------------------------------------------------------
// DELETE SINGLE PHOTO (ลบ row ถ้ารูปหมด)
// ------------------------------------------------------
async function deleteSinglePhoto(item) {
  try {
    setStatus("กำลังลบรูป...");

    const path = extractPathFromPublicUrl(item.url);
    if (!path) throw new Error("ไม่พบ path ของรูปใน Storage");

    const { error: removeErr } = await sb.storage.from(BUCKET).remove([path]);
    if (removeErr) throw removeErr;

    const { data: row, error: rowErr } = await sb
      .from("inspections")
      .select("*")
      .eq("id", item.inspectionId)
      .single();

    if (rowErr) throw rowErr;

    let photos;
    try {
      photos = Array.isArray(row.photos)
        ? row.photos
        : typeof row.photos === "string"
        ? JSON.parse(row.photos)
        : [];
    } catch {
      photos = [];
    }

    const remain = photos.filter((p) => p.url !== item.url);

    if (remain.length === 0) {
      const { error: delErr } = await sb
        .from("inspections")
        .delete()
        .eq("id", item.inspectionId);
      if (delErr) throw delErr;
    } else {
      const { error: updateErr } = await sb
        .from("inspections")
        .update({ photos: remain })
        .eq("id", item.inspectionId);
      if (updateErr) throw updateErr;
    }

    setStatus("ลบรูปสำเร็จ!");
    await loadInspections();
  } catch (err) {
    console.error(err);
    setStatus("ลบรูปไม่สำเร็จ: " + err.message, true);
  }
}

// ------------------------------------------------------
// UTILS
// ------------------------------------------------------
function extractPathFromPublicUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const idx = parts.indexOf("public");
    return parts.slice(idx + 2).join("/");
  } catch {
    return null;
  }
}

function setStatus(msg, err = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = err ? "crimson" : "";
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9ก-ฮะ-์\.\-_]/g, "_");
}

// "YYYY-MM-DD" → "DDMMYY"
function formatDateForName(dateStr) {
  if (!dateStr || dateStr.length < 10) return "unknown";
  const [y, m, d] = dateStr.split("-");
  return `${d}${m}${y.slice(2)}`;
}

// ใช้ทำชื่อไฟล์ timestamp เช่น 20251101_084455
function formatDateTimeForFilename(dt) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  const ss = pad(dt.getSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}`;
}

function extractLineFromSpec(spec) {
  try {
    const obj =
      typeof spec === "string" ? JSON.parse(spec) : spec || {};
    return obj.line || null;
  } catch {
    return null;
  }
}

function extractModeOrTypeFromSpec(spec) {
  try {
    const obj =
      typeof spec === "string" ? JSON.parse(spec) : spec || {};
    return obj.mode || obj.type || null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------
// EVENTS & BOOT
// ------------------------------------------------------
btnRefresh.addEventListener("click", loadInspections);
filterMonth.addEventListener("change", renderGallery);
searchInput.addEventListener("input", () => renderGallery());
ageFilter.addEventListener("change", () => renderGallery());

loadInspections();
