const API_ENDPOINT = "/api/case-data";
const SAVE_DELAY_MS = 900;
const MAX_ATTACHMENT_BYTES = 800 * 1024;
const MAX_BODY_BYTES = 1024 * 1024;

const defaults = {
  fields: {
    caseNo: "",
    court: "",
    cause: "",
    hearingAt: "",
    plaintiff: "",
    judge: "",
    legalRep: "",
    attendee: "",
    defenseDeadline: "",
    evidenceDeadline: "",
    serviceCaseNo: "（2026）粤0105民初14059号",
    serviceCourt: "广州市海珠区人民法院",
    serviceCompanyName: "海南畅核科技有限公司（短信写法，需核对是否为海南畅核网络科技有限公司）",
    serviceReceivedAt: "2026-05-28 收到法院短信通知",
    serviceMatter: "提交《广州法院电子送达地址确认书》并加盖公章",
    serviceContacts: "杨佩霞、任婉新",
    servicePhone: "020-83005435",
    serviceAddress: "广州市海珠区逸景路333号民四庭",
    serviceOfficialEntry: "https://zxfw.court.gov.cn/",
    servicePrivateLink: "",
    serviceNotes:
      "短信要求：按照法院电子送达的《广州法院电子送达地址确认书》填写并加盖公章，及时通过人民法院在线服务提交。法院将按确认地址邮寄本案诉讼材料。\n\n待核对：短信中的公司名称为“海南畅核科技有限公司”，需向法院确认是否指“海南畅核网络科技有限公司”。",
    claimsBreakdown: "",
    defensePoints: "",
    crossExamination: "",
    hearingScript: "",
    shareholderNotes: "",
  },
  checks: {},
  evidence: [
    {
      no: "证据1",
      name: "营业执照及工商信息",
      source: "公司登记资料/国家企业信用信息公示系统",
      purpose: "证明被告主体身份、法定代表人及公司基本信息",
      pages: "",
      status: "待打印并盖章",
    },
    {
      no: "证据2",
      name: "合同、订单或服务协议",
      source: "原件/电子签约平台/邮件附件",
      purpose: "证明双方权利义务、履行范围、付款条件",
      pages: "",
      status: "待核对原件",
    },
    {
      no: "证据3",
      name: "付款、发票、对账记录",
      source: "银行流水/发票系统/对账单",
      purpose: "证明款项往来、实际履行、金额计算",
      pages: "",
      status: "待整理",
    },
  ],
  timeline: [
    {
      date: "",
      event: "双方建立业务关系/签署合同",
      proof: "证据2",
      issue: "合同关系和履行范围",
    },
    {
      date: "",
      event: "我方履行服务或交付成果",
      proof: "后台记录、聊天记录、交付记录",
      issue: "是否违约、是否完成交付",
    },
  ],
};

let state = cloneDefaults();
let saveTimer = null;
let isHydrating = false;

function mergeState(base, saved) {
  const evidence = Array.isArray(saved.evidence)
    ? saved.evidence.map(normalizeEvidence)
    : base.evidence.map(normalizeEvidence);
  return {
    fields: { ...base.fields, ...(saved.fields || {}) },
    checks: { ...base.checks, ...(saved.checks || {}) },
    evidence,
    timeline: Array.isArray(saved.timeline) ? saved.timeline : base.timeline,
  };
}

function normalizeEvidence(item = {}) {
  return {
    no: item.no || "",
    name: item.name || "",
    source: item.source || "",
    purpose: item.purpose || "",
    pages: item.pages || "",
    status: item.status || "",
    fileName: item.fileName || "",
    fileMime: item.fileMime || "",
    fileData: item.fileData || "",
  };
}

function saveState() {
  if (isHydrating) return;
  scheduleCloudSave();
}

function bindFields() {
  document.querySelectorAll("[data-field]").forEach((el) => {
    const key = el.dataset.field;
    if (!Object.prototype.hasOwnProperty.call(state.fields, key)) {
      state.fields[key] = el.value;
    }
    el.value = state.fields[key] || "";
    el.addEventListener("input", () => {
      state.fields[key] = el.value;
      saveState();
    });
  });
}

