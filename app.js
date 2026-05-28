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
    notes: item.notes || "",
    fileName: item.fileName || "",
    fileMime: item.fileMime || "",
    fileData: item.fileData || "",
  };
}

function normalizeEvidenceStatus(status = "") {
  const trimmed = String(status || "").trim();
  if (!trimmed) return "未准备";
  const known = EVIDENCE_STATUSES.map((s) => s.value);
  if (known.includes(trimmed)) return trimmed;
  if (trimmed === "待打印并盖章") return "已打印";
  if (trimmed === "待整理" || trimmed === "待核对原件") return "需补充";
  return trimmed;
}

function evidenceStatusTone(status) {
  const known = EVIDENCE_STATUSES.find((s) => s.value === status);
  if (known) return known.tone;
  if (/打印|盖章/.test(status)) return "printed";
  if (/已准备|已完成/.test(status)) return "ready";
  if (/待|核对|补充|需/.test(status)) return "need";
  return "pending";
}

let editingEvidenceIndex = null;

function evidenceSummaryText(value, emptyLabel = "未填写") {
  const full = String(value ?? "").trim();
  return {
    full: full || emptyLabel,
    display: full || emptyLabel,
    isEmpty: !full,
  };
}

function renderEvidenceCell(summary, extraClass = "") {
  const cls = `evidence-cell-text ${extraClass}`.trim();
  return `<span class="${cls}" title="${escapeAttr(summary.full)}">${escapeText(summary.display)}</span>`;
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
      if (document.querySelector(`[data-readable-view="${key}"]`)) {
        refreshReadableView(key);
      }
      if (["defenseTemplate", "legalRepTemplate", "powerTemplate"].includes(key)) {
        updateTemplateRowStatuses();
        syncTemplatePrintBodies();
      }
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
  refreshAllReadableViews();
  syncTemplatePrintBodies();
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
    const nameSum = evidenceSummaryText(item.name);
    const sourceSum = evidenceSummaryText(item.source);
    const purposeSum = evidenceSummaryText(item.purpose);
    const status = item.status || "未准备";
    const tone = evidenceStatusTone(status);
    const pagesDisplay = item.pages?.trim() || "—";
    const noDisplay = item.no?.trim() || "—";
    const attachHint = item.fileName
      ? `<span class="evidence-attach-hint no-print" title="${escapeAttr(item.fileName)}">📎 有附件</span>`
      : "";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="col-no"><span class="evidence-cell-plain" title="${escapeAttr(noDisplay)}">${escapeText(noDisplay)}</span></td>
      <td class="col-name">
        <button type="button" class="evidence-cell-btn" data-view-evidence="${index}" aria-label="查看证据详情">
          ${renderEvidenceCell(nameSum)}
        </button>
      </td>
      <td class="col-source evidence-source-cell">
        <button type="button" class="evidence-cell-btn" data-view-evidence="${index}" aria-label="查看来源详情">
          ${renderEvidenceCell(sourceSum)}${attachHint}
        </button>
      </td>
      <td class="col-purpose evidence-purpose-cell">
        <button type="button" class="evidence-cell-btn" data-view-evidence="${index}" aria-label="查看证明目的">
          ${renderEvidenceCell(purposeSum, purposeSum.isEmpty ? "is-empty" : "")}
        </button>
      </td>
      <td class="col-pages"><span class="evidence-cell-plain" title="${escapeAttr(pagesDisplay)}">${escapeText(pagesDisplay)}</span></td>
      <td class="col-status">
        <span class="tag tag-${tone} evidence-status-tag" title="${escapeAttr(status)}">${escapeText(status)}</span>
      </td>
      <td class="operation-column evidence-actions no-print">
        <button type="button" class="ghost evidence-action-btn" data-view-evidence="${index}">查看</button>
        <button type="button" class="ghost evidence-action-btn" data-edit-evidence="${index}">编辑</button>
        <button type="button" class="delete-row evidence-action-btn" data-delete-evidence="${index}">删除</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function openEvidenceDetail(index) {
  const item = normalizeEvidence(state.evidence[index]);
  if (!item) return;

  const modal = document.querySelector("#evidenceDetailModal");
  const body = document.querySelector("#evidenceDetailBody");
  const title = document.querySelector("#evidenceDetailTitle");
  if (!modal || !body) return;

  if (title) title.textContent = item.no ? `证据详情 · ${item.no}` : "证据详情";

  const fields = [
    ["编号", item.no || "—"],
    ["证据名称", item.name || "—"],
    ["来源/原件", item.source || "—"],
    ["证明目的", item.purpose || "未填写"],
    ["页码", item.pages || "—"],
    ["状态", item.status || "未准备"],
    ["备注/材料说明", item.notes || "—"],
  ];

  body.innerHTML = fields
    .map(
      ([label, value]) => `
    <div class="evidence-detail-row">
      <div class="evidence-detail-label">${escapeText(label)}</div>
      <div class="evidence-detail-value">${escapeText(value)}</div>
    </div>`,
    )
    .join("");

  if (item.fileName) {
    const attach = document.createElement("div");
    attach.className = "evidence-detail-row";
    attach.innerHTML = `
      <div class="evidence-detail-label">附件</div>
      <div class="evidence-detail-value">
        <button type="button" class="file-chip" data-preview-evidence="${index}">${escapeText(item.fileName)}</button>
      </div>`;
    body.appendChild(attach);
  }

  const footer = document.createElement("div");
  footer.className = "evidence-detail-footer no-print";
  footer.innerHTML = `<button type="button" class="secondary" data-edit-evidence="${index}">编辑本条</button>`;
  body.appendChild(footer);

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeEvidenceDetailModal() {
  const modal = document.querySelector("#evidenceDetailModal");
  if (!modal) return;
  modal.hidden = true;
  if (document.querySelector("#evidenceEditModal")?.hidden !== false) {
    document.body.style.overflow = "";
  }
}

function openEvidenceEdit(index) {
  const item = normalizeEvidence(state.evidence[index]);
  if (!item) return;

  editingEvidenceIndex = index;
  const modal = document.querySelector("#evidenceEditModal");
  if (!modal) return;

  document.querySelector("#evidenceEditNo").value = item.no;
  document.querySelector("#evidenceEditName").value = item.name;
  document.querySelector("#evidenceEditSource").value = item.source;
  document.querySelector("#evidenceEditPurpose").value = item.purpose;
  document.querySelector("#evidenceEditPages").value = item.pages;
  document.querySelector("#evidenceEditStatus").value = item.status;
  document.querySelector("#evidenceEditNotes").value = item.notes;

  updateEvidenceEditAttachmentUI(item);
  closeEvidenceDetailModal();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeEvidenceEditModal() {
  const modal = document.querySelector("#evidenceEditModal");
  if (!modal) return;
  modal.hidden = true;
  editingEvidenceIndex = null;
  const fileInput = document.querySelector("#evidenceEditFile");
  if (fileInput) fileInput.value = "";
  if (document.querySelector("#evidenceDetailModal")?.hidden !== false) {
    document.body.style.overflow = "";
  }
}

function updateEvidenceEditAttachmentUI(item) {
  const info = document.querySelector("#evidenceEditAttachmentInfo");
  const removeBtn = document.querySelector("#evidenceEditRemoveFile");
  const previewBtn = document.querySelector("#evidenceEditPreviewFile");
  if (!info) return;

  if (item.fileName) {
    info.textContent = `已上传：${item.fileName}`;
    if (removeBtn) removeBtn.hidden = false;
    if (previewBtn) previewBtn.hidden = !item.fileData;
  } else {
    info.textContent = "暂无附件";
    if (removeBtn) removeBtn.hidden = true;
    if (previewBtn) previewBtn.hidden = true;
  }
}

function saveEvidenceFromEditForm(event) {
  event.preventDefault();
  if (editingEvidenceIndex === null) return;

  const current = normalizeEvidence(state.evidence[editingEvidenceIndex]);
  state.evidence[editingEvidenceIndex] = normalizeEvidence({
    ...current,
    no: document.querySelector("#evidenceEditNo").value,
    name: document.querySelector("#evidenceEditName").value,
    source: document.querySelector("#evidenceEditSource").value,
    purpose: document.querySelector("#evidenceEditPurpose").value,
    pages: document.querySelector("#evidenceEditPages").value,
    status: document.querySelector("#evidenceEditStatus").value,
    notes: document.querySelector("#evidenceEditNotes").value,
  });

  saveState();
  renderEvidence();
  closeEvidenceEditModal();
  toast("证据已保存。");
}

function bindEvidenceModals() {
  const form = document.querySelector("#evidenceEditForm");
  if (form) form.addEventListener("submit", saveEvidenceFromEditForm);

  const fileInput = document.querySelector("#evidenceEditFile");
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      if (editingEvidenceIndex === null) return;
      attachEvidenceFile(editingEvidenceIndex, fileInput.files?.[0], { silent: true });
      fileInput.value = "";
      updateEvidenceEditAttachmentUI(normalizeEvidence(state.evidence[editingEvidenceIndex]));
    });
  }

  const removeBtn = document.querySelector("#evidenceEditRemoveFile");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      if (editingEvidenceIndex === null) return;
      clearEvidenceFile(editingEvidenceIndex, { silent: true });
      updateEvidenceEditAttachmentUI(normalizeEvidence(state.evidence[editingEvidenceIndex]));
    });
  }

  const previewBtn = document.querySelector("#evidenceEditPreviewFile");
  if (previewBtn) {
    previewBtn.addEventListener("click", () => {
      if (editingEvidenceIndex === null) return;
      openEvidencePreview(editingEvidenceIndex);
    });
  }
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
  const completeness = computeCompleteness();
  const pending = countPendingMaterials();
  const risk = countRiskReminders();
  const printable = countPrintableDocuments();

  const setText = (id, text) => {
    const el = document.querySelector(id);
    if (el) el.textContent = text;
  };

  setText("#statCompleteness", `${completeness}%`);
  setText("#completenessAside", `${completeness}%`);
  setText("#statPending", String(pending));
  setText("#statRisk", String(risk));
  setText("#statPrintable", String(printable));

  const printableHint = document.querySelector("#statPrintableHint");
  if (printableHint) {
    printableHint.textContent = isPrintReady() ? "核心信息已具备，可打印" : "待补案号或文书内容";
  }

  updateTemplateRowStatuses();
}

