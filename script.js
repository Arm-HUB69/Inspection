// script.js (No-login, v2 - เฉพาะฟอร์ม)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

window.showLoader = function (msg = "กำลังโหลด...") {
  const l = document.getElementById("globalLoader");
  if (!l) return;
  const textEl = l.querySelector(".loader-text");
  if (textEl) textEl.textContent = msg;
  l.style.display = "flex";
};

window.hideLoader = function () {
  const l = document.getElementById("globalLoader");
  if (!l) return;
  l.style.display = "none";
};

const SUPABASE_URL = "https://meluzbswvmpfyxewlszc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lbHV6YnN3dm1wZnl4ZXdsc3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzQ0MDgsImV4cCI6MjA3ODYxMDQwOH0.ZYx6H28gPVpFU-tbN4tTD5Dl__OdoM7QABcJp8Z7_8Q";
const BUCKET = "inspection-photos";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM
const deptBtns = document.querySelectorAll(".dept-btn");
const flow = document.getElementById("flow");
const crumbDept = document.getElementById("crumbDept");
const backToDept = document.getElementById("backToDept");
const dynamicArea = document.getElementById("dynamicArea");
const checkpointsEl = document.getElementById("checkpoints");
const workDate = document.getElementById("workDate");
const uploadBtn = document.getElementById("uploadBtn");
const ownerName = document.getElementById("ownerName");
const supervisorName = document.getElementById("supervisorName");
const statusEl = document.getElementById("status");

let currentDept = null;
let currentSpec = {};

// packing lines
const LINES = ["Line 2","Line 3","Line 4","Line 6","Line 7","Line 8","Line 9","Line 11","Line 12"];

if (workDate) {
  workDate.value = new Date().toISOString().slice(0,10);
}

// events
deptBtns.forEach(btn =>
  btn.addEventListener("click", () => chooseDept(btn.dataset.dept))
);

if (backToDept) {
  backToDept.addEventListener("click", (e) => {
    e.preventDefault();
    if (flow) flow.style.display = "none";
    if (dynamicArea) dynamicArea.innerHTML = "";
    if (checkpointsEl) checkpointsEl.innerHTML = "";
  });
}

function chooseDept(dept) {
  currentDept = dept;
  if (crumbDept) crumbDept.textContent = dept;
  if (flow) flow.style.display = "block";
  if (ownerName) ownerName.value = "";
  if (supervisorName) supervisorName.value = "";
  if (workDate) workDate.value = new Date().toISOString().slice(0,10);
  if (dynamicArea) dynamicArea.innerHTML = "";
  if (checkpointsEl) checkpointsEl.innerHTML = "";
  currentSpec = {};

  if (dept === "Blending") renderBlending();
  else if (dept === "Packing") renderPacking();
  else if (dept === "Intake") renderIntake();

  status("");
}

// ------------------------------------------------------
// BLENDING
// ------------------------------------------------------
function renderBlending() {
  if (!dynamicArea) return;
  dynamicArea.innerHTML = "";

  const sel = document.createElement("select");
  sel.id = "blendType";
  sel.innerHTML = `
    <option value="IMS">IMS Bin</option>
    <option value="Hopper">Hopper</option>
  `;
  sel.addEventListener("change", () => renderBlendingSub(sel.value));

  dynamicArea.appendChild(labelWrap("ประเภท", sel));
  renderBlendingSub("IMS");
}