function bindChecks() {
  document.querySelectorAll("[data-check]").forEach((el) => {
    const key = el.dataset.check;
    el.checked = Boolean(state.checks[key]);
    el.addEventListener("change", () => {
      state.checks[key] = el.checked;
      saveState();
    });
  });
}

function hydratePage() {
  isHydrating = true;
  document.querySelectorAll("[data-field]").forEach((el) => {
    const key = el.dataset.field;
    if (!Object.prototype.hasOwnProperty.call(state.fields, key)) {
      state.fields[key] = el.value;
    } else {
      el.value = state.fields[key] || "";
    }
  });
  document.querySelectorAll("[data-check]").forEach((el) => {
    el.checked = Boolean(state.checks[el.dataset.check]);
  });
  renderEvidence();
  renderTimeline();
  isHydrating = false;
}

function renderEvidence() {
  const tbody = document.querySelector("#evidenceBody");
  tbody.innerHTML = "";
  state.evidence.forEach((item, index) => {
    state.evidence[index] = normalizeEvidence(item);
    const row = document.createElement("tr");
    const attachmentHtml = item.fileName
      ? `<button type="button" class="file-chip" data-preview-evidence="${index}" title="点击预览">
          <span>📎</span><span>${escapeText(item.fileName)}</span>
        </button>
        <button type="button" class="icon-btn secondary" data-remove-file="${index}" title="移除附件">移除</button>`
      : "";
    row.innerHTML = `
      <td><input aria-label="证据编号" data-key="no" value="${escapeAttr(item.no)}" /></td>
      <td><textarea aria-label="证据名称" data-key="name">${escapeText(item.name)}</textarea></td>
      <td class="source-cell">
        <textarea aria-label="来源或原件" data-key="source">${escapeText(item.source)}</textarea>
        <div class="attachment-row no-print">
          ${attachmentHtml}
          <label class="upload-link">
            ${item.fileName ? "更换文件" : "上传附件"}
            <input type="file" accept="image/*,.pdf,application/pdf" data-upload-evidence="${index}" />
          </label>
        </div>
      </td>
      <td><textarea aria-label="证明目的" data-key="purpose">${escapeText(item.purpose)}</textarea></td>
      <td><input aria-label="页码" data-key="pages" value="${escapeAttr(item.pages)}" /></td>
      <td><input aria-label="状态" data-key="status" value="${escapeAttr(item.status)}" /></td>
      <td class="no-print"><button type="button" class="delete-row" data-delete-evidence="${index}">删除</button></td>
    `;
    row.querySelectorAll("[data-key]").forEach((input) => {
      input.addEventListener("input", () => {
        state.evidence[index][input.dataset.key] = input.value;
        saveState();
      });
    });
    tbody.appendChild(row);
  });
}