function countPendingMaterials() {
  const allItems = MATERIAL_GROUPS.flatMap((g) => g.items);
  return allItems.filter((item) => {
    const status = state.checkStatuses[item.key] || (state.checks[item.key] ? "ready" : "pending");
    return status === "pending" || status === "need" || !state.checks[item.key];
  }).length;
}

function countRiskReminders() {
  let count = 0;
  if (!state.fields.shareholderNotes?.trim()) count += 1;
  const weakEvidence = state.evidence.filter(
    (e) => e.status === "未准备" || e.status === "需补充" || /待|核对/.test(e.status || ""),
  ).length;
  return count + weakEvidence;
}

function countPrintableDocuments() {
  const templateKeys = ["defenseTemplate", "legalRepTemplate", "powerTemplate"];
  let n = templateKeys.filter((key) => getTemplateFieldValue(key).trim().length > 80).length;
  if (isPrintReady()) n += 1;
  return n;
}

function getTemplateFieldValue(key) {
  const field = state.fields[key];
  if (field?.trim()) return field;
  return document.querySelector(`[data-field="${key}"]`)?.value || "";
}

function formatReadableHtml(text = "") {
  const raw = String(text).trim();
  if (!raw) return '<p class="readable-placeholder">暂无内容，点击「编辑」填写。</p>';
  return raw
    .split(/\n+/)
    .map((line) => {
      const safe = escapeText(line);
      if (/^[一二三四五六七八九十\d]+[、.．)]/.test(line.trim())) {
        return `<p><strong>${safe}</strong></p>`;
      }
      return `<p>${safe}</p>`;
    })
    .join("");
}

