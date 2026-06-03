const SUPABASE_URL = "https://fcjettvlsmoxnzolqmkc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_gcvNapfPrLZVI2x49C8stQ_wwXo3HDb";
if (!window.supabase || typeof window.supabase.createClient !== "function")
  throw new Error("Supabase nao carregado.");
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);
const STATUS_FLOW = [
  "registrada",
  "recebida_ciodes",
  "guarnicao_empenhada",
  "em_deslocamento",
  "em_atendimento",
  "finalizada",
];
const IN_PROGRESS = [
  "guarnicao_empenhada",
  "em_deslocamento",
  "em_atendimento",
];
let ocorrencias = [],
  guarnicoes = [],
  socorristas = [],
  escala = [],
  currentAssignOccurrenceId = null;
const el = (id) => document.getElementById(id);
const dispatchBody = el("dispatch-body"),
  progressBody = el("progress-body"),
  historyTableBody = el("history-table-body"),
  vehicleBoard = el("vehicle-board");
const searchInput = el("search-input"),
  filterStatus = el("filter-status"),
  refreshBtn = el("refresh-btn"),
  realtimeStatusEl = el("realtime-status");
const assignModal = el("assign-modal"),
  assignIdEl = el("assign-id"),
  assignSelect = el("assign-select"),
  assignNote = el("assign-note"),
  assignLoading = el("assign-loading"),
  assignSave = el("assign-save"),
  assignClose = el("assign-close");
const historyModal = el("history-modal"),
  historyIdEl = el("history-id"),
  historyList = el("history-list"),
  historyClose = el("history-close");
const formGuarnicao = el("form-guarnicao"),
  guarnicaoTipoInput = el("guarnicao-tipo"),
  guarnicaoPrefixoInput = el("guarnicao-prefixo"),
  guarnicaoDescricaoInput = el("guarnicao-descricao");
const formEscala = el("form-escala"),
  escalaGuarnicaoSelect = el("escala-guarnicao"),
  escalaBombeiroSelect = el("escala-bombeiro"),
  escalaTurnoInput = el("escala-turno"),
  escalaBody = el("escala-body");
const totalOccurrencesCount = el("total-occurrences-count"),
  fleetSummary = el("fleet-summary"),
  peopleSummary = el("people-summary"),
  dashboardMessage = el("dashboard-message"),
  pageSizeSelect = el("page-size-select"),
  clearFiltersBtn = el("clear-filters-btn"),
  dispatchPagination = el("dispatch-pagination"),
  progressPagination = el("progress-pagination"),
  historyPagination = el("history-pagination"),
  escalaPagination = el("escala-pagination"),
  insightModal = el("insight-modal"),
  insightModalKicker = el("insight-modal-kicker"),
  insightModalTitle = el("insight-modal-title"),
  insightModalSubtitle = el("insight-modal-subtitle"),
  insightModalBody = el("insight-modal-body"),
  insightModalClose = el("insight-modal-close");