function renderTimeline() {
  const tbody = document.querySelector("#timelineBody");
  tbody.innerHTML = "";
  state.timeline.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input aria-label="日期" data-key="date" value="${escapeAttr(item.date)}" /></td>
      <td><textarea aria-label="事件" data-key="event">${escapeText(item.event)}</textarea></td>
      <td><textarea aria-label="对应证据" data-key="proof">${escapeText(item.proof)}</textarea></td>
      <td><textarea aria-label="争议点" data-key="issue">${escapeText(item.issue)}</textarea></td>
      <td class="no-print"><button type="button" class="delete-row" data-delete-timeline="${index}">删除</button></td>
    `;
    row.querySelectorAll("[data-key]").forEach((input) => {
      input.addEventListener("input", () => {
        state.timeline[index][input.dataset.key] = input.value;
        saveState();
      });
    });
    tbody.appendChild(row);
  });
}

function bindButtons() {
  document.querySelector("#loadCloud").addEventListener("click", loadCloudState);
  document.querySelector("#saveCloud").addEventListener("click", () => saveCloudState({ immediate: true }));

  document.querySelector("#addEvidence").addEventListener("click", () => {
    state.evidence.push(
      normalizeEvidence({
        no: `证据${state.evidence.length + 1}`,
        status: "待整理",
      }),
    );
    saveState();
    renderEvidence();
  });

  document.querySelector("#addTimeline").addEventListener("click", () => {
    state.timeline.push({ date: "", event: "", proof: "", issue: "" });
    saveState();
    renderTimeline();
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-delete-evidence], [data-delete-timeline], [data-print-section], [data-preview-evidence], [data-remove-file], [data-close-modal]");
    if (!target) return;

    const evidenceIndex = target.dataset.deleteEvidence;
    const timelineIndex = target.dataset.deleteTimeline;
    const printSection = target.dataset.printSection;
    const previewIndex = target.dataset.previewEvidence;
    const removeFileIndex = target.dataset.removeFile;

    if (evidenceIndex !== undefined) {
      state.evidence.splice(Number(evidenceIndex), 1);
      saveState();
      renderEvidence();
    }

    if (timelineIndex !== undefined) {
      state.timeline.splice(Number(timelineIndex), 1);
      saveState();
      renderTimeline();
    }

    if (previewIndex !== undefined) {
      openEvidencePreview(Number(previewIndex));
    }

    if (removeFileIndex !== undefined) {
      clearEvidenceFile(Number(removeFileIndex));
    }

    if (target.dataset.closeModal !== undefined) {
      closePreviewModal();
    }

    if (printSection) {
      printOnly(printSection);
    }
  });

  document.addEventListener("change", (event) => {
    const uploadIndex = event.target.dataset?.uploadEvidence;
    if (uploadIndex === undefined) return;
    attachEvidenceFile(Number(uploadIndex), event.target.files?.[0]);
    event.target.value = "";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePreviewModal();
  });

  document.querySelector("#printAll").addEventListener("click", () => {
    document.body.classList.remove("printing-section");
    document.querySelectorAll(".print-focus").forEach((el) => el.classList.remove("print-focus"));
    window.print();
  });

  document.querySelector("#exportData").addEventListener("click", exportData);
  document.querySelector("#importData").addEventListener("change", importData);
  window.addEventListener("beforeprint", expandTextareasForPrint);
  window.addEventListener("afterprint", restoreTextareasAfterPrint);

  loadCloudState();
}

function printOnly(sectionId) {
  document.querySelectorAll(".print-focus").forEach((el) => el.classList.remove("print-focus"));
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.classList.add("print-focus");
  document.body.classList.add("printing-section");
  window.print();
  setTimeout(() => {
    document.body.classList.remove("printing-section");
    section.classList.remove("print-focus");
  }, 500);
}

function scheduleCloudSave() {
  clearTimeout(saveTimer);
  updateCloudStatus("有修改，准备保存...", "warn");
  saveTimer = setTimeout(() => saveCloudState(), SAVE_DELAY_MS);
}

async function loadCloudState() {
  updateCloudStatus("正在加载资料...", "warn");
  try {
    const result = await requestCloud("GET");
    if (!result.data) {
      state = cloneDefaults();
      hydratePage();
      updateCloudStatus("暂无资料，当前是空白模板", "warn");
      return;
    }

    state = mergeState(defaults, result.data.data || result.data);
    hydratePage();
    updateCloudStatus(`资料已加载${formatSavedAt(result.updatedAt || result.data.savedAt)}`, "ok");
  } catch (error) {
    updateCloudStatus(error.message, "error");
    toast(error.message);
  }
}

async function saveCloudState({ immediate = false } = {}) {
  if (immediate) {
    clearTimeout(saveTimer);
  }

  const payloadSize = JSON.stringify(state).length;
  if (payloadSize > MAX_BODY_BYTES) {
    const message = `资料体积过大（约 ${formatFileSize(payloadSize)}），请减少附件数量或体积后再保存。`;
    updateCloudStatus(message, "error");
    toast(message);
    return;
  }

  updateCloudStatus("正在保存...", "warn");
  try {
    const result = await requestCloud("PUT", { data: state });
    updateCloudStatus(`已保存${formatSavedAt(result.updatedAt)}`, "ok");
  } catch (error) {
    updateCloudStatus(error.message, "error");
    toast(error.message);
  }
}

async function requestCloud(method, body) {
  const response = await fetch(API_ENDPOINT, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok) {
    throw new Error(result.message || "云端请求失败。");
  }

  return result;
}

function updateCloudStatus(message, tone = "") {
  const node = document.querySelector("#cloudStatus");
  if (!node) return;
  node.className = `cloud-status ${tone}`.trim();
  node.textContent = message;
}

function formatSavedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `：${date.toLocaleString("zh-CN")}`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `海南畅核开庭资料-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("已导出备份文件。");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      state = mergeState(defaults, imported.data || imported);
      hydratePage();
      saveCloudState({ immediate: true });
      toast("已导入备份，并尝试保存到云端。");
    } catch {
      toast("导入失败：文件不是有效的 JSON 备份。");
    }
  };
  reader.readAsText(file);
}

