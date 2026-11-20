import {
  services,
  verdicts,
  hits,
  stable,
  groupStats,
  needsThird,
  assess,
  quality,
} from "./engine.js";
const $ = (id) => document.getElementById(id);
const icons = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 5v6h6M12 7v5l3 2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5.1.6c0 2-2.6 2-2.6 4M12 16.8h.01"/>',
  pulse: '<path d="M2 12h4l3-6 4 12 3-9 2 3h4"/>',
  shield:
    '<path d="m12 3 8 3v5c0 5-3.7 8-8 10-4.3-2-8-5-8-10V6zM8.5 12l2.5 2.5 4.5-5"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  wave: '<path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4"/>',
  antenna:
    '<circle cx="12" cy="10" r="1.4"/><path d="m12 12-2.5 9m2.5-9 2.5 9M7.6 6.2a6 6 0 0 0 0 7.6m8.8-7.6a6 6 0 0 1 0 7.6M4.6 3.3a10 10 0 0 0 0 13.4M19.4 3.3a10 10 0 0 1 0 13.4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};
const icon = (name) =>
  '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + "</svg>";
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon);
  el.setAttribute("aria-hidden", "true");
});
const dateFmt = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  weekday: "long",
});
const timeFmt = new Intl.DateTimeFormat("ru", {
  hour: "2-digit",
  minute: "2-digit",
});
const stampFmt = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
$("top-date").textContent = dateFmt.format(new Date());
const key = "prosvet.history.v1";
const emptySamples = () => Object.fromEntries(services.map((s) => [s.id, []]));
let active = null,
  last = null,
  filter = "all",
  log = [];
