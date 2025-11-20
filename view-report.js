import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
window.showLoader = function (msg = "กำลังโหลด...") {
    const l = document.getElementById("globalLoader");
    l.querySelector(".loader-text").textContent = msg;
    l.style.display = "flex";
};

window.hideLoader = function () {
    document.getElementById("globalLoader").style.display = "none";
};

const url = "https://meluzbswvmpfyxewlszc.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lbHV6YnN3dm1wZnl4ZXdsc3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzQ0MDgsImV4cCI6MjA3ODYxMDQwOH0.ZYx6H28gPVpFU-tbN4tTD5Dl__OdoM7QABcJp8Z7_8Q";
const sb = createClient(url, key);

const content = document.getElementById("content");
const q = document.getElementById("q");
const topBtn = document.getElementById("topBtn");

document.getElementById("btnRefresh").onclick = () => load();
q.oninput = () => load(q.value);

// ปุ่มขึ้นบนสุด
window.onscroll = () => {
  topBtn.style.display = window.scrollY > 150 ? "block" : "none";
};
topBtn.onclick = () => window.scrollTo({ top:0, behavior:"smooth" });

function makeSpecTable(r){
  const s = r.spec || {};
  const rows = [];

  if (r.dept === "Blending"){
    rows.push(["ประเภท", s.type]);
    if (s.type === "IMS") rows.push(["Bin", s.bin]);
    if (s.type === "Hopper") rows.push(["Area", s.area]);
  }
  if (r.dept === "Packing"){
    rows.push(["Line", s.line]);
    rows.push(["ระบบ", s.system]);
  }
  if (r.dept === "Intake"){
    rows.push(["โหมด", s.mode]);
    rows.push(["ไลน์", s.line]);
  }

  rows.push(["ผู้ทำ", r.owner]);
  rows.push(["หัวหน้า", r.supervisor]);
  

  return `
    <table class="spec-table">
      ${rows.map(r=>`<tr><td class='spec-label'>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}
    </table>
  `;
}
function extractTime(r) {

  // ⭐ ดึงเวลาจาก column work_time — อันนี้ถูกต้องที่สุด
  if (r.work_time) return r.work_time;

  // ของเก่า เผื่อ spec.time เคยใช้งาน
  if (r?.spec?.time) return r.spec.time;

  // ถ้าไม่ได้บันทึกเวลา ดึงจากรูปภาพ
  if (Array.isArray(r.photos) && r.photos.length && r.photos[0].takenAt)
    return fmtDateTime(r.photos[0].takenAt);

  // fallback ดึงจาก created_at
  if (r.created_at) return fmtDateTime(r.created_at);

  return "-";
}
function fmtDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("th-TH");
  } catch (e) { 
    return d; 
  }
}

function fmtDateTime(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleString("th-TH");
  } catch (e) { 
    return d; 
  }
}



function deptClass(name){
  if (name==="Blending") return "dept-blending";
  if (name==="Packing") return "dept-packing";
  if (name==="Intake") return "dept-intake";
  return "";
}

async function load(filter=""){
  content.innerHTML = "กำลังโหลด...";

  // fetch
  let { data, error } = await sb
    .from("inspections")
    .select("*")
    .order("date", { ascending:false });

  if (error){ content.innerHTML="โหลดผิดพลาด"; return; }

  // filter keyword
  filter = filter.toLowerCase();
  data = data.filter(r => JSON.stringify(r).toLowerCase().includes(filter));

  // group by date
  const byDate = {};
  data.forEach(r=>{
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  content.innerHTML = "";

  Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).forEach(date=>{
    const dateBlock = document.createElement("div");
    dateBlock.className = "date-block";
    dateBlock.innerHTML = `<div class="date-title">วันที่: ${date}</div>`;

    // group by dept
    const byDept = {};
    byDate[date].forEach(r=>{
      if (!byDept[r.dept]) byDept[r.dept] = [];
      byDept[r.dept].push(r);
    });

    Object.keys(byDept).forEach(dept=>{
      const deptBox = document.createElement("div");
      deptBox.className = `dept-box ${deptClass(dept)}`;
      deptBox.innerHTML = `
        <div class="dept-header">▾ ${dept}</div>
        <div class="task-list"></div>
      `;

      const list = deptBox.querySelector(".task-list");

      // tasks
      byDept[dept].forEach(r=>{
        const card = document.createElement("div");
        card.className = "task-card";
        card.innerHTML = `
  <div class="task-head">
    <b>${r.spec?.type || r.spec?.line || r.spec?.mode}</b>
    <span class="task-time">${extractTime(r)}</span>
  </div>

  <div class="task-body">
    ${makeSpecTable(r)}
   <div class="photos">
  ${r.photos?.map(p=>`
    <img 
      loading="lazy"
      src="${p.url}?width=320" 
      data-full="${p.url}"
      style="background:#f0f0f0; min-height:120px; object-fit:cover; border-radius:6px;"
      onclick="window.open(this.dataset.full, '_blank')"
    >
  `).join("")}
