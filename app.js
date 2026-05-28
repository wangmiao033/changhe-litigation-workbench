const API_ENDPOINT = "/api/case-data";
const SAVE_DELAY_MS = 900;
const MAX_ATTACHMENT_BYTES = 800 * 1024;
const MAX_BODY_BYTES = 1024 * 1024;

const MATERIAL_GROUPS = [
  {
    title: "A. 法院材料",
    items: [
      { key: "summons", label: "传票、应诉通知书、举证通知书、起诉状副本、原告证据副本。" },
      { key: "call-court", label: "电话联系法院，确认原告、案由、送达地址和后续邮寄材料。" },
      { key: "verify-company-name", label: "核对短信中的公司名称是否与营业执照完整名称一致。" },
      { key: "service-address-form", label: "填写《广州法院电子送达地址确认书》，并加盖公司公章。" },
      { key: "submit-service-address", label: "通过人民法院在线服务提交电子送达地址确认书。" },
    ],
  },
  {
    title: "B. 公司主体材料",
    items: [
      { key: "license", label: "营业执照复印件、统一社会信用代码信息、公司盖章页。" },
    ],
  },
  {
    title: "C. 出庭身份材料",
    items: [
      { key: "legal-rep", label: "法定代表人身份证明书、法定代表人身份证复印件。" },
      { key: "power", label: "如非法定代表人本人出庭：授权委托书、代理人身份证明、劳动/律师事务所证明等。" },
    ],
  },
  {
    title: "D. 证据材料",
    items: [
      { key: "defense", label: "民事答辩状：按原告诉讼请求逐项回应，准备法院及各方份数。" },
      { key: "evidence-list", label: "证据目录：证据编号、名称、来源、证明目的、页码一一对应。" },
      { key: "evidence-copy", label: "证据复印件/打印件：合同、聊天记录、邮件、转账、发票、后台记录、交付记录。" },
      { key: "originals", label: "证据原件或原始载体：合同原件、手机/电脑原始聊天记录、银行流水原件下载渠道。" },
      { key: "outline", label: "庭审提纲：事实争议、法律争议、对对方证据质证意见、调解底线。" },
    ],
  },
  {
    title: "E. 股东专项材料",
    items: [
      { key: "shareholder", label: "涉及股东责任时：公司财产独立、账户独立、出资、章程、纳税和账簿材料。" },
    ],
  },
];

const CHECK_STATUS_OPTIONS = [
  { value: "pending", label: "未准备" },
  { value: "ready", label: "已准备" },
  { value: "need", label: "需补充" },
];

const EVIDENCE_STATUSES = [
  { value: "未准备", tone: "pending" },
  { value: "已准备", tone: "ready" },
  { value: "需补充", tone: "need" },
  { value: "已打印", tone: "printed" },
];

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
  checkStatuses: {},
  evidence: [
    {
      no: "证据1",
      name: "营业执照及工商信息",
      source: "公司登记资料/国家企业信用信息公示系统",
      purpose: "证明被告主体身份、法定代表人及公司基本信息",
      pages: "",
      status: "需补充",
    },
    {
      no: "证据2",
      name: "合同、订单或服务协议",
      source: "原件/电子签约平台/邮件附件",
      purpose: "证明双方权利义务、履行范围、付款条件",
      pages: "",
      status: "未准备",
    },
    {
      no: "证据3",
      name: "付款、发票、对账记录",
      source: "银行流水/发票系统/对账单",
      purpose: "证明款项往来、实际履行、金额计算",
      pages: "",
      status: "未准备",
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
    checkStatuses: { ...base.checkStatuses, ...(saved.checkStatuses || {}) },
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
    status: normalizeEvidenceStatus(item.status),
    fileName: item.fileName || "",
    fileMime: item.fileMime || "",
    fileData: item.fileData || "",
  };
}

function normalizeEvidenceStatus(status = "") {
  const known = EVIDENCE_STATUSES.map((s) => s.value);
  if (known.includes(status)) return status;
  if (/打印|盖章/.test(status)) return "已打印";
  if (/待|整理|核对/.test(status)) return "需补充";
  return status.trim() || "未准备";
}

function evidenceStatusTone(status) {
  return EVIDENCE_STATUSES.find((s) => s.value === status)?.tone || "pending";
}