const chartState = {
  status: null,
  type: null,
  month: null,
};
const paginationState = {
  dispatch: { page: 1, pageSize: 10 },
  progress: { page: 1, pageSize: 10 },
  history: { page: 1, pageSize: 10 },
  escala: { page: 1, pageSize: 10 },
  popupDispatch: { page: 1, pageSize: 8 },
  popupProgress: { page: 1, pageSize: 8 },
  popupHistory: { page: 1, pageSize: 8 },
};
function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timeoutId),
  );
}
function safe(value) {
  return value === null || value === undefined || value === ""
    ? "-"
    : String(value);
}
function vehicleLabel(g) {
  return (
    `${g.tipo_viatura || ""} ${g.prefixo || g.nome || ""}`.trim() ||
    g.nome ||
    "Viatura"
  );
}
function statusToLabel(statusRaw) {
  switch ((statusRaw || "").toLowerCase()) {
    case "registrada":
      return "Registrada";
    case "recebida_ciodes":
      return "Recebida pelo CIODES";
    case "guarnicao_empenhada":
      return "Viatura empenhada";
    case "em_deslocamento":
      return "Em deslocamento";
    case "em_atendimento":
      return "Em atendimento";
    case "finalizada":
      return "Finalizada";
    case "cancelada":
      return "Cancelada";
    default:
      return statusRaw || "Desconhecido";
  }
}
function operationalLabel(status) {
  switch (status) {
    case "disponivel":
      return "Disponivel";
    case "empenhada":
      return "Empenhada";
    case "indisponivel":
      return "Indisponivel";
    case "manutencao":
      return "Manutencao";
    default:
      return status || "-";
  }
}
function badge(label, type = "muted") {
  return `<span class="badge badge-${type}">${label}</span>`;
}
function statusBadge(status) {
  const s = (status || "").toLowerCase();
  if (s === "finalizada") return badge(statusToLabel(status), "closed");
  if (s === "cancelada") return badge(statusToLabel(status), "danger");
  if (s === "registrada" || s === "recebida_ciodes")
    return badge(statusToLabel(status), "open");
  return badge(statusToLabel(status), "progress");
}
function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function elapsed(iso) {
  if (!iso) return "-";
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return "-";
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
function activeEmpenhos() {
  return ocorrencias.flatMap((o) => {
    const empenhos = Array.isArray(o.ocorrencia_empenhos)
      ? o.ocorrencia_empenhos
      : [];
    return empenhos
      .filter(
        (e) =>
          e.guarnicao_id &&
          !["finalizada", "cancelada"].includes((o.status || "").toLowerCase()),
      )
      .map((e) => ({ ...e, ocorrencia: o }));
  });
}
function activeEmpenhoForVehicle(id) {
  return activeEmpenhos().find((e) => e.guarnicao_id === id) || null;
}
function computedVehicleStatus(g) {
  if (g.status_operacional && g.status_operacional !== "disponivel")
    return g.status_operacional;
  return activeEmpenhoForVehicle(g.id) ? "empenhada" : "disponivel";
}
function getActiveEmpenho(o) {
  const empenhos = Array.isArray(o.ocorrencia_empenhos)
    ? o.ocorrencia_empenhos
    : [];
  return empenhos.find((e) => e.guarnicao) || null;
}
function rowMatchesSearch(o) {
  const term = (searchInput?.value || "").trim().toLowerCase(),
    status = filterStatus?.value || "";
  if (status && (o.status || "").toLowerCase() !== status) return false;
  if (!term) return true;
  const empenho = getActiveEmpenho(o);
  return [
    o.protocolo,
    o.solicitante?.nome,
    o.tipo_ocorrencia?.nome,
    o.tipo_vitima?.nome,
    o.endereco_texto,
    empenho?.guarnicao ? vehicleLabel(empenho.guarnicao) : "",
  ].some((v) =>
    String(v || "")
      .toLowerCase()
      .includes(term),
  );
}
function isDispatchOccurrence(o) {
  const status = (o.status || "").toLowerCase();
  return (
    !o.is_treinamento &&
    ["registrada", "recebida_ciodes"].includes(status) &&
    !getActiveEmpenho(o)
  );
}
function isProgressOccurrence(o) {
  return (
    !o.is_treinamento && IN_PROGRESS.includes((o.status || "").toLowerCase())
  );
}
function locationButton(o) {
  if (o.latitude == null || o.longitude == null)
    return '<span class="hint">Sem local</span>';
  return `<button class="btn btn-xs btn-secondary" data-action="map" data-lat="${o.latitude}" data-lng="${o.longitude}">Mapa</button>`;
}
function setConnectionStatus(connected, label) {
  const dot = realtimeStatusEl?.querySelector(".dot"),
    text = realtimeStatusEl?.querySelector(".status-text");
  if (!dot || !text) return;
  dot.classList.toggle("dot-online", connected);
  dot.classList.toggle("dot-offline", !connected);
  text.textContent = label || (connected ? "Conectado" : "Desconectado");
}
function showMessage(message, type = "info") {
  if (!dashboardMessage) return;
  dashboardMessage.textContent = message;
  dashboardMessage.classList.toggle("error", type === "error");
  dashboardMessage.classList.remove("hidden");
}
function hideMessage() {
  dashboardMessage?.classList.add("hidden");
}
function filteredOccurrences() {
  return ocorrencias.filter(rowMatchesSearch);
}
function setAllPageSizes(pageSize) {
  Object.values(paginationState).forEach((state) => {
    state.pageSize = pageSize;
    state.page = 1;
  });
}
function resetPagination() {
  Object.values(paginationState).forEach((state) => {
    state.page = 1;
  });
}
function paginateRows(kind, rows) {
  const state = paginationState[kind];
  const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  state.page = Math.min(Math.max(state.page, 1), totalPages);
  const start = (state.page - 1) * state.pageSize;
  return rows.slice(start, start + state.pageSize);
}
function renderPagination(kind, total, container) {
  if (!container) return;
  const state = paginationState[kind];
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(Math.max(state.page, 1), totalPages);
  const start = total ? (state.page - 1) * state.pageSize + 1 : 0;
  const end = Math.min(total, state.page * state.pageSize);
  const windowSize = 5;
  const half = Math.floor(windowSize / 2);
  let firstPage = Math.max(1, state.page - half);
  const lastPage = Math.min(totalPages, firstPage + windowSize - 1);
  firstPage = Math.max(1, lastPage - windowSize + 1);
  const pageButtons = [];
  for (let page = firstPage; page <= lastPage; page += 1) {
    pageButtons.push(
      `<button class="page-number ${page === state.page ? "is-current" : ""}" data-page-kind="${kind}" data-page-action="set" data-page-value="${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`,
    );
  }
  container.innerHTML = `
    <div class="pagination-summary">
      <strong>${start}-${end}</strong>
      <span>de ${total} registros</span>
    </div>
    <div class="pagination-controls">
      <button class="page-arrow" data-page-kind="${kind}" data-page-action="first" ${state.page <= 1 ? "disabled" : ""}>Primeira</button>
      <button class="page-arrow page-arrow-icon" data-page-kind="${kind}" data-page-action="prev" ${state.page <= 1 ? "disabled" : ""}>‹</button>
      ${firstPage > 1 ? '<span class="page-ellipsis">...</span>' : ""}
      ${pageButtons.join("")}
      ${lastPage < totalPages ? '<span class="page-ellipsis">...</span>' : ""}
      <button class="page-arrow page-arrow-icon" data-page-kind="${kind}" data-page-action="next" ${state.page >= totalPages ? "disabled" : ""}>›</button>
      <button class="page-arrow" data-page-kind="${kind}" data-page-action="last" ${state.page >= totalPages ? "disabled" : ""}>Última</button>
    </div>`;
}
function countBy(rows, getter) {
  return rows.reduce((acc, item) => {
    const key = getter(item) || "Não informado";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
function objectEntriesSorted(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}
function groupByMonth(rows) {
  const grouped = rows.reduce((acc, item) => {
    if (!item.criada_em) return acc;
    const date = new Date(item.criada_em);
    if (Number.isNaN(date.getTime())) return acc;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [year, month] = key.split("-");
      return { label: `${month}/${year}`, value };
    });
}
function renderInsightList(
  entries,
  emptyLabel = "Nenhum registro encontrado.",
) {
  if (!entries.length) return `<div class="empty-row">${emptyLabel}</div>`;
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return `<div class="insight-list">${entries
    .map(([label, value]) => {
      const percent = Math.round((value / total) * 100);
      return `<div class="insight-row"><div><strong>${safe(label)}</strong><span>${value} registros</span></div><div class="insight-bar"><i style="width:${percent}%"></i></div><b>${percent}%</b></div>`;
    })
    .join("")}</div>`;
}
function renderOccurrenceMiniTable(rows, emptyLabel, paginationKind) {
  if (!rows.length) return `<div class="empty-row">${emptyLabel}</div>`;
  const pageRows = paginationKind ? paginateRows(paginationKind, rows) : rows;
  const paginationId = paginationKind
    ? `popup-pagination-${paginationKind}`
    : "";
  return `<div class="table-wrapper popup-table"><table><thead><tr><th>Protocolo</th><th>Status</th><th>Solicitante</th><th>Tipo</th><th>Local</th><th>Ações</th></tr></thead><tbody>${pageRows
    .map(
      (o) =>
        `<tr><td>${safe(o.protocolo)}</td><td>${statusBadge(o.status)}</td><td>${safe(o.solicitante?.nome)}</td><td>${safe(o.tipo_ocorrencia?.nome)}</td><td>${safe(o.endereco_texto)}</td><td><button class="btn btn-xs btn-secondary" data-action="history" data-id="${o.id}">Histórico</button>${isDispatchOccurrence(o) ? `<button class="btn btn-xs btn-primary" data-action="assign" data-id="${o.id}">Empenhar</button>` : ""}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div>${paginationKind ? `<div id="${paginationId}" class="pagination popup-pagination"></div>` : ""}`;
}
function renderVehicleCards() {
  if (!guarnicoes.length)
    return '<div class="empty-row">Nenhuma viatura cadastrada.</div>';
  return `<div class="popup-card-grid">${guarnicoes
    .map((g) => {
      const status = computedVehicleStatus(g);
      const active = activeEmpenhoForVehicle(g.id);
      return `<article class="popup-card"><strong>${vehicleLabel(g)}</strong>${badge(operationalLabel(status), status === "disponivel" ? "closed" : status === "empenhada" ? "progress" : "danger")}<span>${safe(g.descricao || g.observacao_operacional)}</span>${active ? `<small>Empenhada em ${safe(active.ocorrencia?.protocolo)}</small>` : "<small>Sem ocorrência ativa vinculada.</small>"}</article>`;
    })
    .join("")}</div>`;
}
function renderManagementPopup() {
  const members = escala.length
    ? `<div class="table-wrapper popup-table"><table><thead><tr><th>Viatura</th><th>Socorrista</th><th>Função</th></tr></thead><tbody>${escala
        .map(
          (e) =>
            `<tr><td>${e.guarnicao ? vehicleLabel(e.guarnicao) : "-"}</td><td>${safe(e.usuario?.nome)}</td><td>${safe(e.funcao || "Socorrista")}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : '<div class="empty-row">Nenhum vínculo ativo.</div>';
  return `<div class="popup-card-grid popup-card-grid-compact"><article class="popup-card"><strong>${guarnicoes.length}</strong><span>Viaturas ativas</span></article><article class="popup-card"><strong>${socorristas.length}</strong><span>Socorristas ativos</span></article><article class="popup-card"><strong>${escala.length}</strong><span>Vínculos de escala</span></article></div>${members}`;
}
function openInsightModal(view) {
  const rows = filteredOccurrences();
  const views = {
    status: {
      title: "Distribuição por status",
      subtitle:
        "Leitura proporcional dos registros conforme os filtros ativos.",
      body: () =>
        renderInsightList(
          objectEntriesSorted(
            countBy(rows, (item) => statusToLabel(item.status)),
          ),
        ),
    },
    types: {
      title: "Ranking por tipo de ocorrência",
      subtitle: "Categorias mais frequentes nos dados carregados.",
      body: () =>
        renderInsightList(
          objectEntriesSorted(
            countBy(rows, (item) => item.tipo_ocorrencia?.nome),
          ),
        ),
    },
    months: {
      title: "Série mensal",
      subtitle: "Evolução de registros por mês de criação.",
      body: () =>
        renderInsightList(
          groupByMonth(rows).map((item) => [item.label, item.value]),
          "Nenhuma data válida encontrada.",
        ),
    },
    dispatch: {
      title: "Fila de despacho",
      subtitle: "Registros aguardando triagem e empenho de viatura.",
      body: () =>
        renderOccurrenceMiniTable(
          ocorrencias.filter(isDispatchOccurrence).filter(rowMatchesSearch),
          "Nenhuma ocorrência aguardando despacho.",
          "popupDispatch",
        ),
    },
    progress: {
      title: "Atendimentos em andamento",
      subtitle: "Ocorrências ativas com equipe empenhada.",
      body: () =>
        renderOccurrenceMiniTable(
          ocorrencias.filter(isProgressOccurrence).filter(rowMatchesSearch),
          "Nenhuma ocorrência em andamento.",
          "popupProgress",
        ),
    },
    history: {
      title: "Histórico finalizado",
      subtitle: "Ocorrências encerradas conforme filtros atuais.",
      body: () =>
        renderOccurrenceMiniTable(
          ocorrencias
            .filter((o) => (o.status || "").toLowerCase() === "finalizada")
            .filter(rowMatchesSearch),
          "Nenhuma ocorrência finalizada.",
          "popupHistory",
        ),
    },
    vehicles: {
      title: "Mapa de frota",
      subtitle: "Situação operacional das viaturas cadastradas.",
      body: renderVehicleCards,
    },
    management: {
      title: "Gestão de equipes",
      subtitle: "Resumo de viaturas, socorristas e vínculos ativos.",
      body: renderManagementPopup,
    },
  };
  const current = views[view];
  if (!current || !insightModal) return;
  insightModalKicker.textContent = "Detalhamento";
  insightModalTitle.textContent = current.title;
  insightModalSubtitle.textContent = current.subtitle;
  insightModalBody.innerHTML = current.body();
  ["popupDispatch", "popupProgress", "popupHistory"].forEach((kind) => {
    const container = el(`popup-pagination-${kind}`);
    if (!container) return;
    const rows =
      kind === "popupDispatch"
        ? ocorrencias.filter(isDispatchOccurrence).filter(rowMatchesSearch)
        : kind === "popupProgress"
          ? ocorrencias.filter(isProgressOccurrence).filter(rowMatchesSearch)
          : ocorrencias
              .filter((o) => (o.status || "").toLowerCase() === "finalizada")
              .filter(rowMatchesSearch);
    renderPagination(kind, rows.length, container);
  });
  insightModal.classList.remove("hidden");
}
function closeInsightModal() {
  insightModal?.classList.add("hidden");
}
function destroyChart(name) {
  if (chartState[name]) {
    chartState[name].destroy();
    chartState[name] = null;
  }
}
function createChart(name, canvasId, config) {
  destroyChart(name);
  const canvas = el(canvasId);
  if (!canvas || !window.Chart) return;
  chartState[name] = new window.Chart(canvas, config);
}
function renderSummary() {
  const filtered = filteredOccurrences(),
    dispatch = filtered.filter(isDispatchOccurrence).length,
    progress = filtered.filter(isProgressOccurrence).length,
    available = guarnicoes.filter(
      (g) => computedVehicleStatus(g) === "disponivel",
    ).length,
    today = new Date().toISOString().slice(0, 10),
    closedToday = filtered.filter(
      (o) =>
        (o.status || "").toLowerCase() === "finalizada" &&
        String(o.finalizada_em || "").slice(0, 10) === today,
    ).length;
  el("dispatch-count").textContent = String(dispatch);
  el("progress-count").textContent = String(progress);
  el("available-count").textContent = String(available);
  el("closed-today-count").textContent = String(closedToday);
  if (totalOccurrencesCount)
    totalOccurrencesCount.textContent = String(filtered.length);
  if (fleetSummary)
    fleetSummary.textContent = `${guarnicoes.length} viaturas cadastradas`;
  if (peopleSummary)
    peopleSummary.textContent = `${socorristas.length} socorristas ativos`;
  el("last-updated").textContent = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function renderDispatchQueue() {
  const rows = ocorrencias
    .filter(isDispatchOccurrence)
    .filter(rowMatchesSearch);
  const pageRows = paginateRows("dispatch", rows);
  renderPagination("dispatch", rows.length, dispatchPagination);
  if (!rows.length) {
    dispatchBody.innerHTML =
      '<tr><td colspan="7" class="empty-row">Nenhuma ocorrência aguardando despacho.</td></tr>';
    return;
  }
  dispatchBody.innerHTML = pageRows
    .map(
      (o) =>
        `<tr><td>${safe(o.protocolo)}</td><td>${elapsed(o.criada_em)}</td><td>${safe(o.solicitante?.nome)}<br><span class="hint">${safe(o.solicitante?.telefone)}</span></td><td>${safe(o.tipo_ocorrencia?.nome)}</td><td>${safe(o.tipo_vitima?.nome)}</td><td>${safe(o.endereco_texto)}<br>${locationButton(o)}</td><td><button class="btn btn-xs btn-secondary" data-action="receive" data-id="${o.id}">Assumir</button><button class="btn btn-xs btn-primary" data-action="assign" data-id="${o.id}">Empenhar</button><button class="btn btn-xs btn-secondary" data-action="history" data-id="${o.id}">Histórico</button></td></tr>`,
    )
    .join("");
}
function renderProgressTable() {
  const rows = ocorrencias
    .filter(isProgressOccurrence)
    .filter(rowMatchesSearch);
  const pageRows = paginateRows("progress", rows);
  renderPagination("progress", rows.length, progressPagination);
  if (!rows.length) {
    progressBody.innerHTML =
      '<tr><td colspan="8" class="empty-row">Nenhuma ocorrência em andamento.</td></tr>';
    return;
  }
  progressBody.innerHTML = pageRows
    .map((o) => {
      const empenho = getActiveEmpenho(o),
        g = empenho?.guarnicao;
      return `<tr><td>${safe(o.protocolo)}</td><td>${statusBadge(o.status)}</td><td>${g ? vehicleLabel(g) : "-"}</td><td>${safe(o.tipo_ocorrencia?.nome)}</td><td>${safe(o.tipo_vitima?.nome)}</td><td>${elapsed(o.criada_em)}</td><td>${locationButton(o)}</td><td><button class="btn btn-xs btn-primary" data-action="next" data-id="${o.id}">Avançar</button><button class="btn btn-xs btn-secondary" data-action="history" data-id="${o.id}">Histórico</button></td></tr>`;
    })
    .join("");
}
function renderClosedTable() {
  const rows = ocorrencias
    .filter((o) => (o.status || "").toLowerCase() === "finalizada")
    .filter(rowMatchesSearch);
  const pageRows = paginateRows("history", rows);
  renderPagination("history", rows.length, historyPagination);
  if (!rows.length) {
    historyTableBody.innerHTML =
      '<tr><td colspan="6" class="empty-row">Nenhuma ocorrência finalizada.</td></tr>';
    return;
  }
  historyTableBody.innerHTML = pageRows
    .map((o) => {
      const empenho =
        getActiveEmpenho(o) ||
        (Array.isArray(o.ocorrencia_empenhos)
          ? o.ocorrencia_empenhos[0]
          : null);
      return `<tr><td>${safe(o.protocolo)}</td><td>${formatDateTime(o.finalizada_em || o.atualizada_em)}</td><td>${safe(o.solicitante?.nome)}</td><td>${safe(o.tipo_ocorrencia?.nome)}</td><td>${empenho?.guarnicao ? vehicleLabel(empenho.guarnicao) : "-"}</td><td><button class="btn btn-xs btn-secondary" data-action="history" data-id="${o.id}">Histórico</button></td></tr>`;
    })
    .join("");
}
function renderVehicleBoard() {
  if (!guarnicoes.length) {
    vehicleBoard.innerHTML =
      '<div class="empty-row">Nenhuma viatura cadastrada.</div>';
    return;
  }
  vehicleBoard.innerHTML = guarnicoes
    .map((g) => {
      const status = computedVehicleStatus(g),
        active = activeEmpenhoForVehicle(g.id),
        type =
          status === "disponivel"
            ? "closed"
            : status === "empenhada"
              ? "progress"
              : "danger";
      return `<div class="vehicle-card"><div class="vehicle-head"><span class="vehicle-title">${vehicleLabel(g)}</span>${badge(operationalLabel(status), type)}</div><div class="vehicle-meta">${safe(g.descricao || g.observacao_operacional)}${active ? `<br>Empenhada em ${safe(active.ocorrencia?.protocolo)}` : ""}</div><div class="vehicle-actions"><button class="btn btn-xs btn-secondary" data-action="vehicle-status" data-id="${g.id}" data-status="disponivel">Disponível</button><button class="btn btn-xs btn-danger" data-action="vehicle-status" data-id="${g.id}" data-status="indisponivel">Indisponível</button><button class="btn btn-xs btn-secondary" data-action="vehicle-status" data-id="${g.id}" data-status="manutencao">Manutenção</button></div></div>`;
    })
    .join("");
}
function renderManagement() {
  escalaGuarnicaoSelect.innerHTML =
    '<option value="">Selecione...</option>' +
    guarnicoes
      .map((g) => `<option value="${g.id}">${vehicleLabel(g)}</option>`)
      .join("");
  escalaBombeiroSelect.innerHTML =
    '<option value="">Selecione...</option>' +
    socorristas
      .map(
        (s) =>
          `<option value="${s.id}">${safe(s.nome)} (${safe(s.cpf_matricula)})</option>`,
      )
      .join("");
  if (!escala.length) {
    escalaBody.innerHTML =
      '<tr><td colspan="4" class="empty-row">Nenhum vínculo ativo.</td></tr>';
    renderPagination("escala", 0, escalaPagination);
    return;
  }
  const pageRows = paginateRows("escala", escala);
  renderPagination("escala", escala.length, escalaPagination);
  escalaBody.innerHTML = pageRows
    .map(
      (e) =>
        `<tr><td>${e.guarnicao ? vehicleLabel(e.guarnicao) : "-"}</td><td>${safe(e.usuario?.nome)}</td><td>${safe(e.funcao || "Socorrista")}</td><td><button class="btn btn-xs btn-danger" data-action="remove-member" data-id="${e.id}">Remover</button></td></tr>`,
    )
    .join("");
}
function renderCharts() {
  const rows = filteredOccurrences();
  const statusData = countBy(rows, (item) => statusToLabel(item.status));
  const typeData = countBy(rows, (item) => item.tipo_ocorrencia?.nome);
  const monthData = groupByMonth(rows);
  const palette = [
    "#0f766e",
    "#0284c7",
    "#22c55e",
    "#06b6d4",
    "#f59e0b",
    "#ef4444",
    "#64748b",
  ];

  createChart("status", "status-chart", {
    type: "pie",
    data: {
      labels: Object.keys(statusData),
      datasets: [
        {
          data: Object.values(statusData),
          backgroundColor: palette,
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  });

  createChart("type", "type-chart", {
    type: "bar",
    data: {
      labels: Object.keys(typeData),
      datasets: [
        {
          label: "Ocorrências",
          data: Object.values(typeData),
          backgroundColor: "#0284c7",
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } },
    },
  });

  createChart("month", "month-chart", {
    type: "line",
    data: {
      labels: monthData.map((item) => item.label),
      datasets: [
        {
          label: "Registros",
          data: monthData.map((item) => item.value),
          borderColor: "#0f766e",
          backgroundColor: "rgba(15, 118, 110, 0.14)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } },
    },
  });
}
function renderAll() {
  renderSummary();
  renderCharts();
  renderDispatchQueue();
  renderProgressTable();
  renderClosedTable();
  renderVehicleBoard();
  renderManagement();
}
async function loadData() {
  showMessage("Carregando indicadores e registros do Supabase...");
  const [occRes, gRes, uRes, eRes] = await withTimeout(
    Promise.all([
      supabaseClient
        .from("ocorrencias")
        .select(
          `id, protocolo, criada_em, atualizada_em, finalizada_em, status, latitude, longitude, endereco_texto, descricao, is_treinamento, solicitante:solicitante_id (id, nome, telefone), tipo_ocorrencia:tipo_ocorrencia_id (id, nome), tipo_vitima:tipo_vitima_id (id, nome), ocorrencia_empenhos (id, guarnicao_id, status, guarnicao:guarnicao_id (id, nome, tipo_viatura, prefixo))`,
        )
        .order("criada_em", { ascending: false })
        .limit(250),
      supabaseClient
        .from("guarnicoes")
        .select(
          "id, nome, tipo_viatura, prefixo, descricao, ativo, status_operacional, observacao_operacional",
        )
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabaseClient
        .from("usuarios")
        .select("id, nome, cpf_matricula")
        .eq("papel", "socorrista")
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabaseClient
        .from("guarnicao_membros")
        .select(
          "id, funcao, guarnicao:guarnicao_id (id, nome, tipo_viatura, prefixo), usuario:usuario_id (id, nome)",
        )
        .eq("ativo", true)
        .order("criado_em", { ascending: true }),
    ]),
    15000,
    "Tempo esgotado ao carregar dados",
  );
  if (occRes.error) throw occRes.error;
  if (gRes.error) throw gRes.error;
  if (uRes.error) throw uRes.error;
  if (eRes.error) throw eRes.error;
  ocorrencias = occRes.data || [];
  guarnicoes = gRes.data || [];
  socorristas = uRes.data || [];
  escala = eRes.data || [];
  setConnectionStatus(true, "Conectado");
  hideMessage();
  renderAll();
}
function nextStatus(current) {
  const idx = STATUS_FLOW.indexOf((current || "").toLowerCase());
  if (idx < 0) return "recebida_ciodes";
  return STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
}
async function updateOccurrenceStatus(id, status, observacao) {
  const payload = {
    status,
    atualizada_em: new Date().toISOString(),
    finalizada_em: status === "finalizada" ? new Date().toISOString() : null,
  };
  const { error } = await supabaseClient
    .from("ocorrencias")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
  await supabaseClient
    .from("ocorrencia_status_historico")
    .insert({ ocorrencia_id: id, status, observacao: observacao || null });
  await loadData();
}
function openAssignModal(id) {
  currentAssignOccurrenceId = id;
  const o = ocorrencias.find((item) => item.id === id);
  assignIdEl.textContent = o
    ? `${o.protocolo} - ${safe(o.tipo_ocorrencia?.nome)}`
    : id;
  assignNote.value = "";
  const available = guarnicoes.filter(
    (g) => computedVehicleStatus(g) === "disponivel",
  );
  assignSelect.innerHTML = available.length
    ? '<option value="">Selecione...</option>' +
      available
        .map((g) => `<option value="${g.id}">${vehicleLabel(g)}</option>`)
        .join("")
    : '<option value="">Nenhuma viatura disponível</option>';
  assignSave.disabled = !available.length;
  assignLoading.textContent = available.length
    ? ""
    : "Marque uma viatura como disponível para empenhar.";
  assignModal.classList.remove("hidden");
}
async function saveAssign() {
  const guarnicaoId = assignSelect.value;
  if (!currentAssignOccurrenceId || !guarnicaoId)
    return alert("Selecione uma viatura.");
  const note = assignNote.value.trim();
  const { error } = await supabaseClient.from("ocorrencia_empenhos").upsert(
    {
      ocorrencia_id: currentAssignOccurrenceId,
      guarnicao_id: guarnicaoId,
      status: "empenhada",
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "ocorrencia_id,guarnicao_id" },
  );
  if (error) return alert(`Erro ao empenhar: ${error.message}`);
  assignModal.classList.add("hidden");
  await updateOccurrenceStatus(
    currentAssignOccurrenceId,
    "guarnicao_empenhada",
    note || "Viatura empenhada pelo CIODES.",
  );
}
async function loadHistory(id) {
  historyIdEl.textContent = id;
  historyList.innerHTML = "<li>Carregando...</li>";
  historyModal.classList.remove("hidden");
  const { data, error } = await supabaseClient
    .from("ocorrencia_status_historico")
    .select("status, observacao, criado_em")
    .eq("ocorrencia_id", id)
    .order("criado_em", { ascending: true });
  if (error) {
    historyList.innerHTML = `<li>Erro: ${error.message}</li>`;
    return;
  }
  historyList.innerHTML = data?.length
    ? data
        .map(
          (item) =>
            `<li><span class="time">${formatDateTime(item.criado_em)}</span><strong>${statusToLabel(item.status)}</strong>${item.observacao ? `<div class="obs">${item.observacao}</div>` : ""}</li>`,
        )
        .join("")
    : "<li>Nenhum histórico registrado.</li>";
}
async function setVehicleStatus(id, status) {
  const { error } = await supabaseClient
    .from("guarnicoes")
    .update({ status_operacional: status })
    .eq("id", id);
  if (error) return alert(`Erro ao atualizar viatura: ${error.message}`);
  await loadData();
}
async function handleTableAction(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action,
    id = target.dataset.id;
  try {
    if (action === "map")
      return window.open(
        `https://www.google.com/maps/search/?api=1&query=${target.dataset.lat},${target.dataset.lng}`,
        "_blank",
      );
    if (action === "receive")
      return updateOccurrenceStatus(
        id,
        "recebida_ciodes",
        "Ocorrência assumida pelo CIODES.",
      );
    if (action === "assign") return openAssignModal(id);
    if (action === "next") {
      const o = ocorrencias.find((item) => item.id === id);
      if (o) return updateOccurrenceStatus(id, nextStatus(o.status));
    }
    if (action === "history") return loadHistory(id);
    if (action === "vehicle-status")
      return setVehicleStatus(id, target.dataset.status);
    if (action === "remove-member") {
      if (!confirm("Remover este socorrista da viatura?")) return;
      const { error } = await supabaseClient
        .from("guarnicao_membros")
        .update({ ativo: false })
        .eq("id", id);
      if (error) return alert(`Erro ao remover: ${error.message}`);
      return loadData();
    }
  } catch (error) {
    console.error("[Dashboard] ação falhou:", error);
    alert(error.message || "Erro na operação.");
  }
}
function handlePaginationClick(event) {
  const target = event.target.closest("[data-page-kind]");
  if (!target) return;
  const state = paginationState[target.dataset.pageKind];
  if (!state) return;
  if (target.dataset.pageAction === "first") state.page = 1;
  if (target.dataset.pageAction === "prev") state.page -= 1;
  if (target.dataset.pageAction === "next") state.page += 1;
  if (target.dataset.pageAction === "last")
    state.page = Number.MAX_SAFE_INTEGER;
  if (target.dataset.pageAction === "set")
    state.page = Number(target.dataset.pageValue) || 1;
  if (target.dataset.pageKind.startsWith("popup")) {
    const currentView =
      target.dataset.pageKind === "popupDispatch"
        ? "dispatch"
        : target.dataset.pageKind === "popupProgress"
          ? "progress"
          : "history";
    openInsightModal(currentView);
  } else {
    renderAll();
  }
}
function handleDockClick(event) {
  const target = event.target.closest("[data-scroll-target]");
  if (!target) return;
  const targetId = target.dataset.scrollTarget;
  document
    .querySelectorAll(".dock-item")
    .forEach((item) => item.classList.toggle("is-active", item === target));
  showDashboardPage(targetId);
}
function showDashboardPage(targetId = "overview-section") {
  document.querySelectorAll(".dashboard-section").forEach((section) => {
    section.classList.toggle("page-hidden", section.id !== targetId);
  });
  document
    .querySelectorAll(".dashboard-page-only")
    .forEach((section) =>
      section.classList.toggle("page-hidden", targetId !== "overview-section"),
    );
  document
    .querySelector(".section-dock")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function handlePopupClick(event) {
  const target = event.target.closest("[data-popup-view]");
  if (!target) return;
  openInsightModal(target.dataset.popupView);
}
formGuarnicao?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const tipo = guarnicaoTipoInput.value.trim(),
    prefixo = guarnicaoPrefixoInput.value.trim(),
    descricao = guarnicaoDescricaoInput.value.trim();
  if (!tipo && !prefixo) return alert("Informe tipo ou prefixo da viatura.");
  const { error } = await supabaseClient.from("guarnicoes").insert({
    nome: prefixo || tipo,
    tipo_viatura: tipo || null,
    prefixo: prefixo || null,
    descricao: descricao || null,
    status_operacional: "disponivel",
  });
  if (error) return alert(`Erro ao cadastrar viatura: ${error.message}`);
  formGuarnicao.reset();
  await loadData();
});
formEscala?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const guarnicao_id = escalaGuarnicaoSelect.value,
    usuario_id = escalaBombeiroSelect.value,
    funcao = escalaTurnoInput.value.trim() || "Socorrista";
  if (!guarnicao_id || !usuario_id)
    return alert("Selecione viatura e socorrista.");
  const { error } = await supabaseClient
    .from("guarnicao_membros")
    .upsert(
      { guarnicao_id, usuario_id, funcao, ativo: true },
      { onConflict: "guarnicao_id,usuario_id" },
    );
  if (error) return alert(`Erro ao vincular socorrista: ${error.message}`);
  formEscala.reset();
  await loadData();
});
[
  dispatchBody,
  progressBody,
  historyTableBody,
  vehicleBoard,
  escalaBody,
].forEach((node) => node?.addEventListener("click", handleTableAction));
[
  dispatchPagination,
  progressPagination,
  historyPagination,
  escalaPagination,
].forEach((node) => node?.addEventListener("click", handlePaginationClick));
refreshBtn?.addEventListener("click", () => void loadData());
searchInput?.addEventListener("input", () => {
  resetPagination();
  renderAll();
});
filterStatus?.addEventListener("change", () => {
  resetPagination();
  renderAll();
});
pageSizeSelect?.addEventListener("change", () => {
  setAllPageSizes(Number(pageSizeSelect.value) || 10);
  renderAll();
});
clearFiltersBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  if (filterStatus) filterStatus.value = "";
  resetPagination();
  renderAll();
});
document
  .querySelector(".section-dock")
  ?.addEventListener("click", handleDockClick);