function expandTextareasForPrint() {
  document.querySelectorAll("textarea").forEach((el) => {
    el.dataset.oldHeight = el.style.height || "";
    el.style.height = `${el.scrollHeight + 8}px`;
  });
}

function restoreTextareasAfterPrint() {
  document.querySelectorAll("textarea").forEach((el) => {
    el.style.height = el.dataset.oldHeight || "";
    delete el.dataset.oldHeight;
  });
}

function toast(message) {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

function escapeText(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value = "") {
  return escapeText(value).replaceAll('"', "&quot;");
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(defaults));
}

function attachEvidenceFile(index, file) {
  if (!file) return;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    toast(`文件过大（${formatFileSize(file.size)}），请控制在 ${formatFileSize(MAX_ATTACHMENT_BYTES)} 以内。`);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const item = normalizeEvidence(state.evidence[index] || {});
    item.fileName = file.name;
    item.fileMime = file.type || guessMimeFromName(file.name);
    item.fileData = String(reader.result || "");
    if (!item.source.trim()) {
      item.source = file.name;
    }
    state.evidence[index] = item;
    saveState();
    renderEvidence();
    toast("附件已添加，点击文件名可预览。");
  };
  reader.onerror = () => toast("读取文件失败，请重试。");
  reader.readAsDataURL(file);
}

function clearEvidenceFile(index) {
  const item = normalizeEvidence(state.evidence[index] || {});
  item.fileName = "";
  item.fileMime = "";
  item.fileData = "";
  state.evidence[index] = item;
  saveState();
  renderEvidence();
}

function openEvidencePreview(index) {
  const item = normalizeEvidence(state.evidence[index]);
  if (!item.fileData) {
    toast("该条证据尚未上传附件。");
    return;
  }

  const modal = document.querySelector("#previewModal");
  const title = document.querySelector("#previewTitle");
  const body = document.querySelector("#previewBody");
  if (!modal || !title || !body) return;

  title.textContent = item.fileName || item.name || item.no || "证据预览";
  body.innerHTML = "";

  const mime = item.fileMime || guessMimeFromName(item.fileName);
  if (mime.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = item.fileData;
    img.alt = item.fileName || "证据图片";
    body.appendChild(img);
  } else if (mime === "application/pdf" || item.fileName.toLowerCase().endsWith(".pdf")) {
    const iframe = document.createElement("iframe");
    iframe.title = item.fileName || "PDF 预览";
    iframe.src = item.fileData;
    body.appendChild(iframe);
  } else {
    const p = document.createElement("p");
    p.className = "modal-fallback";
    p.textContent = "该格式暂不支持在线预览，请下载备份后本地打开。";
    body.appendChild(p);
    const link = document.createElement("a");
    link.href = item.fileData;
    link.download = item.fileName || "证据附件";
    link.textContent = "下载附件";
    link.style.marginTop = "12px";
    link.style.display = "inline-block";
    body.appendChild(link);
  }

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closePreviewModal() {
  const modal = document.querySelector("#previewModal");
  const body = document.querySelector("#previewBody");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  if (body) body.innerHTML = "";
}

function guessMimeFromName(name = "") {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function bindSidebarNav() {
  const links = [...document.querySelectorAll(".sidebar a")];
  const setActive = () => {
    const hash = window.location.hash || "#case-info";
    links.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === hash);
    });
  };
  links.forEach((link) => {
    link.addEventListener("click", () => {
      setTimeout(setActive, 0);
    });
  });
  window.addEventListener("hashchange", setActive);
  setActive();
}

bindFields();
bindChecks();
renderEvidence();
renderTimeline();
bindButtons();
bindSidebarNav();
