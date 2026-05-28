const API_ENDPOINT = "/api/case-data";
const PASSWORD_KEY = "changhe-case-password";
const SAVE_DELAY_MS = 900;

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
let cloudPassword = readSessionPassword();

function readSessionPassword() {
  try {
    return sessionStorage.getItem(PASSWORD_KEY) || "";
  } catch {
    return "";
  }
}

function mergeState(base, saved) {
  return {
    fields: { ...base.fields, ...(saved.fields || {}) },
    checks: { ...base.checks, ...(saved.checks || {}) },
    evidence: Array.isArray(saved.evidence) ? saved.evidence : base.evidence,
    timeline: Array.isArray(saved.timeline) ? saved.timeline : base.timeline,
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
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input aria-label="证据编号" data-key="no" value="${escapeAttr(item.no)}" /></td>
      <td><textarea aria-label="证据名称" data-key="name">${escapeText(item.name)}</textarea></td>
      <td><textarea aria-label="来源或原件" data-key="source">${escapeText(item.source)}</textarea></td>
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
  const passwordInput = document.querySelector("#cloudPassword");
  passwordInput.value = cloudPassword;
  updateCloudStatus(cloudPassword ? "已输入密码，可读取云端资料" : "输入保存密码后连接云端", cloudPassword ? "warn" : "");

  document.querySelector("#unlockCloud").addEventListener("click", () => {
    cloudPassword = passwordInput.value.trim();
    storeSessionPassword(cloudPassword);
    if (!cloudPassword) {
      updateCloudStatus("请输入网站保存密码", "error");
      return;
    }
    loadCloudState();
  });

  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      document.querySelector("#unlockCloud").click();
    }
  });

  document.querySelector("#loadCloud").addEventListener("click", loadCloudState);
  document.querySelector("#saveCloud").addEventListener("click", () => saveCloudState({ immediate: true }));

  document.querySelector("#addEvidence").addEventListener("click", () => {
    state.evidence.push({
      no: `证据${state.evidence.length + 1}`,
      name: "",
      source: "",
      purpose: "",
      pages: "",
      status: "待整理",
    });
    saveState();
    renderEvidence();
  });

  document.querySelector("#addTimeline").addEventListener("click", () => {
    state.timeline.push({ date: "", event: "", proof: "", issue: "" });
    saveState();
    renderTimeline();
  });

  document.addEventListener("click", (event) => {
    const evidenceIndex = event.target.dataset.deleteEvidence;
    const timelineIndex = event.target.dataset.deleteTimeline;
    const printSection = event.target.dataset.printSection;

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

    if (printSection) {
      printOnly(printSection);
    }
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

  if (cloudPassword) {
    loadCloudState();
  }
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
  if (!cloudPassword) {
    updateCloudStatus("未连接云端：输入保存密码后才会保存", "warn");
    return;
  }

  clearTimeout(saveTimer);
  updateCloudStatus("有修改，准备保存到云端...", "warn");
  saveTimer = setTimeout(() => saveCloudState(), SAVE_DELAY_MS);
}

async function loadCloudState() {
  if (!cloudPassword) {
    updateCloudStatus("请输入网站保存密码后再读取云端", "error");
    return;
  }

  updateCloudStatus("正在读取云端资料...", "warn");
  try {
    const result = await requestCloud("GET");
    if (!result.data) {
      state = cloneDefaults();
      hydratePage();
      updateCloudStatus("云端暂无资料，当前是空白模板", "warn");
      return;
    }

    state = mergeState(defaults, result.data.data || result.data);
    hydratePage();
    updateCloudStatus(`已读取云端资料${formatSavedAt(result.updatedAt || result.data.savedAt)}`, "ok");
  } catch (error) {
    updateCloudStatus(error.message, "error");
    toast(error.message);
  }
}

async function saveCloudState({ immediate = false } = {}) {
  if (!cloudPassword) {
    updateCloudStatus("请输入网站保存密码后再保存云端", "error");
    return;
  }

  if (immediate) {
    clearTimeout(saveTimer);
  }

  updateCloudStatus("正在保存到云端...", "warn");
  try {
    const result = await requestCloud("PUT", { data: state });
    updateCloudStatus(`已保存到云端${formatSavedAt(result.updatedAt)}`, "ok");
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
      "x-case-password": cloudPassword,
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

function storeSessionPassword(value) {
  try {
    if (value) {
      sessionStorage.setItem(PASSWORD_KEY, value);
    } else {
      sessionStorage.removeItem(PASSWORD_KEY);
    }
  } catch {
    // If sessionStorage is blocked, the password still works for the current page.
  }
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

bindFields();
bindChecks();
renderEvidence();
renderTimeline();
bindButtons();