function saveState() {
  if (isHydrating) return;
  updateDashboardStats();
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
  renderChecklist();
  renderEvidence();
  renderTimeline();
  isHydrating = false;
  updateDashboardStats();
}

function renderChecklist() {
  const root = document.querySelector("#checklistRoot");
  if (!root) return;
  root.innerHTML = MATERIAL_GROUPS.map(
    (group) => `
    <section class="checklist-group">
      <h3 class="checklist-group-title">${escapeText(group.title)}</h3>
      <div class="checklist-items">
        ${group.items
          .map((item) => {
            const checked = Boolean(state.checks[item.key]);
            const status = state.checkStatuses[item.key] || (checked ? "ready" : "pending");
            return `
          <div class="material-item">
            <input type="checkbox" data-check="${escapeAttr(item.key)}" ${checked ? "checked" : ""} aria-label="勾选材料" />
            <span class="material-item-text">${escapeText(item.label)}</span>
            <select class="material-status-select" data-check-status="${escapeAttr(item.key)}" aria-label="准备状态">
              ${CHECK_STATUS_OPTIONS.map(
                (opt) =>
                  `<option value="${opt.value}" ${status === opt.value ? "selected" : ""}>${opt.label}</option>`,
              ).join("")}
            </select>
          </div>`;
          })
          .join("")}
      </div>
    </section>`,
  ).join("");

  root.querySelectorAll("[data-check]").forEach((el) => {
    el.addEventListener("change", () => {
      const key = el.dataset.check;
      state.checks[key] = el.checked;
      if (el.checked && (!state.checkStatuses[key] || state.checkStatuses[key] === "pending")) {
        state.checkStatuses[key] = "ready";
        const select = root.querySelector(`[data-check-status="${key}"]`);
        if (select) select.value = "ready";
      }
      saveState();
    });
  });

  root.querySelectorAll("[data-check-status]").forEach((el) => {
    el.addEventListener("change", () => {
      const key = el.dataset.checkStatus;
      state.checkStatuses[key] = el.value;
      if (el.value === "ready") {
        state.checks[key] = true;
        const checkbox = root.querySelector(`[data-check="${key}"]`);
        if (checkbox) checkbox.checked = true;
      }
      saveState();
    });
  });
}

