const CONFIG = {
  SHEET_ID: "17BFAnIJP6fjDcgXaSRxgHpdZDTR50uY4CYgPltZ1pSA",
  SHEET_GID: "1112894531",
};

const elements = {
  dataHoje: document.getElementById("data-hoje"),
  dataReferencia: document.getElementById("data-referencia"),
  statusMessage: document.getElementById("status-message"),
};

const CARD_CONFIG = [
  {
    prefix: "professores_iniciais",
    percentualId: "percentual-professores-iniciais",
    totalId: "total-professores-iniciais",
    ausentesId: "ausentes-professores-iniciais",
  },
  {
    prefix: "professores_finais",
    percentualId: "percentual-professores-finais",
    totalId: "total-professores-finais",
    ausentesId: "ausentes-professores-finais",
  },
  {
    prefix: "fundamental_iniciais",
    percentualId: "percentual-fundamental-iniciais",
    totalId: "total-fundamental-iniciais",
    ausentesId: "ausentes-fundamental-iniciais",
  },
  {
    prefix: "fundamental_finais",
    percentualId: "percentual-fundamental-finais",
    totalId: "total-fundamental-finais",
    ausentesId: "ausentes-fundamental-finais",
  },
  {
    prefix: "eja_iniciais",
    percentualId: "percentual-eja-iniciais",
    totalId: "total-eja-iniciais",
    ausentesId: "ausentes-eja-iniciais",
  },
  {
    prefix: "eja_finais",
    percentualId: "percentual-eja-finais",
    totalId: "total-eja-finais",
    ausentesId: "ausentes-eja-finais",
  },
];

function showStatus(message, type = "") {
  if (!elements.statusMessage) return;

  const hasMessage = Boolean(message && message.trim());

  elements.statusMessage.textContent = message || "";
  elements.statusMessage.hidden = !hasMessage;
  elements.statusMessage.classList.remove("is-error", "is-success");

  if (hasMessage && type) {
    elements.statusMessage.classList.add(type);
  }
}

function parseGvizResponse(text) {
  const jsonText = text
    .replace(/^.*?setResponse\(/s, "")
    .replace(/\);?\s*$/s, "");

  return JSON.parse(jsonText);
}

function parseGvizDate(rawValue) {
  if (typeof rawValue !== "string" || !rawValue.startsWith("Date(")) {
    return "";
  }

  const parts = rawValue
    .replace("Date(", "")
    .replace(")", "")
    .split(",")
    .map((item) => Number(item.trim()));

  const [year, month = 0, day = 1] = parts;
  const date = new Date(year, month, day);

  return Number.isNaN(date.getTime()) ? "" : formatDate(date);
}

function getCellDisplay(cell) {
  if (!cell) return "";

  if (typeof cell.f === "string" && cell.f.trim()) {
    return cell.f.trim();
  }

  if (cell.v == null) return "";

  if (typeof cell.v === "string" && cell.v.startsWith("Date(")) {
    return parseGvizDate(cell.v);
  }

  return cell.v;
}