function refreshReadableView(key) {
  const view = document.querySelector(`[data-readable-view="${key}"]`);
  const textarea = document.querySelector(`[data-field="${key}"]`);
  if (!view || !textarea) return;
  view.innerHTML = formatReadableHtml(textarea.value);
}

function refreshAllReadableViews() {
  document.querySelectorAll("[data-readable]").forEach((wrapper) => {
    const key = wrapper.dataset.readable;
    if (key) refreshReadableView(key);
  });
}

function bindReadableFields() {
  document.querySelectorAll("[data-toggle-readable]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggleReadable;
      const wrapper = document.querySelector(`[data-readable="${key}"]`);
      const textarea = document.querySelector(`[data-field="${key}"]`);
      const view = document.querySelector(`[data-readable-view="${key}"]`);
      if (!wrapper || !textarea || !view) return;

      const editing = !wrapper.classList.contains("is-editing");
      wrapper.classList.toggle("is-editing", editing);
      textarea.classList.toggle("is-hidden", !editing);
      view.classList.toggle("is-hidden", editing);
      button.textContent = editing ? "完成" : "编辑";

      if (editing) {
        textarea.focus();
      } else {
        state.fields[key] = textarea.value;
        refreshReadableView(key);
        saveState();
      }
    });
  });
}

