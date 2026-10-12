"use client";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Star,
  RefreshCw,
  CalendarPlus,
  MapPin,
  UserRound,
  GraduationCap,
  ArrowUpRight,
  WifiOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Combobox } from "./combobox";
import { addDays, today, monday, lessonInstant } from "@/lib/dates";
import type { Mode, Entity, Schedule } from "@/lib/types";

type Preferences = {
  mode: Mode;
  group: string;
  teacher: string;
  favorites: { mode: Mode; id: string }[];
};
const initial: Preferences = {
  mode: "group",
  group: "",
  teacher: "",
  favorites: [],
};
const labels = {
  lecture: "Лекция",
  practice: "Практика",
  lab: "Лабораторная",
  other: "Занятие",
};
const colors = {
  lecture: "bg-sky-50 text-sky-700",
  practice: "bg-emerald-50 text-emerald-700",
  lab: "bg-violet-50 text-violet-700",
  other: "bg-amber-50 text-amber-800",
};
const dateLabel = (d: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ru-RU", { ...options, timeZone: "UTC" }).format(
    new Date(d + "T12:00:00Z"),
  );
async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Ошибка загрузки");
  return body;
}
export function ScheduleApp() {
  const [catalog, setCatalog] = useState<{
    groups: Entity[];
    teachers: Entity[];
  }>({ groups: [], teachers: [] });
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState("");
  const [now, setNow] = useState(0);
  const [data, setData] = useState<Schedule | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [offline, setOffline] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const id = prefs[prefs.mode];
  const entities = prefs.mode === "group" ? catalog.groups : catalog.teachers;
  const entity = entities.find((e) => e.id === id);
  const week = day ? monday(day) : "";
  const end = week ? addDays(week, 6) : "";
  const favorite = prefs.favorites.some(
    (f) => f.mode === prefs.mode && f.id === id,
  );
  useEffect(() => {
    try {
      const p = JSON.parse(
        localStorage.getItem("bf-schedule.preferences") || "null",
      );
      if (p && (p.mode === "group" || p.mode === "teacher"))
        setPrefs({
          mode: p.mode,
          group: typeof p.group === "string" ? p.group : "",
          teacher: typeof p.teacher === "string" ? p.teacher : "",
          favorites: Array.isArray(p.favorites)
            ? p.favorites.filter(
                (f: { mode: string; id: string }) =>
                  f &&
                  (f.mode === "group" || f.mode === "teacher") &&
                  typeof f.id === "string",
              )
            : [],
        });
    } catch {
      /* Storage may be blocked. */
    }
    setDay(today());
    setNow(Date.now());
    setReady(true);
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("bf-schedule.preferences", JSON.stringify(prefs));
      } catch {
        /* Private browsing */
      }
  }, [prefs, ready]);
  useEffect(() => {
    const controller = new AbortController();
    let cached: { groups: Entity[]; teachers: Entity[] } | null = null;
    try {
      cached = JSON.parse(
        localStorage.getItem("bf-schedule.catalog") || "null",
      );
      if (
        cached &&
        Array.isArray(cached.groups) &&
        Array.isArray(cached.teachers)
      )
        setCatalog(cached);
      else cached = null;
    } catch {
      /* No cached catalog */
    }
    json<{ groups: Entity[]; teachers: Entity[] }>(
      "/api/catalog",
      controller.signal,
    )
      .then((c) => {
        setCatalog(c);
        try {
          localStorage.setItem("bf-schedule.catalog", JSON.stringify(c));
        } catch {
          /* Storage unavailable */
        }
        setPrefs((p) => ({
          ...p,
          group: c.groups.some((g) => g.id === p.group)
            ? p.group
            : c.groups[0]?.id || "",
          teacher: c.teachers.some((t) => t.id === p.teacher)
            ? p.teacher
            : c.teachers[0]?.id || "",
        }));
      })
      .catch((e) => {
        if (e.name !== "AbortError" && !cached) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (!id || !week) return;
    const controller = new AbortController();
    let active = true;
    const key = `bf-schedule.cache:${prefs.mode}:${id}:${week}`;
    const query = new URLSearchParams({
      mode: prefs.mode,
      id,
      from: week,
      to: end,
    });
    setData(null);
    setLoading(true);
    setError("");
    setOffline(false);
    function fetchData() {
      json<Schedule>(`/api/schedule?${query}`, controller.signal)
        .then((d) => {
          if (!active) return;
          setData(d);
          setOffline(false);
          setError("");
          try {
            localStorage.setItem(key, JSON.stringify(d));
          } catch {
            /* quota */
          }
        })
        .catch((e) => {
          if (!active || e.name === "AbortError") return;
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              setData(JSON.parse(cached));
              setOffline(true);
            } else setError(e.message);
          } catch {
            setError(e.message);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    fetchData();
    const poll = setInterval(fetchData, 180000);
    const online = () => fetchData();
    window.addEventListener("online", online);
    return () => {
      active = false;
      controller.abort();
      clearInterval(poll);
      window.removeEventListener("online", online);
    };
  }, [id, prefs.mode, week, end, reload]);
  const lessons = data?.lessons.filter((l) => l.date === day) || [];
  const currentDay = now ? today(new Date(now)) : "";
  const calPath = `/api/calendar?${new URLSearchParams({ mode: prefs.mode, id })}`;
  function toggleFavorite() {
    setPrefs((p) => ({
      ...p,
      favorites: favorite
        ? p.favorites.filter((f) => !(f.mode === p.mode && f.id === id))
        : [...p.favorites, { mode: p.mode, id }],
    }));
  }
  async function copyCalendar() {
    try {
      await navigator.clipboard.writeText(
        new URL(calPath, window.location.origin).href,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 sm:px-8">
      <header className="flex items-center justify-between border-b border-slate-200 py-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <CalendarDays className="size-6" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">Расписание</p>
            <p className="text-xs text-slate-500">БФ ПНИПУ · Березники</p>
          </div>
        </div>
        <a
          href="http://raspisanie.bf.pstu.ru"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700"
        >
          Источник
          <ArrowUpRight className="size-3.5" />
        </a>
      </header>
      <div className="mb-7 mt-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">
          Учебная неделя
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Всё по расписанию
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Ваши пары, аудитории и преподаватели — в одном месте.
        </p>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[290px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5">
          <Tabs
            value={prefs.mode}
            onValueChange={(mode) => {
              setPrefs((p) => ({ ...p, mode: mode as Mode }));
              setCalendarOpen(false);
            }}
          >
            <TabsList>
              <TabsTrigger value="group">
                <span className="flex items-center gap-2">
                  <GraduationCap className="size-4" />
                  Группа
                </span>
              </TabsTrigger>
              <TabsTrigger value="teacher">
                <span className="flex items-center gap-2">
                  <UserRound className="size-4" />
                  Преподаватель
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-5">
            <Combobox
              entities={entities}
              value={id}
              label={prefs.mode === "group" ? "Ваша группа" : "Преподаватель"}
              onChange={(id) => {
                setPrefs((p) => ({ ...p, [p.mode]: id }));
                setCalendarOpen(false);
              }}
            />
          </div>
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start px-0 text-xs"
            disabled={!id}
            onClick={toggleFavorite}
          >
            <Star
              className={`size-4 ${favorite ? "fill-amber-400 text-amber-500" : ""}`}
            />
            {favorite ? "Убрать из избранного" : "Добавить в избранное"}
          </Button>
          {!!prefs.favorites.length && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium text-slate-400">
                ИЗБРАННОЕ
              </p>
              <div className="flex flex-wrap gap-2">
                {prefs.favorites.map((f) => {
                  const e = (
                    f.mode === "group" ? catalog.groups : catalog.teachers
                  ).find((e) => e.id === f.id);
                  return (
                    e && (
                      <button
                        key={f.mode + f.id}
                        onClick={() =>
                          setPrefs((p) => ({
                            ...p,
                            mode: f.mode,
                            [f.mode]: f.id,
                          }))
                        }
                        className="rounded-lg bg-slate-50 px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-emerald-50"
                      >
                        {e.name}
                      </button>
                    )
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              className="w-full"
              disabled={!id}
              onClick={() => {
                setCalendarOpen(!calendarOpen);
                setCopied(false);
              }}
            >
              <CalendarPlus className="size-4" />В календарь
            </Button>
            {calendarOpen && (
              <div className="mt-3 text-xs leading-relaxed text-slate-500">
                <p>
                  Скопируйте ссылку и добавьте её в календаре как подписку по
                  URL. Простое скачивание — только разовый импорт.
                </p>
                <input
                  aria-label="Ссылка подписки"
                  readOnly
                  value={
                    typeof window === "undefined"
                      ? calPath
                      : new URL(calPath, window.location.origin).href
                  }
                  className="mt-2 w-full rounded border border-slate-200 p-2"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={copyCalendar}
                >
                  {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
                </Button>
                <a className="text-emerald-700 underline" href={calPath}>
                  Скачать .ics
                </a>
              </div>
            )}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-slate-400">
            Время местное, UTC+5.
            <br />
            Данные проверяются каждые 3 часа.
          </p>
        </aside>
        <section className="min-w-0" aria-label="Расписание занятий">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">
                {week
                  ? `${dateLabel(week, { day: "numeric", month: "short" })} — ${dateLabel(end, { day: "numeric", month: "short" })}`
                  : "Загрузка…"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {entity?.name || "Выберите расписание"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                aria-label="Предыдущая неделя"
                disabled={!day}
                onClick={() => setDay(addDays(day, -7))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="px-3 text-xs"
                onClick={() => setDay(today())}
              >
                Сегодня
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Следующая неделя"
                disabled={!day}
                onClick={() => setDay(addDays(day, 7))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {week &&
              Array.from({ length: 7 }, (_, i) => {
                const d = addDays(week, i);
                const has = data?.lessons.some((l) => l.date === d);
                return (
                  <button
                    key={d}
                    aria-pressed={d === day}
                    onClick={() => setDay(d)}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-3 transition-colors ${d === day ? "border-emerald-700 bg-emerald-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-400"}`}
                  >
                    <span className="text-[11px] capitalize">
                      {dateLabel(d, { weekday: "short" })}
                    </span>
                    <span
                      className={`text-lg font-semibold ${d === currentDay && d !== day ? "text-emerald-700" : ""}`}
                    >
                      {d.slice(8).replace(/^0/, "")}
                    </span>
                    <span
                      className={`size-1 rounded-full ${has ? (d === day ? "bg-white" : "bg-emerald-500") : "bg-transparent"}`}
                    />
                  </button>
                );
              })}
          </div>
          <div className="mb-4 mt-5 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold capitalize">
              {day &&
                dateLabel(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
            </h3>
            <input
              aria-label="Выбрать дату"
              type="date"
              value={day}
              onChange={(e) => {
                if (e.target.value) setDay(e.target.value);
              }}
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500"
            />
          </div>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              {error}
              <Button
                variant="outline"
                className="mt-3 block"
                onClick={() => setReload((r) => r + 1)}
              >
                Повторить загрузку
              </Button>
            </div>
          )}
          {data && (offline || data.stale || !data.covered) && (
            <p
              role="status"
              className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"
            >
              {offline && <WifiOff className="size-4 shrink-0" />}
              {offline
                ? "Нет соединения. Показано сохранённое расписание."
                : !data.covered
                  ? "Этот период ещё не полностью загружен. Отсутствие пар не означает, что занятий нет."
                  : "Данные давно не обновлялись. Проверьте изменения на сайте-источнике."}
            </p>
          )}
          <div aria-live="polite" aria-busy={loading} className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                <RefreshCw className="mx-auto mb-3 size-5 animate-spin" />
                Загружаем пары…
              </div>
            ) : !error && !lessons.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <CalendarDays className="mx-auto mb-3 size-8 text-slate-300" />
                <p className="font-semibold">
                  {data?.covered ? "На этот день пар нет" : "Пока нет данных"}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {data?.covered
                    ? "Можно выбрать другой день или неделю."
                    : "Попробуйте текущую неделю или обновите расписание."}
                </p>
              </div>
            ) : (
              lessons.map((l) => {
                const start = lessonInstant(l.date, l.timeStart);
                const finish = lessonInstant(l.date, l.timeEnd);
                const running = now >= start && now < finish;
                const passed = now >= finish;
                return (
                  <article
                    key={l.id}
                    className={`relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5 ${running ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-200"}`}
                  >
                    <div className="flex gap-4">
                      <div className="w-14 shrink-0 border-r border-slate-100 pr-3">
                        <p
                          className={`text-base font-bold ${passed ? "text-slate-400" : ""}`}
                        >
                          {l.timeStart.slice(0, 5)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {l.timeEnd.slice(0, 5)}
                        </p>
                        <p className="mt-3 text-[11px] text-slate-400">
                          {l.lessonNumber === 0
                            ? "Вне сетки"
                            : `${l.lessonNumber} пара`}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-1 text-[11px] font-medium ${colors[l.lessonType]}`}
                          >
                            {l.lessonType === "other"
                              ? l.sourceType || labels.other
                              : labels[l.lessonType]}
                          </span>
                          {running && (
                            <span className="text-[11px] font-semibold text-emerald-700">
                              ● Идёт сейчас · ещё{" "}
                              {Math.ceil((finish - now) / 60000)} мин
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-semibold leading-snug">
                          {l.subject}
                        </h4>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="size-3.5" />
                            {l.classroom || "Аудитория не указана"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <UserRound className="size-3.5 shrink-0" />
                            {prefs.mode === "teacher"
                              ? l.group
                              : l.teacher || "Преподаватель не указан"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {running && (
                      <div
                        role="progressbar"
                        aria-label="Время пары"
                        aria-valuenow={Math.round(
                          ((now - start) / (finish - start)) * 100,
                        )}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="absolute bottom-0 left-0 h-1 bg-emerald-500"
                        style={{
                          width: `${((now - start) / (finish - start)) * 100}%`,
                        }}
                      />
                    )}
                  </article>
                );
              })
            )}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 text-[11px] text-slate-400">
            <span>
              {data?.updatedAt
                ? `Проверено: ${new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data.updatedAt))}`
                : "Ожидаем данные источника"}
            </span>
            <button
              onClick={() => setReload((r) => r + 1)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-700"
            >
              <RefreshCw className="size-3" />
              Обновить
            </button>
          </div>
        </section>
      </div>
      <footer className="mt-10 border-t border-slate-200 pt-5 text-xs leading-relaxed text-slate-400">
        Неофициальный сервис. Расписание формируется диспетчерской БФ ПНИПУ;
        изменения появляются после синхронизации.
      </footer>
    </main>
  );
}