function getCellRaw(cell) {
  if (!cell || cell.v == null) return "";
  return cell.v;
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeNumericString(value) {
  return String(value)
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
}

function toNumber(value) {
  if (value == null || value === "") return NaN;
  const number = Number(typeof value === "string" ? normalizeNumericString(value) : value);
  return Number.isFinite(number) ? number : NaN;
}

function formatInteger(value) {
  const number = toNumber(value);
  return Number.isFinite(number) ? String(Math.round(number)) : "0";
}

function formatPercent(value) {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return "0,0%";
  return `${number.toFixed(1).replace(".", ",")}%`;
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";
  return date.toLocaleDateString("pt-BR");
}

function parsePtBrDate(value) {
  if (typeof value !== "string") return null;

  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText) - 1;
  const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
  const date = new Date(year, month, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function buildDataMap(rows) {
  const data = {};

  rows.forEach((cells) => {
    const key = normalizeKey(getCellDisplay(cells[0]));
    if (!key) return;

    data[key] = {
      raw: getCellRaw(cells[1]),
      display: getCellDisplay(cells[1]),
    };
  });

  return data;
}

function readText(dataMap, key) {
  const entry = dataMap[key];
  if (!entry) return "";
  return String(entry.display || "");
}

function readNumber(dataMap, key, fallback = NaN) {
  const entry = dataMap[key];
  if (!entry) return fallback;

  const number = toNumber(entry.raw);
  return Number.isFinite(number) ? number : fallback;
}

function getReferenceDate(dataMap) {
  const entry = dataMap.data_referencia;
  if (!entry) return new Date();

  if (typeof entry.raw === "string" && entry.raw.startsWith("Date(")) {
    const parts = entry.raw
      .replace("Date(", "")
      .replace(")", "")
      .split(",")
      .map((item) => Number(item.trim()));

    const [year, month = 0, day = 1] = parts;
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  const parsed = parsePtBrDate(String(entry.display || ""));
  return parsed || new Date();
}

function getTeacherTotal(prefix, referenceDate) {
  if (prefix === "professores_iniciais") {
    return 15;
  }

  if (prefix === "professores_finais") {
    const day = referenceDate.getDay();
    return day === 2 || day === 5 ? 18 : 19;
  }

  return NaN;
}

function resolveTotal(dataMap, prefix, referenceDate) {
  if (prefix.startsWith("professores_")) {
    return getTeacherTotal(prefix, referenceDate);
  }

  return readNumber(dataMap, `${prefix}_total`, 0);
}

function resolveAusentes(dataMap, prefix) {
  return readNumber(dataMap, `${prefix}_ausentes`, 0);
}

function resolvePercent(dataMap, prefix, total, ausentes) {
  const explicitPercent = readNumber(dataMap, `${prefix}_percentual`);
  if (Number.isFinite(explicitPercent)) {
    return explicitPercent <= 1 ? explicitPercent * 100 : explicitPercent;
  }

  if (Number.isFinite(total) && total > 0 && Number.isFinite(ausentes)) {
    return (ausentes / total) * 100;
  }

  return 0;
}

function renderDates(dataMap) {
  if (elements.dataHoje) {
    elements.dataHoje.textContent = formatDate(new Date());
  }

  if (elements.dataReferencia) {
    const dataReferencia = readText(dataMap, "data_referencia");
    elements.dataReferencia.textContent = dataReferencia || "--/--/----";
  }
}

function renderCards(dataMap) {
  const referenceDate = getReferenceDate(dataMap);

  CARD_CONFIG.forEach((card) => {
    const percentualElement = document.getElementById(card.percentualId);
    const totalElement = document.getElementById(card.totalId);
    const ausentesElement = document.getElementById(card.ausentesId);

    if (!percentualElement || !totalElement || !ausentesElement) return;

    const total = resolveTotal(dataMap, card.prefix, referenceDate);
    const ausentes = resolveAusentes(dataMap, card.prefix);
    const percentual = resolvePercent(dataMap, card.prefix, total, ausentes);

    totalElement.textContent = formatInteger(total);
    ausentesElement.textContent = formatInteger(ausentes);
    percentualElement.textContent = formatPercent(percentual);
  });
}

async function loadSheetData() {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&gid=${CONFIG.SHEET_GID}`;

  try {
    showStatus("Lendo dados da planilha...", "is-success");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao buscar planilha: ${response.status}`);
    }

    const text = await response.text();
    const gvizJson = parseGvizResponse(text);
    const rows = (gvizJson.table?.rows || []).map((row) => row.c || []);

    if (!rows.length) {
      throw new Error("A resposta da planilha veio sem linhas válidas.");
    }

    const dataMap = buildDataMap(rows);
    renderDates(dataMap);
    renderCards(dataMap);
    showStatus("Dados da planilha lidos corretamente.", "is-success");
  } catch (error) {
    console.error(error);
    showStatus(
      "Não foi possível atualizar os dados da planilha no momento.",
      "is-error"
    );
  }
}

renderDates({});
loadSheetData();