function getTemplateStatusMeta(key) {
  const value = getTemplateFieldValue(key);
  if (!value.trim()) return { label: "待补信息", tone: "need" };
  if (!state.fields.caseNo?.trim() && value.includes("案号")) {
    return { label: "待核对", tone: "need" };
  }
  if (value.trim().length < 60) return { label: "待补信息", tone: "need" };
  return { label: "可打印", tone: "ready" };
}

function updateTemplateRowStatuses() {
  ["defenseTemplate", "legalRepTemplate", "powerTemplate"].forEach((key) => {
    const badge = document.querySelector(`[data-template-status="${key}"]`);
    if (!badge) return;
    const meta = getTemplateStatusMeta(key);
    badge.textContent = meta.label;
    badge.className = `template-status tag tag-${meta.tone}`;
  });
}

function syncTemplatePrintBodies() {
  ["defenseTemplate", "legalRepTemplate", "powerTemplate"].forEach((key) => {
    const pre = document.querySelector(`[data-template-print="${key}"]`);
    if (pre) pre.textContent = getTemplateFieldValue(key);
  });
}

function bindTemplateRegistry() {
  document.querySelectorAll("[data-toggle-template-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggleTemplateEdit;
      const editor = document.querySelector(`[data-template-editor="${key}"]`);
      if (!editor) return;
      const collapsed = editor.classList.toggle("is-collapsed");
      button.textContent = collapsed ? "展开编辑" : "收起编辑";
    });
  });
}

