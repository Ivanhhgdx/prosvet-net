export const services = [
  {
    id: "cbr",
    name: "Банк России",
    group: "listed",
    url: "https://www.cbr.ru/favicon.ico",
    mark: "ЦБ",
    color: "#e7edf2",
    ink: "#435e72",
    sizes: [16, 32, 48],
  },
  {
    id: "post",
    name: "Почта России",
    group: "listed",
    url: "https://www.pochta.ru/favicon.ico",
    mark: "П",
    color: "#e6edfa",
    ink: "#2755a0",
    sizes: [16, 32, 48],
  },
  {
    id: "ria",
    name: "РИА Новости",
    group: "listed",
    url: "https://ria.ru/favicon.ico",
    mark: "РИА",
    color: "#f7e9e2",
    ink: "#905338",
    sizes: [48],
  },
  {
    id: "academy",
    region: "ru",
    name: "HTML Academy",
    group: "control",
    url: "https://htmlacademy.ru/favicon.ico",
    mark: "<>",
    color: "#eee9f6",
    ink: "#68508b",
    sizes: [16, 32, 64, 128],
  },
  {
    id: "linux",
    name: "Linux.org.ru",
    group: "control",
    region: "ru",
    url: "https://www.linux.org.ru/favicon.ico",
    mark: "L",
    color: "#e9ede4",
    ink: "#526944",
    sizes: [16, 32],
  },
  {
    id: "opennet",
    name: "OpenNET",
    group: "control",
    region: "ru",
    url: "https://www.opennet.ru/favicon.ico",
    mark: "ON",
    color: "#e2eef2",
    ink: "#426676",
    sizes: [16],
  },
  {
    id: "python",
    name: "Python.org",
    group: "control",
    region: "world",
    url: "https://www.python.org/static/favicon.ico",
    mark: "Py",
    color: "#f2ebd8",
    ink: "#7a683e",
    sizes: [16, 32, 48],
  },
  {
    id: "w3c",
    region: "world",
    name: "W3C",
    group: "control",
    url: "https://www.w3.org/favicon.ico",
    mark: "W",
    color: "#e4eff4",
    ink: "#38617d",
    sizes: [16, 32, 48],
  },
  {
    id: "gnu",
    region: "world",
    name: "Проект GNU",
    group: "control",
    url: "https://www.gnu.org/favicon.ico",
    mark: "G",
    color: "#eeefdf",
    ink: "#656d36",
    sizes: [18],
  },
];
export const verdicts = {
  all: [
    "Признаков белого списка нет",
    "Все проверенные сайты доступны, включая обычные российские и зарубежные сайты.",
    "good",
  ],
  listed: [
    "Вероятно, включён белый список",
    "Сайты из перечня стабильно отвечают. Ни один обычный сайт не ответил за три замера на мобильной сети.",
    "warn",
  ],
  selective: [
    "Доступны только сайты из списка",
    "Тип подключения влияет на вывод. Для оценки режима оператора повторите замер на мобильной сети без Wi-Fi и VPN.",
    "warn",
  ],
  wider: [
    "Доступ шире белого списка",
    "Как минимум два обычных сайта стабильно отвечают.",
    "good",
  ],
  regional: [
    "Доступ шире белого списка",
    "Обычные российские сайты отвечают. Зарубежные контрольные сайты не ответили ни разу.",
    "warn",
  ],
  legacy: [
    "В прошлом замере — выборочный доступ",
    "Работала только группа сайтов из перечня.",
    "warn",
  ],
  mixed: [
    "Результат неоднозначен",
    "Ответы разошлись. Этого недостаточно, чтобы определить режим сети.",
    "warn",
  ],
  unexpected: [
    "Результат неоднозначен",
    "Один из адресов вернул неожиданное изображение. Это может быть перенаправление или изменение на сайте.",
    "warn",
  ],
  none: [
    "Нет ответов",
    "Ни один из проверенных сайтов не ответил. Определить режим сети по этому замеру нельзя.",
    "bad",
  ],
  policy: [
    "Проверка ограничена",
    "Браузер запретил часть запросов. Откройте приложение напрямую в Safari.",
    "warn",
  ],
};
export function hits(samples) {
  return samples.filter((s) => s.status === "ok").length;
}
export function stable(pair) {
  return pair.length >= 2 && hits(pair) === pair.length;
}
export function groupStats(samples, group, region) {
  const members = services.filter(
    (s) =>
      s.group === group && (!region || s.region === region) && samples[s.id],
  );
  return {
    total: members.length,
    stable: members.filter((s) => stable(samples[s.id])).length,
    any: members.filter((s) => hits(samples[s.id]) > 0).length,
  };
}
export function needsThird(samples) {
  if (
    Object.values(samples)
      .flat()
      .some((s) => s.status === "policy" || s.status === "unexpected")
  )
    return false;
  const white = groupStats(samples, "listed"),
    ordinary = groupStats(samples, "control");
  const inconsistent = Object.values(samples).some((pair) => hits(pair) === 1);
  return inconsistent || ordinary.stable < 2 || white.stable === 0;
}
export function assess(samples, connection) {
  const all = Object.values(samples).flat();
  if (all.some((s) => s.status === "policy")) return "policy";
  if (all.some((s) => s.status === "unexpected")) return "unexpected";
  const white = groupStats(samples, "listed"),
    ordinary = groupStats(samples, "control");
  const ru = groupStats(samples, "control", "ru"),
    world = groupStats(samples, "control", "world");
  if (white.stable === white.total && ordinary.stable === ordinary.total)
    return "all";
  if (ru.stable >= 2 && world.any === 0) return "regional";
  if (ordinary.stable >= 2) return "wider";
  if (white.stable >= 2 && ordinary.any === 0) {
    if (ordinary.total < 6) return "legacy";
    if (Object.values(samples).every((pair) => pair.length === 3))
      return connection === "mobile" ? "listed" : "selective";
  }
  return white.any || ordinary.any ? "mixed" : "none";
}
export function quality(samples) {
  const all = Object.values(samples).flat();
  const timings = all
    .filter((s) => s.status === "ok")
    .map((s) => s.ms)
    .sort((a, b) => a - b);
  const mid = Math.floor(timings.length / 2);
  const median = timings.length
    ? (timings[mid] + timings[Math.floor((timings.length - 1) / 2)]) / 2
    : null;
  const missed = all.length - timings.length;
  const unstable = Object.values(samples).some(
    (pair) => hits(pair) > 0 && hits(pair) < pair.length,
  );
  let title = "Ответы без заметных задержек",
    text = "Все запросы прошли, медианное время ответа меньше двух секунд.";
  if (all.some((s) => s.status === "policy")) {
    title = "Оценка недоступна";
    text = "Часть загрузок остановлена правилами браузера.";
  } else if (!timings.length) {
    title = "Ответов нет";
    text =
      "Измерить время загрузки не удалось. Причина недоступности неизвестна.";
  } else if (median >= 2000) {
    title = "Медленные ответы";
    text = unstable
      ? "Загрузки идут с задержкой. Часть сайтов ответила не в каждом замере."
      : "Даже успешные загрузки заняли заметное время.";
  } else if (unstable) {
    title = "Нестабильные ответы";
    text = "Один и тот же сайт отвечал не в каждом замере.";
  } else if (missed) {
    title = "Часть сайтов недоступна";
    text =
      "Доступные сайты отвечают быстро. У остальных нет успешных загрузок.";
  } else if (timings.some((ms) => ms >= 2000)) {
    title = "Отдельные задержки";
    text =
      "Все запросы прошли, но некоторые загрузки заняли две секунды или дольше.";
  }
  return {
    title,
    text,
    median,
    missed,
    timeouts: all.filter((s) => s.status === "timeout").length,
    total: all.length,
  };
}