function renderBlendingSub(type) {
  if (!checkpointsEl || !dynamicArea) return;
  checkpointsEl.innerHTML = "";
  currentSpec = { type };

  const oldExtra = document.getElementById("blendExtra");
  if (oldExtra) oldExtra.remove();

  const wrap = document.createElement("div");
  wrap.id = "blendExtra";

  if (type === "IMS") {
    const sel = document.createElement("select");
    sel.id = "imsBin";

    sel.innerHTML = Array.from({ length: 40 }, (_, i) =>
      `<option value="${501 + i}">${501 + i}</option>`
    ).join("");

    sel.addEventListener("change", () => {
      currentSpec.bin = sel.value;
    });

    currentSpec.bin = "501";
    currentSpec.time = new Date().toLocaleString("th-TH");

    wrap.appendChild(labelWrap("เลือก Bin (IMS)", sel));
    dynamicArea.appendChild(wrap);

    addCP("Manhole");
    addCP("Rotary");
    addCP("Sieve");
    return;
  }

  const sel = document.createElement("select");
  sel.id = "hopperArea";

  const HOPPER_AREAS = ["6.1", "6.2", "6.3", "6.4"];
  sel.innerHTML = HOPPER_AREAS.map(a => `<option value="${a}">${a}</option>`).join("");

  sel.addEventListener("change", () => {
    currentSpec.area = sel.value;
  });

  currentSpec.area = HOPPER_AREAS[0];
  currentSpec.time = new Date().toLocaleString("th-TH");

  wrap.appendChild(labelWrap("เลือก Area (Hopper)", sel));
  dynamicArea.appendChild(wrap);

  addCP("Manhole");
}

// ------------------------------------------------------
// PACKING
// ------------------------------------------------------
function renderPacking(){
  if (!dynamicArea || !checkpointsEl) return;
  dynamicArea.innerHTML = "";
  checkpointsEl.innerHTML = "";

  const sel = document.createElement("select");
  sel.id = "packLine";
  sel.innerHTML = LINES.map(l=>`<option value="${l}">${l}</option>`).join("");
  sel.addEventListener("change", ()=> renderPackingSub(sel.value));
  dynamicArea.appendChild(labelWrap("ไลน์", sel));

  renderPackingSub(LINES[0]);
}

function renderPackingSub(line){
  if (!dynamicArea || !checkpointsEl) return;

  currentSpec = {};
  dynamicArea.querySelectorAll(".system-row").forEach(x => x.remove());
  checkpointsEl.innerHTML = "";
  currentSpec.line = line;

  const both = ["Line 2","Line 8","Line 9","Line 11","Line 12"];

  if (both.includes(line)){
    const sel = document.createElement("select");
    sel.id = "systemSel";
    sel.innerHTML = `
      <option value="air">ระบบลม</option>
      <option value="cable">ระบบเคเบิ้ลเวย์</option>
    `;

    sel.addEventListener("change", ()=> renderPackingCheckpoints(line, sel.value));

    const row = labelWrap("ระบบ", sel);
    row.classList.add("system-row");
    dynamicArea.appendChild(row);

    renderPackingCheckpoints(line, "air");
  } else {
    renderPackingCheckpoints(line, "air");
  }
}

function renderPackingCheckpoints(line, system){
  if (!checkpointsEl) return;
  checkpointsEl.innerHTML = "";
  currentSpec.line = line;
  currentSpec.system = system;

  if (!currentSpec.time) {
    currentSpec.time = new Date().toLocaleString("th-TH");
  }

  if (system === "air"){
    addCP("Manhole");
    addCP("V-slide");
    addCP("Multi-head Weight");
    addCP("Reseed");
  } else {
    const count = (line === "Line 11" || line === "Line 12") ? 2 : 1;
    addCP("Magnets", count);
    addCP("Manhole", count);
    addCP("V-slide", count);
    addCP("Multi-head Weight",1);
    addCP("Reseed",1);
  }
}

// ------------------------------------------------------
// INTAKE
// ------------------------------------------------------
function renderIntake(){
  if (!dynamicArea || !checkpointsEl) return;
  dynamicArea.innerHTML = "";
  checkpointsEl.innerHTML = "";

  const sel = document.createElement("select");
  sel.id = "intakeMode";
  sel.innerHTML = `
    <option value="manhole">Tip → Manhole</option>
    <option value="bucket">Bucket Chain</option>
  `;
  sel.addEventListener("change", ()=> renderIntakeSub(sel.value));
  dynamicArea.appendChild(labelWrap("โหมด", sel));

  const lineSel = document.createElement("select");
  lineSel.id = "intakeLine";
  lineSel.innerHTML = LINES.map(x=>`<option value="${x}">${x}</option>`).join("");
  lineSel.addEventListener("change", ()=> currentSpec.line = lineSel.value );
  dynamicArea.appendChild(labelWrap("ไลน์", lineSel));

  currentSpec.line = lineSel.value || LINES[0];

  renderIntakeSub("manhole");
}