document.addEventListener("click", handlePopupClick);
insightModalBody?.addEventListener("click", handleTableAction);
insightModalClose?.addEventListener("click", closeInsightModal);
insightModal?.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop")) closeInsightModal();
});
assignSave?.addEventListener("click", () => void saveAssign());
assignClose?.addEventListener("click", () =>
  assignModal.classList.add("hidden"),
);
historyClose?.addEventListener("click", () =>
  historyModal.classList.add("hidden"),
);
assignModal?.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop"))
    assignModal.classList.add("hidden");
});
historyModal?.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop"))
    historyModal.classList.add("hidden");
});
function setupRealtime() {
  supabaseClient
    .channel("ciodes_dashboard_changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "ocorrencias" },
      () => {
        showMessage("Nova ocorrência recebida. Atualizando...", "info");
        void loadData().finally(() => setTimeout(hideMessage, 3000));
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ocorrencias" },
      () => void loadData(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ocorrencia_empenhos" },
      () => void loadData(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "guarnicoes" },
      () => void loadData(),
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED")
        setConnectionStatus(true, "Tempo real ativo");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        console.warn("[Dashboard] realtime:", status);
    });
}
(async function init() {
  try {
    await loadData();
    showDashboardPage("overview-section");
    setupRealtime();
  } catch (error) {
    console.error("[Dashboard] erro ao iniciar:", error);
    setConnectionStatus(false, "Erro de conexão");
    showMessage(
      `Não foi possível carregar os dados. ${error.message || error}`,
      "error",
    );
    dispatchBody.innerHTML = `<tr><td colspan="7" class="empty-row">Erro ao carregar: ${error.message || error}</td></tr>`;
    progressBody.innerHTML =
      '<tr><td colspan="8" class="empty-row">Não foi possível carregar os dados.</td></tr>';
    historyTableBody.innerHTML =
      '<tr><td colspan="6" class="empty-row">Não foi possível carregar os dados.</td></tr>';
  }
})();
