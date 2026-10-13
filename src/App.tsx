import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity as ActivityIcon,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Flame,
  Heart,
  Leaf,
  LayoutDashboard,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  Utensils,
  X,
} from "lucide-react";
import { foods, activities, foodCategories, activityCategories } from "./data";
import {
  STORAGE_KEY,
  emptyState,
  loadState,
  parseState,
  localDate,
  shiftDate,
  calculateBudget,
  exerciseCalories,
  makeFoodLog,
  makeExerciseLog,
  summarize,
  validateProfile,
} from "./lib";
import type { AppState, Activity, Food, Meal, Profile } from "./types";
import CustomFoodForm from "./CustomFoodForm";
import { searchFoods } from "./food-search";

type View = "overview" | "diary" | "exercise" | "library" | "profile";
type Modal =
  { kind: "food"; selected?: Food } | { kind: "exercise"; selected?: Activity };
const meals: Meal[] = ["早餐", "午餐", "晚餐", "加餐"];
const mealEmojis = ["🌤️", "🍲", "🌙", "🍎"];
const navItems = [
  { id: "overview" as View, label: "今日概览", icon: LayoutDashboard },
  { id: "diary" as View, label: "饮食记录", icon: Utensils },
  { id: "exercise" as View, label: "运动记录", icon: ActivityIcon },
  { id: "library" as View, label: "食物图鉴", icon: BookOpen },
  { id: "profile" as View, label: "身体档案", icon: Settings2 },
];
const fmt = (n: number) => Math.round(n).toLocaleString("zh-CN");
const decimal = (n: number) => Number(n.toFixed(1));
const dateText = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob(
      [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [initial] = useState(() => {
    try {
      return { state: loadState(), error: "" };
    } catch (e) {
      return {
        state: emptyState(),
        error: e instanceof Error ? e.message : "本地数据读取失败",
      };
    }
  });
  const [state, setState] = useState<AppState>(initial.state);
  const [storageIssue, setStorageIssue] = useState(initial.error);
  const [view, setView] = useState<View>("overview");
  const [date, setDate] = useState(localDate());
  const [modal, setModal] = useState<Modal | null>(null);
  const [customEntry, setCustomEntry] = useState<"library" | "record" | null>(
    null,
  );
  const [modalMeal, setModalMeal] = useState<Meal>("早餐");
  const [toast, setToast] = useState("");
  const [foodQuery, setFoodQuery] = useState("");
  const [foodCategory, setFoodCategory] = useState("全部");
  const [activityQuery, setActivityQuery] = useState("");
  const [activityCategory, setActivityCategory] = useState("全部");
  const importRef = useRef<HTMLInputElement>(null);
  const today = localDate();
  const availableFoods = useMemo(
    () => [...state.customFoods, ...foods],
    [state.customFoods],
  );
  const summary = useMemo(
    () => summarize(state.foodLogs, state.exerciseLogs, date),
    [state, date],
  );
  const budget = state.profile ? calculateBudget(state.profile) : null;
  const target = budget?.target ?? 2000;
  const remaining = target + summary.exercise - summary.intake;
  const totalBurn = (budget?.maintenance ?? 0) + summary.exercise;
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (storageIssue) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setStorageIssue("浏览器无法保存数据。当前记录暂存在内存中，请导出备份。");
    }
  }, [state, storageIssue]);
  const openFood = (food?: Food, meal?: Meal) => {
    setModalMeal(
      meal ??
        (new Date().getHours() < 10
          ? "早餐"
          : new Date().getHours() < 16
            ? "午餐"
            : "晚餐"),
    );
    setModal({ kind: "food", selected: food });
  };
  const deleteFood = (id: string) => {
    setState((s) => ({
      ...s,
      foodLogs: s.foodLogs.filter((l) => l.id !== id),
    }));
    notify("已删除这条饮食记录");
  };
  const deleteExercise = (id: string) => {
    setState((s) => ({
      ...s,
      exerciseLogs: s.exerciseLogs.filter((l) => l.id !== id),
    }));
    notify("已删除这条运动记录");
  };
  const exportData = () => {
    downloadJson(state, `轻盈备份-${localDate()}.json`);
    notify("备份已导出，请妥善保管");
  };
  const importData = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("文件过大，请选择小于 5 MB 的轻盈备份");
      const data = parseState(JSON.parse(await file.text()));
      if (
        !window.confirm(
          `导入 ${data.foodLogs.length} 条饮食记录、${data.exerciseLogs.length} 条运动记录和 ${data.customFoods.length} 项自定义食物？这将替换当前数据，建议先导出备份。`,
        )
      )
        return;
      setState(data);
      setStorageIssue("");
      notify("数据已成功导入");
    } catch (e) {
      notify(
        e instanceof Error
          ? `导入失败：${e.message}`
          : "导入失败，请检查备份文件",
      );
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };
  const allFoodMatches = searchFoods(availableFoods, foodQuery);
  const foodMatches = allFoodMatches.filter(
    (f) => foodCategory === "全部" || f.category === foodCategory,
  );
  const activityMatches = activities.filter(
    (a) =>
      (activityCategory === "全部" || a.category === activityCategory) &&
      `${a.name} ${a.category} ${a.description}`.includes(activityQuery.trim()),
  );
  const mealRecords = (meal: Meal) =>
    state.foodLogs.filter((l) => l.date === date && l.meal === meal);
  const exerciseRecords = state.exerciseLogs.filter((l) => l.date === date);
  const renderFoodLog = (log: AppState["foodLogs"][number]) => (
    <div className="log-item" key={log.id}>
      <span className="log-emoji">{log.emoji}</span>
      <div className="log-info">
        <strong>{log.name}</strong>
        <small>{decimal(log.grams)} 克</small>
      </div>
      <span className="log-value">
        {fmt(log.kcal)} <small>kcal</small>
      </span>
      <button
        className="icon-button delete-button"
        aria-label={`删除${log.name}记录`}
        onClick={() => deleteFood(log.id)}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
  const renderExerciseLog = (log: AppState["exerciseLogs"][number]) => (
    <div className="log-item" key={log.id}>
      <span className="log-emoji">{log.emoji}</span>
      <div className="log-info">
        <strong>{log.name}</strong>
        <small>
          {log.minutes} 分钟 · {log.weight} kg
        </small>
      </div>
      <span className="log-value">
        −{fmt(log.kcal)} <small>kcal</small>
      </span>
      <button
        className="icon-button delete-button"
        aria-label={`删除${log.name}运动记录`}
        onClick={() => deleteExercise(log.id)}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
  const headings: Record<View, [string, string, string]> = {
    overview: [
      "YOUR DAILY BALANCE",
      "让健康，轻一点。",
      "认真吃饭，好好运动。每一份记录，都是对自己的照顾。",
    ],
    diary: [
      "MINDFUL EATING",
      "每一餐，都好好吃。",
      "记录真实的饮食，让身体获得刚刚好的能量。",
    ],
    exercise: [
      "KEEP MOVING",
      "动起来，找到自己的节奏。",
      "散步、跑步或一场球赛，每一种活动都值得记录。",
    ],
    library: [
      "FOOD, EXPLAINED",
      "食物的另一面。",
      "认识日常食物的能量和营养，吃得更明白。",
    ],
    profile: [
      "MADE FOR YOU",
      "从了解自己开始。",
      "让热量预算，适合你的身体和生活方式。",
    ],
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳转到主要内容
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => setView("overview")}
          aria-label="轻盈首页"
        >
          <span className="brand-mark">
            <Leaf size={25} />
          </span>
          <span className="brand-name">
            轻盈<small>LIGHTLY</small>
          </span>
        </button>
        <div className="nav-label">我的健康空间</div>
        <nav aria-label="主导航">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {view === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-leaves">
            <Leaf size={38} strokeWidth={1.2} />
            <Leaf size={22} strokeWidth={1.2} />
          </div>
          <strong>小小改变，慢慢发生。</strong>
          <p>
            健康不是一场冲刺，
            <br />
            而是每一天的温柔坚持。
          </p>
        </div>
        <div className="sidebar-bottom">
          <ShieldCheck size={16} />
          <span>数据仅保存在此浏览器</span>
        </div>
      </aside>
      <main className="main-shell" id="main-content">
        <div className="topbar">
          <div className="breadcrumb">
            我的健康空间 <ChevronRight size={13} />
            <span>{navItems.find((n) => n.id === view)?.label}</span>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <span /> 本地记录
            </span>
            <button
              className="avatar"
              onClick={() => setView("profile")}
              aria-label="打开身体档案"
            >
              <Leaf size={18} />
            </button>
          </div>
        </div>
        <header className="page-header">
          <div>
            <div className="eyebrow">{headings[view][0]}</div>
            <h1>{headings[view][1]}</h1>
            <p>{headings[view][2]}</p>
          </div>
          <div className="header-actions">
            {view !== "profile" && (
              <button
                className="button primary"
                onClick={() =>
                  view === "exercise"
                    ? setModal({ kind: "exercise" })
                    : openFood()
                }
              >
                <Plus size={18} />
                {view === "exercise" ? "记录运动" : "记录饮食"}
              </button>
            )}
          </div>
        </header>
        {storageIssue && (
          <div className="notice storage-notice" role="alert">
            <strong>本地保存需要处理</strong>
            <p>{storageIssue} 不会自动覆盖原有备份。</p>
            <div className="data-actions">
              <button
                className="button secondary"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    downloadJson(raw ?? state, `轻盈原始备份-${today}.json`);
                  } catch {
                    notify(
                      "无法读取原始存储，请使用「导出当前记录」保存本次数据",
                    );
                  }
                }}
              >
                导出原始备份
              </button>
              <button className="button secondary" onClick={exportData}>
                导出当前记录
              </button>
              <button
                className="button ghost"
                onClick={() => {
                  if (window.confirm("确定重置本地数据？请先导出备份。")) {
                    try {
                      localStorage.removeItem(STORAGE_KEY);
                      setState(emptyState());
                      setStorageIssue("");
                    } catch {
                      notify(
                        "浏览器禁止访问本地存储，重置失败；当前记录已保留",
                      );
                    }
                  }
                }}
              >
                重置本地数据
              </button>
            </div>
          </div>
        )}
        {view !== "profile" && view !== "library" && (
          <div className="section-heading daily-heading">
            <h2>
              {date === today ? "今天" : dateText(date)}
              <span className="heading-date">
                {date === today ? dateText(date) : "查看这一天的记录"}
              </span>
            </h2>
            <div className="date-control">
              <button
                className="icon-button"
                aria-label="前一天"
                disabled={date === "1900-01-01"}
                onClick={() => setDate(shiftDate(date, -1))}
              >
                <ChevronLeft size={17} />
              </button>
              <input
                type="date"
                min="1900-01-01"
                max="2199-12-31"
                value={date}
                aria-label="选择记录日期"
                onChange={(e) => {
                  if (!e.target.value) return;
                  try {
                    setDate(shiftDate(e.target.value, 0));
                  } catch {
                    notify("请选择 1900 至 2199 年之间的有效日期");
                  }
                }}
              />
              <button
                className="icon-button"
                aria-label="后一天"
                disabled={date === "2199-12-31"}
                onClick={() => setDate(shiftDate(date, 1))}
              >
                <ChevronRight size={17} />
              </button>
              {date !== today && (
                <button className="today-button" onClick={() => setDate(today)}>
                  今天
                </button>
              )}
            </div>
          </div>
        )}
        {view === "overview" && (
          <>
            {!state.profile && (
              <div className="onboarding-banner">
                <div className="banner-icon">
                  <Leaf size={22} />
                </div>
                <div className="banner-copy">
                  <strong>为你量身计算，每天需要多少能量</strong>
                  <p>填写身高、体重和体脂率，获得基础代谢与个性化热量预算。</p>
                </div>
                <button
                  className="button ghost"
                  onClick={() => setView("profile")}
                >
                  完善身体档案 <ArrowRight size={16} />
                </button>
              </div>
            )}
            <div className="dashboard-grid">
              <section className="card energy-card">
                <div className="card-header">
                  <h2>
                    <Flame size={18} /> 今日能量
                  </h2>
                  <span className="subtle-pill">
                    {budget ? "个性化预算" : "参考预算"}
                  </span>
                </div>
                <div className="energy-body">
                  <div className="energy-ring">
                    <svg
                      viewBox="0 0 200 200"
                      aria-label={`摄入 ${fmt(summary.intake)} 千卡，预算 ${fmt(target + summary.exercise)} 千卡`}
                      role="img"
                    >
                      <circle className="ring-track" cx="100" cy="100" r="82" />
                      <circle
                        className="ring-progress"
                        cx="100"
                        cy="100"
                        r="82"
                        strokeDasharray="515.22"
                        strokeDashoffset={
                          515.22 *
                          (1 -
                            Math.min(
                              summary.intake / (target + summary.exercise),
                              1,
                            ))
                        }
                        style={{
                          stroke: remaining < 0 ? "#cd815c" : undefined,
                        }}
                      />
                    </svg>
                    <div className="ring-label">
                      <span>{remaining >= 0 ? "还可摄入" : "已超出预算"}</span>
                      <strong className="ring-number">
                        {fmt(Math.abs(remaining))}
                      </strong>
                      <small className="ring-unit">kcal</small>
                    </div>
                  </div>
                  <div className="energy-breakdown">
                    <div className="metric-row">
                      <span className="metric-icon green">
                        <Utensils size={18} />
                      </span>
                      <div className="metric-copy">
                        <span>饮食摄入</span>
                        <strong className="metric-value">
                          {fmt(summary.intake)}
                          <small> kcal</small>
                        </strong>
                      </div>
                    </div>
                    <div className="metric-row">
                      <span className="metric-icon orange">
                        <ActivityIcon size={18} />
                      </span>
                      <div className="metric-copy">
                        <span>运动消耗</span>
                        <strong className="metric-value">
                          {fmt(summary.exercise)}
                          <small> kcal</small>
                        </strong>
                      </div>
                    </div>
                    <div className="metric-row">
                      <span className="metric-icon beige">
                        <Heart size={18} />
                      </span>
                      <div className="metric-copy">
                        <span>基础代谢</span>
                        <strong className="metric-value">
                          {budget ? fmt(budget.bmr) : "—"}
                          <small> kcal / 天</small>
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="budget-strip">
                  <span>
                    每日热量预算 <strong>{fmt(target)} kcal</strong>
                  </span>
                  <span>
                    预计总消耗{" "}
                    <strong>{budget ? fmt(totalBurn) : "—"} kcal</strong>
                  </span>
                </div>
                <p className="card-footnote">
                  {budget
                    ? "还可摄入 = 每日预算 + 运动净消耗 − 饮食摄入"
                    : "当前为 2,000 kcal 参考值，完善档案后自动更新。"}
                </p>
              </section>
              <section className="card macro-card">
                <div className="card-header">
                  <h2>营养，也要刚刚好</h2>
                  <span className="mini-label">三大营养素</span>
                </div>
                <div className="macro-list">
                  {[
                    {
                      name: "蛋白质",
                      value: summary.protein,
                      target: (state.profile?.weight ?? 60) * 1.2,
                      color: "#7e9b80",
                      label: "身体的修复能量",
                    },
                    {
                      name: "碳水化合物",
                      value: summary.carbs,
                      target: Math.max(
                        0,
                        (target * 0.75 -
                          (state.profile?.weight ?? 60) * 1.2 * 4) /
                          4,
                      ),
                      color: "#d9b56c",
                      label: "日常的活力来源",
                    },
                    {
                      name: "脂肪",
                      value: summary.fat,
                      target: (target * 0.25) / 9,
                      color: "#cb947e",
                      label: "不可或缺的好营养",
                    },
                  ].map((m) => (
                    <div className="macro-row" key={m.name}>
                      <div className="macro-total">
                        <strong>
                          <span style={{ background: m.color }} />
                          {m.name}
                        </strong>
                        <span>
                          {decimal(m.value)} <small>/ {fmt(m.target)} g</small>
                        </span>
                      </div>
                      <div
                        className="macro-track"
                        role="progressbar"
                        aria-label={m.name}
                        aria-valuenow={Math.round(m.value)}
                        aria-valuemin={0}
                        aria-valuemax={Math.max(
                          Math.round(m.target),
                          Math.round(m.value),
                        )}
                      >
                        <div
                          className="macro-fill"
                          style={{
                            width: `${Math.min((m.value / m.target) * 100, 100)}%`,
                            background: m.color,
                          }}
                        />
                      </div>
                      <small className="macro-caption">{m.label}</small>
                    </div>
                  ))}
                </div>
                <div className="inline-note">
                  <CircleHelp size={14} />
                  营养目标为一般参考，可随日常饮食灵活调整。
                </div>
              </section>
            </div>
            <div className="section-heading">
              <h2>
                一日三餐，还有小美好 <span>DAILY MEALS</span>
              </h2>
              <button className="text-button" onClick={() => setView("diary")}>
                全部记录 <ArrowRight size={15} />
              </button>
            </div>
            <div className="meal-grid">
              {meals.map((meal, i) => {
                const records = mealRecords(meal);
                return (
                  <section className="card meal-card" key={meal}>
                    <div className="meal-top">
                      <span className="meal-emoji">{mealEmojis[i]}</span>
                      <h3>{meal}</h3>
                      <span>
                        {fmt(records.reduce((s, r) => s + r.kcal, 0))}
                        <small> kcal</small>
                      </span>
                    </div>
                    {records.length ? (
                      <div className="meal-mini-list">
                        {records.slice(0, 2).map((r) => (
                          <p key={r.id}>
                            <span>
                              {r.emoji} {r.name}
                            </span>
                            <small>{decimal(r.grams)} g</small>
                          </p>
                        ))}
                        {records.length > 2 && (
                          <button
                            className="text-button"
                            onClick={() => setView("diary")}
                          >
                            另有 {records.length - 2} 项
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="meal-empty">留一点时间，好好吃饭</p>
                    )}
                    <button
                      className="meal-add"
                      onClick={() => openFood(undefined, meal)}
                    >
                      <Plus size={15} /> 添加{meal}
                    </button>
                  </section>
                );
              })}
            </div>
            <div className="lower-grid">
              <section className="card week-card">
                <div className="card-header">
                  <h2>看见每一天的坚持</h2>
                  <div className="chart-legend">
                    <span>
                      <i className="intake-dot" />
                      摄入
                    </span>
                    <span>
                      <i className="burn-dot" />
                      总消耗
                    </span>
                  </div>
                </div>
                <WeekChart
                  state={state}
                  date={date}
                  maintenance={budget?.maintenance ?? 0}
                />
                <p className="card-footnote">
                  过去 7 天 · 消耗为当前档案估算的日常消耗 + 已记录运动净消耗
                </p>
              </section>
              <section className="card movement-card">
                <div className="card-header">
                  <h2>今天，也动一动</h2>
                  <button
                    className="icon-button"
                    aria-label="记录运动"
                    onClick={() => setModal({ kind: "exercise" })}
                  >
                    <Plus size={19} />
                  </button>
                </div>
                {exerciseRecords.length ? (
                  <div className="movement-list">
                    {exerciseRecords.slice(0, 3).map(renderExerciseLog)}
                    {exerciseRecords.length > 3 && (
                      <button
                        className="text-button"
                        onClick={() => setView("exercise")}
                      >
                        查看全部运动 <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <ActivityIcon size={30} strokeWidth={1.4} />
                    </span>
                    <strong>给身体一点活力</strong>
                    <p>哪怕是散步，也值得被记录。</p>
                    <button
                      className="button secondary"
                      onClick={() => setModal({ kind: "exercise" })}
                    >
                      <Plus size={15} /> 记录运动
                    </button>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
        {view === "diary" && (
          <>
            <div className="daily-summary card">
              <div>
                <span>今日摄入</span>
                <strong>
                  {fmt(summary.intake)} <small>kcal</small>
                </strong>
              </div>
              <div>
                <span>蛋白质</span>
                <strong>
                  {decimal(summary.protein)} <small>g</small>
                </strong>
              </div>
              <div>
                <span>碳水化合物</span>
                <strong>
                  {decimal(summary.carbs)} <small>g</small>
                </strong>
              </div>
              <div>
                <span>脂肪</span>
                <strong>
                  {decimal(summary.fat)} <small>g</small>
                </strong>
              </div>
            </div>
            <div className="records-panel">
              {meals.map((meal, i) => (
                <section className="card record-group" key={meal}>
                  <div className="record-group-title">
                    <h2>
                      <span>{mealEmojis[i]}</span>
                      {meal}{" "}
                      <small>
                        {fmt(mealRecords(meal).reduce((n, l) => n + l.kcal, 0))}{" "}
                        kcal
                      </small>
                    </h2>
                    <button
                      className="button ghost"
                      onClick={() => openFood(undefined, meal)}
                    >
                      <Plus size={16} /> 添加{meal}
                    </button>
                  </div>
                  {mealRecords(meal).length ? (
                    mealRecords(meal).map(renderFoodLog)
                  ) : (
                    <p className="meal-empty">
                      还没有{meal}记录。选择食物和实际份量，开始记录吧。
                    </p>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
        {view === "exercise" && (
          <>
            <section className="card records-panel exercise-records">
              <div className="card-header">
                <h2>当日活动</h2>
                <span className="subtle-pill">
                  净消耗 {fmt(summary.exercise)} kcal
                </span>
              </div>
              {exerciseRecords.length ? (
                exerciseRecords.map(renderExerciseLog)
              ) : (
                <p className="meal-empty">
                  今天还没有运动记录，从喜欢的活动开始吧。
                </p>
              )}
            </section>
            <div className="section-heading">
              <h2>
                找到你喜欢的运动 <span>{activities.length} 种活动</span>
              </h2>
            </div>
            <div className="catalog-toolbar">
              <label className="search-box">
                <Search size={18} />
                <input
                  placeholder="搜索跑步、游泳、瑜伽…"
                  aria-label="搜索运动"
                  value={activityQuery}
                  onChange={(e) => setActivityQuery(e.target.value)}
                />
                {activityQuery && (
                  <button
                    className="icon-button"
                    aria-label="清空运动搜索"
                    onClick={() => setActivityQuery("")}
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
            </div>
            <div className="category-tabs" aria-label="运动分类">
              {["全部", ...activityCategories].map((c) => (
                <button
                  className={`tab ${activityCategory === c ? "active" : ""}`}
                  aria-pressed={activityCategory === c}
                  key={c}
                  onClick={() => setActivityCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="catalog-grid">
              {activityMatches.map((a) => (
                <article className="catalog-card" key={a.id}>
                  <span className="catalog-emoji activity-emoji">
                    {a.emoji}
                  </span>
                  <div className="catalog-content">
                    <h3 className="catalog-name">{a.name}</h3>
                    <div className="catalog-meta">
                      {a.intensity} · {a.met} MET
                    </div>
                    <small>{a.description}</small>
                  </div>
                  <button
                    className="catalog-add"
                    aria-label={`记录${a.name}`}
                    onClick={() => setModal({ kind: "exercise", selected: a })}
                  >
                    <Plus size={17} />
                  </button>
                </article>
              ))}
            </div>
            {!activityMatches.length && <EmptySearch />}
            <p className="table-note">
              MET 为常见活动的参考强度。净消耗使用 (MET − 1) × 3.5 × 体重 ÷ 200
              ×
              分钟，扣除同一时段静息消耗，避免与基础预算重复计算。运动结果为估算。
            </p>
          </>
        )}
        {view === "library" && (
          <>
            <div className="catalog-toolbar">
              <label className="search-box">
                <Search size={18} />
                <input
                  placeholder="搜索食物或别名，比如提子、地瓜…"
                  aria-label="搜索食物"
                  value={foodQuery}
                  onChange={(e) => {
                    setFoodQuery(e.target.value);
                    setFoodCategory("全部");
                  }}
                />
                {foodQuery && (
                  <button
                    className="icon-button"
                    aria-label="清空食物搜索"
                    onClick={() => setFoodQuery("")}
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <span className="library-count">
                {availableFoods.length} 种食物 · 每 100 克可食部分
              </span>
              <button
                className="button secondary custom-food-button"
                onClick={() => setCustomEntry("library")}
              >
                <Plus size={16} /> 添加自定义食物
              </button>
            </div>
            <div className="category-tabs" aria-label="食物分类">
              {["全部", ...foodCategories, "自定义"].map((c) => (
                <button
                  key={c}
                  className={`tab ${foodCategory === c ? "active" : ""}`}
                  aria-pressed={foodCategory === c}
                  onClick={() => setFoodCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="catalog-grid food-catalog">
              {foodMatches.map((f) => (
                <article className="catalog-card" key={f.id}>
                  <span className="catalog-emoji">{f.emoji}</span>
                  <div className="catalog-content">
                    <h3 className="catalog-name">
                      {f.name}
                      {f.category === "自定义" && (
                        <span className="custom-food-badge">自定义</span>
                      )}
                    </h3>
                    <div className="catalog-meta">
                      <strong>{f.kcal}</strong> kcal <span>/ 100 g</span>
                    </div>
                    <small>
                      蛋白质 {f.protein} · 碳水 {f.carbs} · 脂肪 {f.fat} g
                    </small>
                  </div>
                  <div className="catalog-actions">
                    <button
                      className="catalog-add"
                      aria-label={`记录${f.name}`}
                      onClick={() => openFood(f)}
                    >
                      <Plus size={17} />
                    </button>
                    {f.category === "自定义" && (
                      <button
                        className="icon-button delete-button"
                        aria-label={`删除自定义食物${f.name}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              "删除这个自定义食物？已有饮食记录会保留。",
                            )
                          ) {
                            setState((s) => ({
                              ...s,
                              customFoods: s.customFoods.filter(
                                (item) => item.id !== f.id,
                              ),
                            }));
                            notify("已删除自定义食物，历史记录已保留");
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!foodMatches.length && (
              <div className="custom-food-empty">
                <EmptySearch />
                {foodCategory !== "全部" && allFoodMatches.length > 0 && (
                  <button
                    className="button secondary"
                    onClick={() => setFoodCategory("全部")}
                  >
                    在全部分类查看 {allFoodMatches.length} 项结果
                  </button>
                )}
                <button
                  className="button secondary"
                  onClick={() => setCustomEntry("library")}
                >
                  <Plus size={16} /> 没找到？添加自己的食物
                </button>
              </div>
            )}
            <p className="table-note">
              当前列出全部 {foodMatches.length}{" "}
              项匹配食物。食物数据为参考估算，部分细分水果沿用同类食物通用数据，品种、烹调和品牌会影响实际热量。标注「熟」的食物按熟重记录；包装食品以营养标签为准。
            </p>
          </>
        )}
        {view === "profile" && (
          <>
            <ProfileForm
              key={state.profile ? JSON.stringify(state.profile) : "empty"}
              profile={state.profile}
              onSave={(p) => {
                setState((s) => ({ ...s, profile: p }));
                notify("身体档案已保存，热量预算已更新");
              }}
            />
            <section className="card data-card">
              <div className="card-header">
                <h2>
                  <ShieldCheck size={18} /> 你的数据，由你保管
                </h2>
                <span className="subtle-pill">本地优先</span>
              </div>
              <p className="data-description">
                记录只保存在当前浏览器，不上传服务器。清除浏览器数据或更换设备会丢失记录，请定期导出备份，再在新设备导入。
              </p>
              <div className="data-actions">
                <button className="button secondary" onClick={exportData}>
                  <Download size={16} /> 导出数据
                </button>
                <button
                  className="button secondary"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={16} /> 导入备份
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  className="visually-hidden"
                  aria-label="导入备份文件"
                  onChange={(e) => void importData(e.target.files?.[0])}
                />
                <span>
                  {state.foodLogs.length} 条饮食 · {state.exerciseLogs.length}{" "}
                  条运动记录
                </span>
              </div>
            </section>
          </>
        )}
        <footer className="app-footer">
          <span>轻盈 LIGHTLY</span>
          <span>认真生活，温柔记录。</span>
          <span>所有热量与代谢结果均为估算参考</span>
        </footer>
      </main>
      {modal && (
        <RecordModal
          modal={modal}
          foodCatalog={availableFoods}
          onAddCustom={() => {
            setModal(null);
            setCustomEntry("record");
          }}
          date={date}
          meal={modalMeal}
          weight={state.profile?.weight}
          onClose={() => setModal(null)}
          onFood={(log) => {
            setState((s) => ({ ...s, foodLogs: [...s.foodLogs, log] }));
            notify(`已记录 ${log.name} · ${fmt(log.kcal)} kcal`);
            setModal(null);
          }}
          onExercise={(log) => {
            setState((s) => ({ ...s, exerciseLogs: [...s.exerciseLogs, log] }));
            notify(`已记录 ${log.name} · 消耗 ${fmt(log.kcal)} kcal`);
            setModal(null);
          }}
        />
      )}
      {customEntry && (
        <CustomFoodForm
          onClose={() => {
            if (customEntry === "record") setModal({ kind: "food" });
            setCustomEntry(null);
          }}
          onSave={(food) => {
            if (state.customFoods.length >= 2000)
              throw new Error(
                "自定义食物已达 2,000 项，请先删除不再使用的项目",
              );
            setState((s) => ({ ...s, customFoods: [...s.customFoods, food] }));
            if (customEntry === "record") openFood(food, modalMeal);
            else {
              setFoodCategory("自定义");
              setFoodQuery("");
            }
            setCustomEntry(null);
            notify(`已添加自定义食物：${food.name}`);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
function EmptySearch() {
  return (
    <div className="empty-state search-empty">
      <Search size={28} />
      <strong>没有找到匹配的内容</strong>
      <p>试试换一个关键词，或选择「全部」分类。</p>
    </div>
  );
}
function WeekChart({
  state,
  date,
  maintenance,
}: {
  state: AppState;
  date: string;
  maintenance: number;
}) {
  const days: { day: string; intake: number; burn: number }[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    let day: string;
    try {
      day = shiftDate(date, offset);
    } catch {
      continue;
    }
    const totals = summarize(state.foodLogs, state.exerciseLogs, day);
    days.push({
      day,
      intake: totals.intake,
      burn: maintenance + totals.exercise,
    });
  }
  const max = Math.max(1000, ...days.flatMap((d) => [d.intake, d.burn]));
  return (
    <div
      className="weekly-chart"
      role="img"
      aria-label={days
        .map(
          (d) =>
            `${d.day} 摄入 ${fmt(d.intake)}，消耗 ${maintenance ? fmt(d.burn) : "尚未完善档案"} 千卡`,
        )
        .join("；")}
    >
      {days.map((d) => (
        <div
          className={`chart-day ${d.day === date ? "active" : ""}`}
          key={d.day}
          title={`${d.day} · 摄入 ${fmt(d.intake)} / ${maintenance ? "总" : "运动"}消耗 ${fmt(d.burn)} kcal`}
        >
          <div className="chart-bars">
            <div
              className={`chart-bar intake ${d.intake === 0 ? "zero" : ""}`}
              style={{ height: `${Math.max(2, (d.intake / max) * 100)}%` }}
            />
            <div
              className={`chart-bar burn ${d.burn === 0 ? "zero" : ""}`}
              style={{ height: `${Math.max(2, (d.burn / max) * 100)}%` }}
            />
          </div>
          <span className="chart-label">
            {d.day === localDate()
              ? "今天"
              : new Date(d.day + "T12:00:00").toLocaleDateString("zh-CN", {
                  weekday: "short",
                })}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProfileForm({
  profile,
  onSave,
}: {
  profile: Profile | null;
  onSave: (p: Profile) => void;
}) {
  const [height, setHeight] = useState(profile ? String(profile.height) : "");
  const [weight, setWeight] = useState(profile ? String(profile.weight) : "");
  const [age, setAge] = useState(profile ? String(profile.age) : "");
  const [bodyFat, setBodyFat] = useState(
    profile?.bodyFat != null ? String(profile.bodyFat) : "",
  );
  const [sex, setSex] = useState<Profile["sex"]>(profile?.sex ?? "female");
  const [activityLevel, setActivityLevel] = useState(
    profile?.activityLevel ?? 1.2,
  );
  const [goal, setGoal] = useState<Profile["goal"]>(
    profile?.goal ?? "maintain",
  );
  const [error, setError] = useState("");
  const candidate: Profile = {
    height: Number(height),
    weight: Number(weight),
    age: Number(age),
    bodyFat: bodyFat.trim() ? Number(bodyFat) : null,
    sex,
    activityLevel,
    goal,
  };
  const valid = !validateProfile(candidate);
  const budget = valid ? calculateBudget(candidate) : null;
  const bmi = valid ? candidate.weight / (candidate.height / 100) ** 2 : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const issue = validateProfile(candidate);
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    onSave(candidate);
  };
  return (
    <div className="profile-grid">
      <section className="card profile-form">
        <div className="card-header">
          <h2>你的身体数据</h2>
          <span className="subtle-pill">成人参考 · 18 岁以上</span>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              身高 <span>cm</span>
              <input
                name="height"
                type="number"
                min="100"
                max="250"
                step="0.1"
                required
                placeholder="例如 165"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </label>
            <label className="field">
              体重 <span>kg</span>
              <input
                name="weight"
                type="number"
                min="25"
                max="350"
                step="0.1"
                required
                placeholder="例如 60"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
            <label className="field">
              年龄 <span>岁</span>
              <input
                name="age"
                type="number"
                min="18"
                max="100"
                step="1"
                required
                placeholder="例如 28"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </label>
            <label className="field">
              生理性别
              <select
                name="sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as Profile["sex"])}
              >
                <option value="female">女性</option>
                <option value="male">男性</option>
              </select>
              <small>仅用于代谢公式计算</small>
            </label>
            <label className="field full">
              体脂率 <span>% · 选填</span>
              <input
                name="bodyFat"
                type="number"
                min="3"
                max="65"
                step="0.1"
                placeholder="例如 25；不清楚可以留空"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
              />
              <small>有体脂率时，按去脂体重计算基础代谢。</small>
            </label>
            <label className="field full">
              日常活动水平
              <select
                name="activityLevel"
                value={activityLevel}
                onChange={(e) => setActivityLevel(Number(e.target.value))}
              >
                <option value={1.2}>久坐为主 · 办公、学习，日常走动较少</option>
                <option value={1.375}>轻度活动 · 经常站立，有少量步行</option>
                <option value={1.55}>中度活动 · 工作中经常走动</option>
                <option value={1.725}>高度活动 · 日常体力劳动较多</option>
              </select>
              <small>
                选择不包含单独记录运动的日常活动水平，避免重复计算。
              </small>
            </label>
            <div className="field full">
              <label>当前目标</label>
              <div className="goal-options">
                {(
                  [
                    { value: "lose", label: "温和减脂", icon: ArrowDownLeft },
                    { value: "maintain", label: "保持状态", icon: Heart },
                    { value: "gain", label: "逐步增重", icon: ArrowUpRight },
                  ] as const
                ).map((g) => (
                  <button
                    type="button"
                    className={`goal-option ${goal === g.value ? "selected" : ""}`}
                    key={g.value}
                    aria-pressed={goal === g.value}
                    onClick={() => setGoal(g.value)}
                  >
                    <g.icon size={17} />
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary save-profile" type="submit">
            <Check size={17} /> 保存身体档案
          </button>
        </form>
      </section>
      <div className="profile-right">
        <section className="card formula-card">
          <div className="card-header">
            <h2>你的基础代谢</h2>
            <Heart size={19} />
          </div>
          <p className="formula-intro">即使一整天静静休息，身体也需要能量。</p>
          <div className="formula-result">
            <strong>{budget ? fmt(budget.bmr) : "—"}</strong>
            <span>kcal / 天</span>
          </div>
          <span className="formula-pill">
            {bodyFat.trim()
              ? "Katch–McArdle · 去脂体重公式"
              : "Mifflin–St Jeor · 身高体重公式"}
          </span>
          <div className="formula-details">
            {bodyFat.trim() ? (
              <>
                <strong>370 + 21.6 × 去脂体重</strong>
                <p>
                  去脂体重 = 体重 × (1 − 体脂率 ÷
                  100)。该公式使用体重与体脂率；身高用于 BMI。
                </p>
              </>
            ) : (
              <>
                <strong>10 × 体重 + 6.25 × 身高 − 5 × 年龄 + 性别项</strong>
                <p>
                  男性性别项为 +5，女性为
                  −161。填写体脂率后自动切换为去脂体重公式。
                </p>
              </>
            )}
          </div>
          <div className="profile-stat">
            <span>身体质量指数 BMI</span>
            <strong>{bmi ? bmi.toFixed(1) : "—"}</strong>
          </div>
          <div className="profile-stat">
            <span>日常消耗估算</span>
            <strong>
              {budget ? fmt(budget.maintenance) : "—"} <small>kcal</small>
            </strong>
          </div>
          <div className="profile-stat target-stat">
            <span>每日热量预算</span>
            <strong>
              {budget ? fmt(budget.target) : "—"} <small>kcal</small>
            </strong>
          </div>
          <p className="card-footnote">
            日常消耗 = 基础代谢 × 活动系数。减脂在日常消耗上减 300 kcal，增重加
            250 kcal；预算不低于估算基础代谢。记录运动后会增加当日可摄入预算。
          </p>
        </section>
        <div className="inline-note profile-note">
          <CircleHelp size={17} />
          <p>
            公式适用于一般成人的参考估算，并非测量结果。食物热量、运动强度和体脂测量均存在误差，留意身体感受，建立可持续的习惯。
          </p>
        </div>
      </div>
    </div>
  );
}

function RecordModal({
  modal,
  foodCatalog,
  onAddCustom,
  date,
  meal,
  weight,
  onClose,
  onFood,
  onExercise,
}: {
  modal: Modal;
  foodCatalog: Food[];
  onAddCustom: () => void;
  date: string;
  meal: Meal;
  weight?: number;
  onClose: () => void;
  onFood: (log: AppState["foodLogs"][number]) => void;
  onExercise: (log: AppState["exerciseLogs"][number]) => void;
}) {
  const isFood = modal.kind === "food";
  const [selected, setSelected] = useState<Food | Activity | undefined>(
    modal.selected,
  );
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState(
    String(
      isFood && modal.selected
        ? (modal.selected as Food).portionGrams
        : isFood
          ? 100
          : 30,
    ),
  );
  const [logWeight, setLogWeight] = useState(weight ? String(weight) : "");
  const [logMeal, setLogMeal] = useState(meal);
  const [logDate, setLogDate] = useState(date);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("input, button")?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      const first = focusables[0],
        last = focusables.at(-1);
      if (!dialog.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", listener);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const matches = isFood
    ? searchFoods(foodCatalog, query)
    : activities.filter((a) =>
        `${a.name} ${a.category} ${a.description}`.includes(query.trim()),
      );
  const quantity = Number(amount);
  const weightNum = Number(logWeight);
  const numericValid =
    Number.isFinite(quantity) &&
    quantity >= 0.1 &&
    quantity <= (isFood ? 10000 : 1440) &&
    (isFood ||
      (Number.isFinite(weightNum) && weightNum >= 25 && weightNum <= 350));
  const previewKcal =
    selected && numericValid
      ? isFood
        ? ((selected as Food).kcal * quantity) / 100
        : exerciseCalories((selected as Activity).met, weightNum, quantity)
      : 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError("请先选择一项食物或运动");
      return;
    }
    if (!numericValid) {
      setError(
        isFood
          ? "请输入 0.1 至 10,000 克的食物重量"
          : "请输入有效的运动时长和体重",
      );
      return;
    }
    try {
      if (isFood)
        onFood(makeFoodLog(selected as Food, quantity, logMeal, logDate));
      else
        onExercise(
          makeExerciseLog(selected as Activity, quantity, weightNum, logDate),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "记录失败，请检查输入");
    }
  };
  const select = (item: Food | Activity) => {
    setSelected(item);
    setError("");
    if (isFood) setAmount(String((item as Food).portionGrams));
  };
  const presets =
    selected && isFood
      ? [
          ...new Set([
            100,
            (selected as Food).portionGrams,
            (selected as Food).portionGrams * 0.5,
            (selected as Food).portionGrams * 2,
          ]),
        ]
      : [15, 30, 45, 60];
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-modal-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              {isFood ? "A LITTLE NOURISHMENT" : "A LITTLE MOVEMENT"}
            </span>
            <h2 id="record-modal-title">
              {isFood ? "记录一份好能量" : "记录一次好活动"}
            </h2>
          </div>
          <button
            className="icon-button modal-close"
            aria-label="关闭记录窗口"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {!selected ? (
              <>
                <label className="search-box modal-search">
                  <Search size={18} />
                  <input
                    aria-label={
                      isFood ? "搜索要记录的食物" : "搜索要记录的运动"
                    }
                    placeholder={
                      isFood ? "搜索食物或别名，例如提子…" : "搜索运动名称…"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="清空记录搜索"
                      onClick={(e) => {
                        setQuery("");
                        e.currentTarget
                          .closest("label")
                          ?.querySelector("input")
                          ?.focus();
                      }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <div className="modal-search-meta">
                  {isFood ? "食物库" : "运动库"} · {matches.length} 项结果 ·
                  已显示全部，可向下滚动
                </div>
                {isFood && (
                  <button
                    type="button"
                    className="button ghost custom-food-button"
                    onClick={onAddCustom}
                  >
                    <Plus size={15} /> 库里没有？添加自定义食物
                  </button>
                )}
                <div className="modal-results">
                  {matches.map((item) => (
                    <button
                      type="button"
                      className="modal-result"
                      key={item.id}
                      onClick={() => select(item)}
                    >
                      <span className="modal-result-emoji">{item.emoji}</span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.category}</small>
                      </span>
                      <span className="modal-result-value">
                        {isFood
                          ? `${(item as Food).kcal} kcal / 100g`
                          : `${(item as Activity).met} MET`}
                      </span>
                      <Plus size={17} />
                    </button>
                  ))}
                  {matches.length === 0 && <EmptySearch />}
                </div>
              </>
            ) : (
              <>
                <div className="modal-item">
                  <span className="catalog-emoji">{selected.emoji}</span>
                  <div>
                    <h3>{selected.name}</h3>
                    <small>
                      {isFood
                        ? `${(selected as Food).kcal} kcal / 100g · ${(selected as Food).portion} 约 ${(selected as Food).portionGrams}g`
                        : `${(selected as Activity).met} MET · ${(selected as Activity).description}`}
                    </small>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setSelected(undefined);
                      setQuery("");
                    }}
                  >
                    更换
                  </button>
                </div>
                <div className="form-grid">
                  <label className="field full">
                    {isFood ? "实际食用重量" : "运动时长"}{" "}
                    <span>{isFood ? "克" : "分钟"}</span>
                    <input
                      name="amount"
                      type="number"
                      min="0.1"
                      max={isFood ? 10000 : 1440}
                      step="0.1"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <div className="portion-presets">
                    {presets.map((n) => (
                      <button
                        type="button"
                        key={n}
                        className={`preset ${quantity === n ? "active" : ""}`}
                        onClick={() => setAmount(String(n))}
                      >
                        {n}
                        {isFood ? " 克" : " 分钟"}
                      </button>
                    ))}
                  </div>
                  {isFood ? (
                    <label className="field">
                      计入餐次
                      <select
                        value={logMeal}
                        onChange={(e) => setLogMeal(e.target.value as Meal)}
                      >
                        {meals.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="field">
                      运动时体重 <span>kg</span>
                      <input
                        name="exerciseWeight"
                        type="number"
                        required
                        min="25"
                        max="350"
                        step="0.1"
                        placeholder="请输入体重"
                        value={logWeight}
                        onChange={(e) => setLogWeight(e.target.value)}
                      />
                    </label>
                  )}
                  <label className="field">
                    记录日期
                    <input
                      type="date"
                      min="1900-01-01"
                      max="2199-12-31"
                      required
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                    />
                  </label>
                </div>
                <div className="modal-preview">
                  <div>
                    <small>
                      {isFood ? "这一份食物的能量" : "预计运动净消耗"}
                    </small>
                    <strong>
                      {fmt(previewKcal)} <span>kcal</span>
                    </strong>
                  </div>
                  {isFood && (
                    <div className="preview-macros">
                      <span>
                        蛋白质{" "}
                        <strong>
                          {decimal(
                            ((selected as Food).protein *
                              (numericValid ? quantity : 0)) /
                              100,
                          )}{" "}
                          g
                        </strong>
                      </span>
                      <span>
                        碳水{" "}
                        <strong>
                          {decimal(
                            ((selected as Food).carbs *
                              (numericValid ? quantity : 0)) /
                              100,
                          )}{" "}
                          g
                        </strong>
                      </span>
                      <span>
                        脂肪{" "}
                        <strong>
                          {decimal(
                            ((selected as Food).fat *
                              (numericValid ? quantity : 0)) /
                              100,
                          )}{" "}
                          g
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
                <p className="card-footnote">
                  {isFood
                    ? "份量按可食部分记录，熟食请称熟重。热量为参考估算。"
                    : "已扣除同一时段的静息消耗。实际消耗受运动强度和个人状态影响。"}
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={!selected || !numericValid}
            >
              <Check size={17} />
              {isFood ? "保存饮食记录" : "保存运动记录"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