</div>

`;


        // toggle
        card.onclick = () => {
          const body = card.querySelector(".task-body");
          body.style.display = body.style.display === "block" ? "none" : "block";
        };

        list.appendChild(card);
      });

      // toggle dept
      deptBox.onclick = (e)=>{
        if (e.target.classList.contains("dept-header")){
          list.style.display = list.style.display === "block" ? "none" : "block";
        }
      };

      dateBlock.appendChild(deptBox);
    });

    content.appendChild(dateBlock);
  });
}

load();
// ------------------------------------------------------
// EXPORT REPORT TO PDF
// ------------------------------------------------------
// ---------------------------------------------
// PDF SYSTEM (New Professional Layout)
// ---------------------------------------------
const pdfBtn = document.getElementById("btnExportPDF");

if (pdfBtn) {
  pdfBtn.addEventListener("click", async () => {
    try {
      const { jsPDF } = window.jspdf;

      const reportEl = document.getElementById("reportContainer");
      if (!reportEl) {
        alert("ไม่พบ reportContainer ใน HTML");
        return;
      }

      pdfBtn.disabled = true;
      pdfBtn.textContent = "กำลังสร้าง PDF...";

      // จับภาพทั้ง report
      const canvas = await html2canvas(reportEl, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let yPos = 25;

      // Header
      pdf.setFontSize(16);
      pdf.text("PCG – Cleanliness Inspection Report", pageWidth / 2, 12, { align: "center" });

      pdf.setLineWidth(0.2);
      pdf.line(10, 15, pageWidth - 10, 15);

      // Metadata
      const date = document.getElementById("reportDate")?.textContent || "-";
      const dept = document.getElementById("reportDept")?.textContent || "-";

      pdf.setFontSize(11);
      pdf.text(`Date: ${date}`, 10, 22);
      pdf.text(`Department: ${dept}`, 70, 22);

      // Add image (auto split pages)
      if (imgHeight < pageHeight - yPos - 10) {
        pdf.addImage(imgData, "JPEG", 10, yPos, imgWidth, imgHeight);
      } else {
        let hLeft = imgHeight;
        let position = yPos;

        while (hLeft > 0) {
          pdf.addImage(imgData, "JPEG", 10, position, imgWidth, imgHeight);

          hLeft -= (pageHeight - yPos);
          if (hLeft <= 0) break;

          pdf.addPage();
          position = 10;

          // Header for new page
          pdf.text("PCG – Cleanliness Inspection Report", pageWidth / 2, 12, { align: "center" });
          pdf.line(10, 15, pageWidth - 10, 15);

          pdf.setFontSize(11);
          pdf.text(`Date: ${date}`, 10, 22);
          pdf.text(`Department: ${dept}`, 70, 22);
        }
      }

      // footer
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.text(`Page ${i} / ${totalPages}`, pageWidth - 20, pageHeight - 10);
      }

      pdf.save(`InspectionReport_${date}_${dept}.pdf`);

    } catch (err) {
      console.error(err);
      alert("สร้าง PDF ไม่สำเร็จ: " + err.message);
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.textContent = "Export PDF";
    }
  });
}