function renderIntakeSub(mode){
  if (!checkpointsEl) return;
  checkpointsEl.innerHTML = "";
  currentSpec.mode = mode;

  if (!currentSpec.time) {
    currentSpec.time = new Date().toLocaleString("th-TH");
  }

  if (mode === "manhole"){
    addCP("Truck (Feed)");
    addCP("Manhole");
  } else {
    addCP("Hopper");
    addCP("Bucket");
  }
}

// ------------------------------------------------------
// helper create CP
// ------------------------------------------------------
function addCP(name, count=1){
  if (!checkpointsEl) return;

  for (let i=1;i<=count;i++){
    const wrap = document.createElement("div");
    wrap.className = "check-item";
    wrap.dataset.name = count>1 ? `${name} ${i}` : name;
    wrap.innerHTML = `<strong>${wrap.dataset.name}</strong><br>`;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    const img = document.createElement("img");
    img.className = "thumb";
    img.style.display = "none";
    img.style.maxWidth = "260px";

    input.addEventListener("change", e=>{
      const file = e.target.files[0];
      if (!file) return;
      wrap._file = file;
      img.src = URL.createObjectURL(file);
      img.style.display = "block";

      const old = wrap.querySelector(".small.muted");
      if (old) old.remove();

      const info = document.createElement("div");
      info.className = "small muted";
      info.textContent = `เวลาถ่าย: ${new Date(file.lastModified).toLocaleString()}`;
      wrap.appendChild(info);
    });

    wrap.appendChild(input);
    wrap.appendChild(img);
    checkpointsEl.appendChild(wrap);
  }
}

function labelWrap(text, elem){
  const div = document.createElement("div");
  div.className = "form-row";
  const lab = document.createElement("label");
  lab.textContent = text;
  div.appendChild(lab);
  div.appendChild(elem);
  return div;
}

// ------------------------------------------------------
// UPLOAD (NO LOGIN)
// ------------------------------------------------------
if (uploadBtn) {
  uploadBtn.addEventListener("click", async ()=>{
    const owner = ownerName.value.trim();
    if (!owner) return status("กรุณากรอกชื่อผู้ทำความสะอาด", true);

    const date = workDate.value;
    const cpNodes = checkpointsEl.querySelectorAll(".check-item");
    if (cpNodes.length === 0) return status("ยังไม่มี Checkpoints ให้ถ่ายรูป", true);

    const photos = [];

    for (const c of cpNodes){
      const fname = c.dataset.name;
      const file = c._file;
      if (!file) return status(`ยังไม่ได้เลือกรูป: ${fname}`, true);

      const ext = file.name.split(".").pop();
      const safeName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const folder = date.replace(/-/g,"");
      const filePath = `${folder}/${safeName}`;

      status(`อัปโหลด ${fname} ...`);

      const up = await sb.storage.from(BUCKET).upload(filePath, file);
      if (up.error) return status(`อัปโหลดผิดพลาด: ${up.error.message}`, true);

      const url = sb.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
      photos.push({ name: fname, url, takenAt: new Date(file.lastModified).toISOString() });
    }

    currentSpec.time = new Date().toLocaleString("th-TH");

    const payload = {
      dept: currentDept,
      spec: currentSpec || {},
      owner,
      supervisor: supervisorName.value.trim(),
      date,
      work_time: new Date().toLocaleString("th-TH"),
      created_at: new Date().toISOString(),
      photos
    };

    const { error } = await sb.from("inspections").insert([payload]);
    if (error) return status("บันทึกผิดพลาด: " + error.message, true);

    status("ส่งรายงานสำเร็จ! 🎉");
    checkpointsEl.innerHTML = "";
  });
}

function status(msg, err=false){
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = err ? "crimson" : "";
}