function openTemplatePreview(fieldKey) {
  const modal = document.querySelector("#previewModal");
  const title = document.querySelector("#previewTitle");
  const body = document.querySelector("#previewBody");
  if (!modal || !title || !body) return;

  const names = {
    defenseTemplate: "民事答辩状（预览）",
    legalRepTemplate: "法定代表人身份证明书（预览）",
    powerTemplate: "授权委托书（预览）",
  };
  title.textContent = names[fieldKey] || "文书预览";
  body.innerHTML = `<pre class="template-preview-text">${escapeText(getTemplateFieldValue(fieldKey))}</pre>`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
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
    openEvidenceEdit(state.evidence.length - 1);
  });

  document.querySelector("#addTimeline").addEventListener("click", () => {
    state.timeline.push({ date: "", event: "", proof: "", issue: "" });
    saveState();
    renderTimeline();
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest(
      "[data-delete-evidence], [data-delete-timeline], [data-print-section], [data-preview-evidence], [data-view-evidence], [data-edit-evidence], [data-close-evidence-modal], [data-close-modal], [data-copy-template], [data-print-template], [data-preview-template]",
    );
    if (!target) return;

    const evidenceIndex = target.dataset.deleteEvidence;
    const viewEvidenceIndex = target.dataset.viewEvidence;
    const editEvidenceIndex = target.dataset.editEvidence;
    const timelineIndex = target.dataset.deleteTimeline;
    const printSection = target.dataset.printSection;
    const previewIndex = target.dataset.previewEvidence;
    const copyTemplate = target.dataset.copyTemplate;
    const printTemplate = target.dataset.printTemplate;
    const previewTemplate = target.dataset.previewTemplate;

    if (evidenceIndex !== undefined) {
      state.evidence.splice(Number(evidenceIndex), 1);
      saveState();
      renderEvidence();
    }

    if (viewEvidenceIndex !== undefined) {
      openEvidenceDetail(Number(viewEvidenceIndex));
    }

    if (editEvidenceIndex !== undefined) {
      openEvidenceEdit(Number(editEvidenceIndex));
    }

    if (target.dataset.closeEvidenceModal !== undefined) {
      closeEvidenceDetailModal();
      closeEvidenceEditModal();
    }

    if (timelineIndex !== undefined) {
      state.timeline.splice(Number(timelineIndex), 1);
      saveState();
      renderTimeline();
    }

    if (previewIndex !== undefined) {
      openEvidencePreview(Number(previewIndex));
    }

    if (target.dataset.closeModal !== undefined) {
      closePreviewModal();
    }

    if (copyTemplate) {
      copyTemplateText(copyTemplate);
    }

    if (previewTemplate) {
      openTemplatePreview(previewTemplate);
    }

    if (printTemplate) {
      syncTemplatePrintBodies();
      printSingleTemplate(printTemplate);
    }

    if (printSection) {
      printOnly(printSection);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closePreviewModal();
    closeEvidenceDetailModal();
    closeEvidenceEditModal();
  });

  const runPrintAll = () => {
    syncTemplatePrintBodies();
    document.body.classList.remove("printing-section", "printing-template");
    document.querySelectorAll(".print-focus").forEach((el) => el.classList.remove("print-focus"));
    window.print();
  };
  document.querySelector("#printAll").addEventListener("click", runPrintAll);
  const printAllAside = document.querySelector("#printAllAside");
  if (printAllAside) printAllAside.addEventListener("click", runPrintAll);
  const saveCloudAside = document.querySelector("#saveCloudAside");
  if (saveCloudAside) saveCloudAside.addEventListener("click", () => saveCloudState({ immediate: true }));

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
  syncTemplatePrintBodies();
  document.querySelectorAll(".template-card.print-focus, .template-print-bodies .print-focus").forEach((el) => {
    el.classList.remove("print-focus");
  });
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
    saveText.className = `header-save ${tone ? `is-${tone}` : ""}`.trim();
    if (tone === "ok") saveText.textContent = "自动保存：已同步";
    else if (tone === "warn") saveText.textContent = message.includes("加载") ? "自动保存：加载中" : "自动保存：待保存";
    else if (tone === "error") saveText.textContent = "自动保存：异常";
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
  syncTemplatePrintBodies();
  document.querySelectorAll(".readable-field").forEach((wrapper) => {
    wrapper.classList.add("is-printing");
  });
  document.querySelectorAll(".template-row-editor").forEach((el) => {
    el.classList.remove("is-collapsed");
  });
  document.querySelectorAll("textarea").forEach((el) => {
    el.dataset.oldHeight = el.style.height || "";
    el.style.height = `${el.scrollHeight + 8}px`;
  });
}

function restoreTextareasAfterPrint() {
  document.querySelectorAll(".readable-field").forEach((wrapper) => {
    wrapper.classList.remove("is-printing");
  });
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

function attachEvidenceFile(index, file, { silent = false } = {}) {
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
    if (!silent) toast("附件已添加，可在详情或编辑中预览。");
  };
  reader.onerror = () => toast("读取文件失败，请重试。");
  reader.readAsDataURL(file);
}

function clearEvidenceFile(index, { silent = false } = {}) {
  const item = normalizeEvidence(state.evidence[index] || {});
  item.fileName = "";
  item.fileMime = "";
  item.fileData = "";
  state.evidence[index] = item;
  saveState();
  renderEvidence();
  if (!silent) toast("附件已移除。");
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
  const steps = [...document.querySelectorAll(".side-nav-link, .mobile-tab")];
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
bindReadableFields();
bindTemplateRegistry();
hydratePage();
bindButtons();
bindEvidenceModals();
bindStepNav();