const currentView = () =>
  ["history", "method"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "overview";
function navigate() {
  const view = currentView();
  document.querySelectorAll(".page").forEach((p) => {
    p.hidden = p.id !== view;
  });
  document.querySelectorAll("nav a").forEach((a) => {
    if (a.dataset.view === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (view === "history") showHistory();
  window.scrollTo(0, 0);
}
function formatMs(ms) {
  if (ms === null) return "—";
  return ms < 1000
    ? Math.max(1, Math.round(ms)) + " мс"
    : (ms / 1000).toLocaleString("ru", { maximumFractionDigits: 1 }) + " с";
}
function validRecord(x) {
  return (
    x &&
    Number.isFinite(x.at) &&
    !Number.isNaN(new Date(x.at).valueOf()) &&
    ["other", "mobile"].includes(x.connection) &&
    x.samples &&
    ["cbr", "post", "ria", "academy", "w3c", "gnu"].every((id) =>
      Array.isArray(x.samples[id]),
    ) &&
    (x.version !== 2 ||
      services.every((s) => Array.isArray(x.samples[s.id]))) &&
    Object.entries(x.samples).every(
      ([id, pair]) =>
        services.some((s) => s.id === id) &&
        Array.isArray(pair) &&
        [2, 3].includes(pair.length) &&
        pair.every(
          (a) =>
            a &&
            ["ok", "timeout", "error", "policy", "unexpected"].includes(
              a.status,
            ) &&
            Number.isFinite(a.ms) &&
            a.ms >= 0,
        ),
    )
  );
}
function storageNote(message) {
  $("store-note").hidden = false;
  $("store-note").textContent = message;
}
try {
  log = JSON.parse(localStorage.getItem(key) || "[]")
    .filter(validRecord)
    .slice(0, 30);
} catch {
  storageNote("История недоступна. Новые результаты видны в этом сеансе.");
}
function save(record) {
  log = [record, ...log].slice(0, 30);
  try {
    localStorage.setItem(key, JSON.stringify(log));
  } catch {
    storageNote(
      "История этой проверки доступна только до закрытия приложения.",
    );
  }
}
function describePair(pair) {
  if (!pair.length) return ["Ожидает", "", "idle"];
  const n = hits(pair);
  const good = pair.filter((s) => s.status === "ok");
  const labels = {
    timeout: "Тайм-аут",
    error: "Нет ответа",
    policy: "Запрет браузера",
    unexpected: "Другой ресурс",
  };
  const lastTry = pair[pair.length - 1];
  const small = good.length
    ? formatMs(good.reduce((n, x) => n + x.ms, 0) / good.length)
    : labels[lastTry.status];
  return [
    n + " из " + pair.length,
    small,
    stable(pair) ? "ok" : n ? "partial" : "fail",
  ];
}
function showRows(samples) {
  const rows = $("rows");
  rows.replaceChildren();
  for (const s of services.filter(
    (s) => filter === "all" || s.group === filter,
  )) {
    const row = document.createElement("div");
    row.className = "row";
    const [state, sub, tone] = describePair(samples[s.id]);
    row.innerHTML =
      '<span class="monogram" aria-hidden="true"></span><div><span class="name"></span><span class="domain"></span></div><div class="row-state"><span></span><small></small></div>';
    const mark = row.firstElementChild;
    mark.textContent = s.mark;
    mark.style.color = s.ink;
    mark.style.backgroundColor = s.color;
    row.querySelector(".name").textContent = s.name;
    row.querySelector(".domain").textContent = new URL(s.url).hostname.replace(
      /^www\./,
      "",
    );
    const result = row.lastElementChild;
    result.dataset.state = tone;
    result.firstElementChild.textContent = state;
    result.lastElementChild.textContent = sub;
    rows.append(row);
  }
}
function showMeasurements() {
  const samples = active?.samples || last?.samples || emptySamples();
  for (const group of ["listed", "control"]) {
    const members = services.filter((s) => s.group === group),
      meter = $(group + "-meter");
    meter.replaceChildren();
    for (const s of members) {
      const pair = samples[s.id],
        n = hits(pair);
      const tick = document.createElement("span");
      tick.className = stable(pair)
        ? "yes"
        : n
          ? "partial"
          : pair.length >= 2
            ? "no"
            : "";
      meter.append(tick);
    }
    const score = $(group + "-score");
    score.textContent =
      !active && last
        ? members.filter((s) => stable(samples[s.id])).length
        : "—";
    const pending = score.textContent === "—";
    score.nextElementSibling.hidden = pending;
    score.nextElementSibling.textContent = " / " + members.length;
    $(group + "-detail").textContent = pending
      ? active
        ? "Идёт проверка"
        : "Ещё не проверено"
      : samples.cbr.length === 2
        ? "Ответили оба раза"
        : "Ответили трижды";
    score.parentElement.setAttribute(
      "aria-label",
      score.textContent === "—"
        ? "Нет полного замера"
        : score.textContent +
            " из " +
            members.length +
            " сайтов ответили во всех замерах",
    );
  }
  showRows(samples);
  $("basis").hidden = !last || Boolean(active);
  if (last && !active) {
    const rounds = samples.cbr.length;
    const summarize = (stat) =>
      stat.stable +
      " из " +
      stat.total +
      " ответили " +
      (rounds === 3 ? "трижды" : "дважды") +
      (stat.any > stat.stable
        ? " · ещё " + (stat.any - stat.stable) + " с перебоями"
        : "");
    $("basis-list").textContent = summarize(groupStats(samples, "listed"));
    $("basis-ru").textContent = summarize(groupStats(samples, "control", "ru"));
    $("basis-world").textContent = summarize(
      groupStats(samples, "control", "world"),
    );
    const previous = log.find(
      (item) =>
        item.at < last.at &&
        last.at - item.at < 7 * 86400000 &&
        item.version === 2 &&
        groupStats(item.samples, "control").stable >= 2,
    );
    $("baseline").hidden = !previous;
    if (previous) {
      const n = groupStats(previous.samples, "control").stable;
      $("baseline").textContent =
        "Для сравнения: " +
        stampFmt.format(previous.at) +
        " на этом устройстве стабильно отвечали " +
        n +
        " из 6 обычных сайтов. Подключение могло отличаться.";
    }
  }
  const q = last && !active ? quality(samples) : null;
  $("quality-title").textContent = q
    ? q.title
    : active
      ? "Идёт замер"
      : "Нет замера";
  $("quality-text").textContent = q
    ? q.text
    : active
      ? "Считаем время загрузки и ответы сайтов."
      : "Проверка покажет задержки и пропущенные ответы.";
  $("quality-round").textContent = q ? timeFmt.format(last.at) : "";
  $("q-ms").textContent = q ? formatMs(q.median) : "—";
  $("q-miss").textContent = q ? q.missed + " / " + q.total : "—";
  $("q-timeout").textContent = q ? String(q.timeouts) : "—";
}
function showHistory() {
  const body = $("history-body");
  body.replaceChildren();
  if (!log.length) {
    body.innerHTML =
      '<div class="empty"><i>' +
      icon("history") +
      '</i><h2>Пока нет проверок</h2><p>Завершённые замеры появятся здесь.</p><a class="history-link" href="#overview">Перейти к проверке</a></div>';
    return;
  }
  for (const item of log) {
    const entry = document.createElement("details");
    entry.className = "entry";
    const summary = document.createElement("summary");
    const key = assess(item.samples, item.connection);
    summary.textContent = verdicts[key][0];
    const stamp = document.createElement("span");
    stamp.textContent =
      stampFmt.format(item.at) +
      " · " +
      (item.connection === "mobile"
        ? "Мобильный интернет"
        : "Другое подключение");
    summary.append(stamp);
    entry.append(summary);
    const q = quality(item.samples),
      p = document.createElement("p");
    p.textContent =
      q.title +
      " · " +
      formatMs(q.median) +
      " · без ответа " +
      q.missed +
      " / " +
      q.total;
    entry.append(p);
    for (const s of services.filter((s) => item.samples[s.id])) {
      const row = document.createElement("div");
      row.className = "entry-row";
      const status = document.createElement("span");
      status.textContent = describePair(item.samples[s.id])
        .slice(0, 2)
        .join(" · ");
      row.append(document.createTextNode(s.name), status);
      entry.append(row);
    }
    body.append(entry);
  }
}
function showHero(title, summary, phase, tone = "idle") {
  $("verdict").textContent = title;
  $("summary").textContent = summary;
  $("phase").textContent = phase;
  $("hero").dataset.tone = tone;
}
function setIdleButton(text = "Проверить ещё раз") {
  $("run-label").textContent = text;
  $("run").firstElementChild.innerHTML = icon("pulse");
  $("hero").classList.remove("running");
}
function stopRun(reason, announce = true) {
  if (!active) return;
  const run = active;
  active = null;
  run.abort.abort();
  last = null;
  setIdleButton();
  $("duration").textContent = "";
  showHero("Проверка прервана", reason, "Нет результата", "warn");
  if (announce) $("announce").textContent = reason;
  showMeasurements();
}
function probe(service, run) {
  return new Promise((resolve) => {
    const image = new Image();
    const started = performance.now();
    let done = false;
    const url = new URL(service.url);
    url.searchParams.set(
      "prosvet",
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2),
    );
    const finish = (status) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      run.abort.signal.removeEventListener("abort", cancel);
      image.onload = null;
      image.onerror = null;
      if (status === "timeout" || status === "aborted")
        image.removeAttribute("src");
      resolve({ status, ms: Math.round(performance.now() - started) });
    };
    const cancel = () => finish("aborted");
    const timer = setTimeout(() => finish("timeout"), run.timeout);
    image.referrerPolicy = "no-referrer";
    image.onload = () =>
      finish(
        service.sizes.includes(image.naturalWidth) &&
          image.naturalHeight === image.naturalWidth
          ? "ok"
          : "unexpected",
      );
    image.onerror = () => finish("error");
    run.abort.signal.addEventListener("abort", cancel, { once: true });
    image.src = url.href;
  });
}
document.addEventListener("securitypolicyviolation", (event) => {
  if (
    active &&
    event.effectiveDirective?.startsWith("img-src") &&
    event.disposition !== "report"
  ) {
    try {
      active.blocked.add(new URL(event.blockedURI).origin);
    } catch {}
  }
});
async function startRun(connection) {
  if (active) return;
  const run = {
    connection,
    rounds: 2,
    timeout: $("slow").checked ? 20000 : 8000,
    samples: emptySamples(),
    abort: new AbortController(),
    blocked: new Set(),
  };
  last = null;
  active = run;
  if ($("sheet").open) $("sheet").close();
  $("hero").classList.add("running");
  $("run-label").textContent = "Остановить";
  $("run").firstElementChild.innerHTML = icon("close");
  $("duration").textContent = run.timeout === 20000 ? "до 65 сек" : "до 35 сек";
  showMeasurements();
  for (let round = 1; round <= run.rounds; round++) {
    if (round === 3) run.timeout = Math.max(run.timeout, 12000);
    const reason =
      round === 3
        ? "Ответы требуют перепроверки. Ещё раз проверяем обе группы сайтов."
        : "Сравниваем сайты из перечня с обычными российскими и зарубежными сайтами.";
    showHero(
      round === 3 ? "Уточняем результат" : "Проверяем сеть",
      reason,
      "Замер " + round + " из " + run.rounds,
    );
    $("announce").textContent = "Замер " + round + " из " + run.rounds + ".";
    await Promise.all(
      services.map(async (s) => {
        const result = await probe(s, run);
        if (active !== run) return;
        run.samples[s.id].push(result);
        showMeasurements();
      }),
    );
    if (active !== run) return;
    if (round === 2 && needsThird(run.samples)) run.rounds = 3;
    if (round < run.rounds)
      await new Promise((f) => setTimeout(f, round === 1 ? 1000 : 1500));
    if (active !== run) return;
  }
  // Browsers can report CSP after the image error task.
  await new Promise((f) => setTimeout(f, 80));
  if (active !== run) return;
  for (const s of services) {
    if (run.blocked.has(new URL(s.url).origin)) {
      run.samples[s.id].forEach((sample) => {
        if (sample.status !== "ok") sample.status = "policy";
      });
    }
  }
  const record = {
    version: 2,
    at: Date.now(),
    connection,
    samples: run.samples,
  };
  last = record;
  active = null;
  save(record);
  const [title, desc, tone] = verdicts[assess(record.samples, connection)];
  showHero(title, desc, "Замер в " + timeFmt.format(record.at), tone);
  setIdleButton();
  $("duration").textContent = "";
  showMeasurements();
  showHistory();
  $("announce").textContent = title + ". " + quality(record.samples).title;
}
$("run").addEventListener("click", () => {
  if (active)
    return stopRun(
      "Вы остановили замер. Для вывода нужно дождаться завершения проверки.",
    );
  $("sheet").showModal();
});
$("close").addEventListener("click", () => $("sheet").close());
$("sheet").addEventListener("click", (e) => {
  if (e.target === $("sheet")) {
    const r = $("sheet").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("sheet").close();
  }
});
document
  .querySelectorAll("[data-connection]")
  .forEach((b) =>
    b.addEventListener("click", () => startRun(b.dataset.connection)),
  );
document.querySelectorAll("[data-filter]").forEach((b) =>
  b.addEventListener("click", () => {
    filter = b.dataset.filter;
    document
      .querySelectorAll(".filters button")
      .forEach((el) =>
        el.setAttribute("aria-pressed", String(el.dataset.filter === filter)),
      );
    showMeasurements();
    if (b.classList.contains("metric"))
      $("services").scrollIntoView({ block: "start" });
  }),
);
function networkChanged() {
  if (active)
    return stopRun(
      "Подключение изменилось во время проверки. Запустите новый замер.",
    );
  if (last) {
    $("phase").textContent = "Предыдущий замер · " + timeFmt.format(last.at);
    $("summary").textContent =
      "Подключение изменилось. Проверьте сеть ещё раз для актуального результата.";
  } else if (!navigator.onLine) {
    $("phase").textContent = "Браузер вне сети";
  } else if ($("phase").textContent === "Браузер вне сети") {
    $("phase").textContent = "Ожидание";
  }
}
window.addEventListener("offline", networkChanged);
window.addEventListener("online", networkChanged);
const connectionInfo = navigator.connection;
connectionInfo?.addEventListener("change", () => {
  const type = connectionInfo.type;
  if (type && lastType && type !== lastType) networkChanged();
  lastType = type;
});
let lastType = connectionInfo?.type;
document.addEventListener("visibilitychange", () => {
  if (document.hidden && active)
    stopRun(
      "Приложение ушло в фон. Повторите проверку с открытым экраном.",
      false,
    );
});
window.addEventListener("pagehide", () => {
  if (active) stopRun("Для нового результата повторите проверку.", false);
});
window.addEventListener("hashchange", navigate);
navigate();
showMeasurements();
networkChanged();
async function offlineReady() {
  const status = $("cache-status");
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    status.textContent =
      "Офлайн-режим недоступен в этом браузере или при таком способе открытия.";
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register("./sw.js");
    const check = () => {
      status.textContent = navigator.serviceWorker.controller
        ? "Готово. Экран сохранён для запуска без сети."
        : "Подготавливаем экран для запуска без сети…";
    };
    navigator.serviceWorker.addEventListener("controllerchange", check);
    check();
    const worker = reg.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "redundant" && !navigator.serviceWorker.controller)
        status.textContent =
          "Экран не сохранился. Повторно откройте приложение при рабочем интернете.";
    });
    if (!navigator.serviceWorker.controller)
      setTimeout(() => {
        if (!navigator.serviceWorker.controller)
          status.textContent =
            "Готовность не подтверждена. Откройте приложение напрямую в Safari при рабочем интернете.";
      }, 16000);
  } catch {
    status.textContent =
      "Не удалось сохранить экран. Повторно откройте приложение в Safari при рабочем интернете.";
  }
}
offlineReady();