function renderEvidence() {
  const tbody = document.querySelector("#evidenceBody");
  const empty = document.querySelector("#evidenceEmpty");
  const tableWrap = document.querySelector("#evidenceTableWrap");
  if (!tbody) return;

  const isEmpty = state.evidence.length === 0;
  if (empty) {
    empty.hidden = !isEmpty;
    empty.innerHTML =
      "<strong>暂无证据</strong>请点击「新增证据」，建议按合同、聊天记录、转账、发票、交付记录等顺序整理。";
  }
  if (tableWrap) tableWrap.hidden = isEmpty;

  tbody.innerHTML = "";
  state.evidence.forEach((item, index) => {
    state.evidence[index] = normalizeEvidence(item);
    const status = item.status;
    const tone = evidenceStatusTone(status);
    const attachmentHtml = item.fileName
      ? `<button type="button" class="file-chip" data-preview-evidence="${index}" title="点击预览">
          <span>📎</span><span>${escapeText(item.fileName)}</span>
        </button>
        <button type="button" class="ghost icon-btn" data-remove-file="${index}" title="移除附件">移除</button>`
      : "";
    const statusOptions = EVIDENCE_STATUSES.map(
      (opt) =>
        `<option value="${escapeAttr(opt.value)}" ${status === opt.value ? "selected" : ""}>${escapeText(opt.value)}</option>`,
    ).join("");

    const row = document.createElement("tr");
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
      <td class="status-cell status-cell--${tone}">
        <span class="tag tag-${tone} no-print">${escapeText(status)}</span>
        <select class="status-select" aria-label="证据状态" data-key="status">${statusOptions}</select>
      </td>
      <td class="no-print"><button type="button" class="delete-row" data-delete-evidence="${index}">删除</button></td>
    `;
    row.querySelectorAll("[data-key]").forEach((input) => {
      const handler = () => {
        state.evidence[index][input.dataset.key] = input.value;
        if (input.dataset.key === "status") {
          const cell = row.querySelector(".status-cell");
          const tag = row.querySelector(".tag");
          const newTone = evidenceStatusTone(input.value);
          if (cell) cell.className = `status-cell status-cell--${newTone}`;
          if (tag) {
            tag.className = `tag tag-${newTone} no-print`;
            tag.textContent = input.value;
          }
        }
        saveState();
      };
      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
    });
    tbody.appendChild(row);
  });
}

function getSortedTimelineEntries() {
  return state.timeline
    .map((item, index) => ({ item, index }))
    .sort((a, b) => parseTimelineDate(a.item.date) - parseTimelineDate(b.item.date));
}

function parseTimelineDate(value = "") {
  if (!String(value).trim()) return Number.POSITIVE_INFINITY;
  const normalized = String(value).trim().replace(/\./g, "-");
  const time = Date.parse(normalized);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function renderTimeline() {
  const list = document.querySelector("#timelineList");
  const empty = document.querySelector("#timelineEmpty");
  if (!list) return;

  const isEmpty = state.timeline.length === 0;
  if (empty) {
    empty.hidden = !isEmpty;
    empty.innerHTML =
      "<strong>暂无时间线事件</strong>请点击「新增事件」，按日期梳理合同签署、履行、付款、沟通与争议发生节点。";
  }

  list.innerHTML = "";
  getSortedTimelineEntries().forEach(({ item, index }) => {
    const block = document.createElement("article");
    block.className = "timeline-item";
    block.innerHTML = `
      <div class="timeline-date-wrap">
        <label>日期<input aria-label="日期" data-key="date" value="${escapeAttr(item.date)}" placeholder="如：2025-03-01" /></label>
      </div>
      <div class="timeline-body">
        <label>事件<textarea aria-label="事件" data-key="event" rows="2">${escapeText(item.event)}</textarea></label>
        <label>对应证据<textarea aria-label="对应证据" data-key="proof" rows="2">${escapeText(item.proof)}</textarea></label>
        <label>争议点<textarea aria-label="争议点" data-key="issue" rows="2">${escapeText(item.issue)}</textarea></label>
      </div>
      <div class="timeline-actions no-print">
        <button type="button" class="delete-row" data-delete-timeline="${index}">删除</button>
      </div>
    `;
    block.querySelectorAll("[data-key]").forEach((input) => {
      input.addEventListener("input", () => {
        state.timeline[index][input.dataset.key] = input.value;
        saveState();
      });
    });
    list.appendChild(block);
  });
}

function updateDashboardStats() {
  const completenessEl = document.querySelector("#completenessText");
  const printReadyEl = document.querySelector("#printReadyText");
  if (completenessEl) completenessEl.textContent = `${computeCompleteness()}%`;
  if (printReadyEl) {
    const ready = isPrintReady();
    printReadyEl.textContent = ready ? "可打印" : "待完善";
    printReadyEl.className = `status-value ${ready ? "is-ok" : "is-warn"}`.trim();
  }
}

function computeCompleteness() {
  const fieldKeys = ["caseNo", "court", "cause", "hearingAt", "plaintiff"];
  const fieldScore =
    (fieldKeys.filter((k) => state.fields[k]?.trim()).length / fieldKeys.length) * 35;

  const allItems = MATERIAL_GROUPS.flatMap((g) => g.items);
  const checkScore =
    allItems.length === 0
      ? 0
      : (allItems.filter((i) => state.checks[i.key]).length / allItems.length) * 30;

  const evidenceScore =
    state.evidence.length === 0
      ? 0
      : (state.evidence.filter((e) => e.name?.trim()).length / state.evidence.length) * 20;

  const timelineScore =
    state.timeline.length === 0
      ? 0
      : (state.timeline.filter((t) => t.event?.trim()).length / state.timeline.length) * 15;

  return Math.min(100, Math.round(fieldScore + checkScore + evidenceScore + timelineScore));
}

function isPrintReady() {
  return Boolean(
    state.fields.caseNo?.trim() &&
      state.fields.court?.trim() &&
      state.evidence.some((e) => e.name?.trim()),
  );
}

function bindButtons() {
  document.querySelector("#loadCloud").addEventListener("click", loadCloudState);
  document.querySelector("#saveCloud").addEventListener("click", () => saveCloudState({ immediate: true }));

  document.querySelector("#addEvidence").addEventListener("click", () => {
    state.evidence.push(
      normalizeEvidence({
        no: `证据${state.evidence.length + 1}`,
        status: "未准备",
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
    const target = event.target.closest(
      "[data-delete-evidence], [data-delete-timeline], [data-print-section], [data-preview-evidence], [data-remove-file], [data-close-modal], [data-copy-template], [data-print-template]",
    );
    if (!target) return;

    const evidenceIndex = target.dataset.deleteEvidence;
    const timelineIndex = target.dataset.deleteTimeline;
    const printSection = target.dataset.printSection;
    const previewIndex = target.dataset.previewEvidence;
    const removeFileIndex = target.dataset.removeFile;
    const copyTemplate = target.dataset.copyTemplate;
    const printTemplate = target.dataset.printTemplate;

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

    if (copyTemplate) {
      copyTemplateText(copyTemplate);
    }

    if (printTemplate) {
      printSingleTemplate(printTemplate);
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
    document.body.classList.remove("printing-section", "printing-template");
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
  document.body.classList.remove("printing-template");
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

function printSingleTemplate(fieldKey) {
  document.querySelectorAll(".template-card.print-focus").forEach((el) => el.classList.remove("print-focus"));
  document.body.classList.remove("printing-section");
  const card = document.querySelector(`[data-template-card="${fieldKey}"]`);
  if (!card) return;
  card.classList.add("print-focus");
  document.body.classList.add("printing-template");
  window.print();
  setTimeout(() => {
    document.body.classList.remove("printing-template");
    card.classList.remove("print-focus");
  }, 500);
}

async function copyTemplateText(fieldKey) {
  const text = state.fields[fieldKey] || "";
  try {
    await navigator.clipboard.writeText(text);
    toast("模板文本已复制。");
  } catch {
    toast("复制失败，请手动选择文本复制。");
  }
}

function scheduleCloudSave() {
  clearTimeout(saveTimer);
  updateCloudStatus("有修改，准备保存…", "warn");
  saveTimer = setTimeout(() => saveCloudState(), SAVE_DELAY_MS);
}

async function loadCloudState() {
  updateCloudStatus("正在加载资料…", "warn");
  try {
    const result = await requestCloud("GET");
    if (!result.data) {
      state = cloneDefaults();
      hydratePage();
      updateCloudStatus("暂无云端资料", "warn");
      return;
    }

    state = mergeState(defaults, result.data.data || result.data);
    hydratePage();
    updateCloudStatus(`已加载${formatSavedAt(result.updatedAt || result.data.savedAt)}`, "ok");
  } catch (error) {
    updateCloudStatus(error.message, "error");
    toast(error.message);
  }
}

async function saveCloudState({ immediate = false } = {}) {
  if (immediate) clearTimeout(saveTimer);

  const payloadSize = JSON.stringify(state).length;
  if (payloadSize > MAX_BODY_BYTES) {
    const message = `资料体积过大（约 ${formatFileSize(payloadSize)}），请减少附件数量或体积后再保存。`;
    updateCloudStatus(message, "error");
    toast(message);
    return;
  }

  updateCloudStatus("正在保存…", "warn");
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
    headers: { "content-type": "application/json" },
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
  const saveText = document.querySelector("#saveStatusText");
  if (saveText) {
    saveText.className = `status-value ${tone ? `is-${tone}` : ""}`.trim();
    if (tone === "ok") saveText.textContent = "已保存";
    else if (tone === "warn") saveText.textContent = message.includes("加载") ? "加载中" : "待保存";
    else if (tone === "error") saveText.textContent = "保存异常";
    else saveText.textContent = message;
  }

  const node = document.querySelector("#cloudStatus");
  if (node) {
    node.textContent = message;
    node.className = `cloud-status ${tone}`.trim();
  }

  updateDashboardStats();
}

function formatSavedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return ` ${date.toLocaleString("zh-CN")}`;
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
    if (!item.source.trim()) item.source = file.name;
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

function bindStepNav() {
  const steps = [...document.querySelectorAll(".step-nav a")];
  const sections = steps
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const setActiveByHash = () => {
    const hash = window.location.hash || "#case-info";
    steps.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === hash);
    });
  };

  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = visible.target.id;
        steps.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
        });
      },
      { rootMargin: "-12% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] },
    );
    sections.forEach((section) => observer.observe(section));
  }

  window.addEventListener("hashchange", setActiveByHash);
  setActiveByHash();
}

bindFields();
hydratePage();
bindButtons();
bindStepNav();
