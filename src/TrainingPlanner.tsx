import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Dumbbell,
  ExternalLink,
  Heart,
  Leaf,
  Settings2,
  Wind,
} from "lucide-react";
import { localDate, parseTrainingPreferences } from "./lib";
import type { Profile, TrainingPreferences } from "./types";
import {
  generateDailyWorkout,
  generateWeekWorkouts,
  workoutMoveById,
  type WorkoutBlock,
  type WorkoutPrescription,
} from "./workout-planner";

interface TrainingPlannerProps {
  profile: Profile | null;
  date: string;
  preferences: TrainingPreferences;
  completedDates: string[];
  onDateChange: (date: string) => void;
  onSavePreferences: (preferences: TrainingPreferences) => void;
  onToggleComplete: (date: string) => void;
  onRecordActivity: (activityId?: string, minutes?: number) => void;
}

const goalNames: Record<Profile["goal"], string> = {
  lose: "温和减脂",
  maintain: "保持状态",
  gain: "逐步增重",
  strictLoss: "严格减脂塑形",
  extremeLoss: "极限减脂",
};

const equipmentNames: Record<TrainingPreferences["equipment"], string> = {
  none: "徒手训练",
  dumbbells: "哑铃训练",
  gym: "健身房器械",
};

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const phaseIcons = {
  warmup: Wind,
  strength: Dumbbell,
  cardio: Heart,
  mobility: Leaf,
  cooldown: Wind,
};

function dayLabel(date: string) {
  return weekdayNames[new Date(`${date}T12:00:00`).getDay()];
}

function shortDate(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}/${day}`;
}

function fullDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year} 年 ${month} 月 ${day} 日 ${dayLabel(date)}`;
}

function schedule(start: string, duration: number) {
  const [hours, minutes] = start.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + duration;
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return `${start}–${end}`;
}

function prescriptionText(prescription: WorkoutPrescription) {
  const parts: string[] = [];
  if (prescription.sets) parts.push(`${prescription.sets} 组`);
  if (prescription.reps) parts.push(`每组 ${prescription.reps}`);
  if (prescription.seconds) {
    parts.push(`${prescription.sets ? "每组 " : ""}${prescription.seconds} 秒`);
  }
  if (prescription.restSeconds) {
    parts.push(`组间休息 ${prescription.restSeconds} 秒`);
  }
  return parts.join(" · ");
}

/** Mixed blocks open the activity picker so their MET is never guessed. */
function blockActivityId(block: WorkoutBlock) {
  const ids = block.moves.map(
    (move) => workoutMoveById[move.moveId]?.activityId,
  );
  if (!ids.length || ids.some((id) => !id)) return undefined;
  return ids.every((id) => id === ids[0]) ? ids[0] : undefined;
}

export default function TrainingPlanner({
  profile,
  date,
  preferences,
  completedDates,
  onDateChange,
  onSavePreferences,
  onToggleComplete,
  onRecordActivity,
}: TrainingPlannerProps) {
  const [draft, setDraft] = useState<TrainingPreferences>(preferences);
  const [formMessage, setFormMessage] = useState("");
  const [formHasError, setFormHasError] = useState(false);
  const workout = useMemo(
    () => generateDailyWorkout(profile, preferences, date),
    [profile, preferences, date],
  );
  const week = useMemo(
    () => generateWeekWorkouts(profile, preferences, date),
    [profile, preferences, date],
  );
  const today = localDate();
  const completed = completedDates.includes(date);
  const isRecovery = workout.totalMinutes === 0;

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  function updateDraft<K extends keyof TrainingPreferences>(
    key: K,
    value: TrainingPreferences[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFormMessage("");
  }

  function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const parsed = parseTrainingPreferences(draft);
      onSavePreferences(parsed);
      setDraft(parsed);
      setFormHasError(false);
      setFormMessage("训练偏好已保存，计划已更新。");
    } catch (error) {
      setFormHasError(true);
      setFormMessage(
        error instanceof Error ? error.message : "请检查训练偏好后再保存。",
      );
    }
  }

  return (
    <div className="training-planner">
      <div className="planner-intro">
        <div className="planner-heading">
          <span className="eyebrow">YOUR DAILY TRAINING</span>
          <h2>每天练什么，清楚安排好</h2>
          <p>查看当天动作、训练时长与教学，一步一步完成自己的节奏。</p>
        </div>
        <label className="field planner-date" htmlFor="planner-date">
          <span>查看训练日期</span>
          <input
            id="planner-date"
            type="date"
            min="1900-01-01"
            max="2199-12-31"
            value={date}
            onChange={(event) => {
              const nextDate = event.target.value;
              if (
                nextDate &&
                nextDate >= "1900-01-01" &&
                nextDate <= "2199-12-31"
              ) {
                onDateChange(nextDate);
              }
            }}
          />
        </label>
      </div>

      <p className="planner-goal-note">
        <Leaf size={16} aria-hidden="true" />
        {profile
          ? `当前目标：${goalNames[profile.goal]}。结合你的身体档案和已保存偏好安排训练。`
          : "先按已保存的训练偏好安排；保存身体档案后，计划会结合你的目标调整。"}
      </p>

      <details className="planner-preferences card">
        <summary className="planner-preferences-summary">
          <Settings2 size={18} aria-hidden="true" />
          <span>调整训练偏好</span>
          <span className="planner-preference-summary">
            {equipmentNames[preferences.equipment]} ·{" "}
            {preferences.experience === "beginner" ? "新手" : "有训练基础"} ·{" "}
            {preferences.sessionMinutes} 分钟
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <form className="planner-preferences-form" onSubmit={savePreferences}>
          <div className="form-grid">
            <label className="field" htmlFor="planner-equipment">
              <span>训练场地与器械</span>
              <select
                id="planner-equipment"
                value={draft.equipment}
                onChange={(event) =>
                  updateDraft(
                    "equipment",
                    event.target.value as TrainingPreferences["equipment"],
                  )
                }
              >
                <option value="gym">健身房器械</option>
                <option value="dumbbells">家中哑铃</option>
                <option value="none">徒手，无器械</option>
              </select>
            </label>
            <label className="field" htmlFor="planner-experience">
              <span>训练经验</span>
              <select
                id="planner-experience"
                value={draft.experience}
                onChange={(event) =>
                  updateDraft(
                    "experience",
                    event.target.value as TrainingPreferences["experience"],
                  )
                }
              >
                <option value="beginner">新手，先熟悉动作</option>
                <option value="regular">有规律训练经验</option>
              </select>
            </label>
            <label className="field" htmlFor="planner-minutes">
              <span>每天可用时长</span>
              <select
                id="planner-minutes"
                value={draft.sessionMinutes}
                onChange={(event) =>
                  updateDraft(
                    "sessionMinutes",
                    Number(
                      event.target.value,
                    ) as TrainingPreferences["sessionMinutes"],
                  )
                }
              >
                {[20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} 分钟
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="planner-start-time">
              <span>希望开始的时间</span>
              <input
                id="planner-start-time"
                type="time"
                required
                value={draft.preferredStartTime}
                onChange={(event) =>
                  updateDraft("preferredStartTime", event.target.value)
                }
              />
            </label>
            <label className="field" htmlFor="planner-unavailable-start">
              <span>不可训练时段：开始</span>
              <input
                id="planner-unavailable-start"
                type="time"
                value={draft.unavailableStart}
                onChange={(event) =>
                  updateDraft("unavailableStart", event.target.value)
                }
              />
              <small>不需要限制时段时，两项都留空。</small>
            </label>
            <label className="field" htmlFor="planner-unavailable-end">
              <span>不可训练时段：结束</span>
              <input
                id="planner-unavailable-end"
                type="time"
                value={draft.unavailableEnd}
                onChange={(event) =>
                  updateDraft("unavailableEnd", event.target.value)
                }
              />
            </label>
          </div>
          <fieldset className="planner-checkbox-grid">
            <legend>动作偏好</legend>
            <label className="planner-checkbox" htmlFor="planner-avoid-impact">
              <input
                id="planner-avoid-impact"
                type="checkbox"
                checked={draft.avoidImpact}
                onChange={(event) =>
                  updateDraft("avoidImpact", event.target.checked)
                }
              />
              <span>避免跑跳与冲击</span>
            </label>
            <label className="planner-checkbox" htmlFor="planner-avoid-knee">
              <input
                id="planner-avoid-knee"
                type="checkbox"
                checked={draft.avoidKneeLoad}
                onChange={(event) =>
                  updateDraft("avoidKneeLoad", event.target.checked)
                }
              />
              <span>减少膝盖负荷</span>
            </label>
            <label className="planner-checkbox" htmlFor="planner-avoid-wrist">
              <input
                id="planner-avoid-wrist"
                type="checkbox"
                checked={draft.avoidWristLoad}
                onChange={(event) =>
                  updateDraft("avoidWristLoad", event.target.checked)
                }
              />
              <span>避免手腕承重</span>
            </label>
            <label
              className="planner-checkbox"
              htmlFor="planner-avoid-overhead"
            >
              <input
                id="planner-avoid-overhead"
                type="checkbox"
                checked={draft.avoidOverhead}
                onChange={(event) =>
                  updateDraft("avoidOverhead", event.target.checked)
                }
              />
              <span>避免过头动作</span>
            </label>
          </fieldset>
          <div className="planner-preferences-actions">
            <button type="submit" className="btn btn-primary">
              <Check size={16} aria-hidden="true" />
              保存训练偏好
            </button>
            <p className="planner-form-message" aria-live="polite">
              未保存的调整不会改变当前计划。
            </p>
          </div>
          {formMessage && (
            <p
              className={`planner-form-message ${formHasError ? "error" : "success"}`}
              role={formHasError ? "alert" : "status"}
            >
              {formMessage}
            </p>
          )}
        </form>
      </details>

      <div className="planner-week-header">
        <h3>本周训练安排</h3>
        {week.length > 0 && (
          <span>
            {shortDate(week[0].date)}–{shortDate(week[week.length - 1].date)}
          </span>
        )}
      </div>
      <div
        className="planner-week-grid"
        role="group"
        aria-label="选择本周训练日期"
      >
        {week.map((day) => {
          const selected = day.date === date;
          const done = completedDates.includes(day.date);
          const rest = day.totalMinutes === 0;
          return (
            <button
              key={day.date}
              type="button"
              className={`planner-day-card${selected ? " selected" : ""}${done ? " completed" : ""}${rest ? " rest" : ""}`}
              aria-pressed={selected}
              aria-current={day.date === today ? "date" : undefined}
              aria-label={`${fullDate(day.date)}，${day.title}，${rest ? "恢复日" : `${day.totalMinutes} 分钟`}${done ? "，已完成" : ""}`}
              onClick={() => onDateChange(day.date)}
            >
              <span className="planner-day-label">{dayLabel(day.date)}</span>
              <span className="planner-day-date">{shortDate(day.date)}</span>
              <span className="planner-day-title">{day.title}</span>
              <span className="planner-day-meta">
                {rest ? "休息与恢复" : `${day.totalMinutes} 分钟`}
              </span>
              <span className="planner-day-meta">
                {rest
                  ? "自由安排"
                  : schedule(preferences.preferredStartTime, day.totalMinutes)}
              </span>
              <span className="planner-day-status">
                {done ? (
                  <>
                    <CheckCircle2 size={13} aria-hidden="true" />
                    已完成
                  </>
                ) : selected ? (
                  "正在查看"
                ) : day.date === today ? (
                  "今天"
                ) : (
                  "查看计划"
                )}
              </span>
            </button>
          );
        })}
      </div>

      <section
        className="planner-session card"
        aria-labelledby="planner-session-title"
      >
        <div className="planner-session-header">
          <div>
            <span className="eyebrow">{fullDate(date)}</span>
            <h3 id="planner-session-title">{workout.title}</h3>
            <p>{workout.focus}</p>
          </div>
          <div className="planner-session-badges">
            <span className="planner-badge">
              <Clock3 size={15} aria-hidden="true" />
              {isRecovery ? "恢复日" : `${workout.totalMinutes} 分钟`}
            </span>
            <span className="planner-badge">
              {isRecovery ? "放松恢复" : `${workout.intensity}强度`}
            </span>
          </div>
        </div>
        {!isRecovery && (
          <p className="planner-schedule">
            <Clock3 size={16} aria-hidden="true" />
            建议时段{" "}
            {schedule(preferences.preferredStartTime, workout.totalMinutes)}
            {preferences.unavailableStart &&
              preferences.unavailableEnd &&
              ` · 避开 ${preferences.unavailableStart}–${preferences.unavailableEnd}`}
          </p>
        )}
        <p className="planner-session-note">{workout.explanation}</p>
        {preferences.avoidKneeLoad && (
          <p className="planner-session-note">
            已减少膝盖负荷，避开深蹲、腿举与跑跳。这是日常训练参考；若膝盖疼痛或肿胀，停止相关动作并寻求专业评估。
          </p>
        )}
        <div className="planner-completion">
          <button
            type="button"
            className={`btn ${completed ? "btn-secondary" : "btn-primary"}`}
            aria-pressed={completed}
            onClick={() => onToggleComplete(date)}
          >
            {completed ? (
              <CheckCircle2 size={17} aria-hidden="true" />
            ) : (
              <Check size={17} aria-hidden="true" />
            )}
            {completed
              ? "已完成 · 点击撤销"
              : date === today
                ? "标记今天完成"
                : "标记这天完成"}
          </button>
          <span>完成标记只记进度。运动消耗请按实际情况单独记录。</span>
        </div>

        {isRecovery ? (
          <div className="planner-recovery">
            <div className="planner-recovery-icon">
              <Leaf size={28} aria-hidden="true" />
            </div>
            <h4>把恢复也留在计划里</h4>
            <p>今天不安排正式训练。保持正常生活节奏，给肌肉和关节充分休息。</p>
            <p>
              身体舒适时，可自选平地轻松散步；膝盖不适就休息，不必补练或追赶进度。
            </p>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => onRecordActivity()}
            >
              记录实际运动
            </button>
          </div>
        ) : (
          <div className="planner-block-list">
            {workout.blocks.map((block, blockIndex) => {
              const PhaseIcon = phaseIcons[block.phase];
              return (
                <section
                  key={block.id}
                  className="planner-block"
                  aria-labelledby={`planner-block-${block.id}`}
                >
                  <div className="planner-block-header">
                    <span className="planner-block-icon">
                      <PhaseIcon size={19} aria-hidden="true" />
                    </span>
                    <div className="planner-block-heading">
                      <span>
                        STEP {String(blockIndex + 1).padStart(2, "0")}
                      </span>
                      <h4 id={`planner-block-${block.id}`}>{block.title}</h4>
                    </div>
                    <span className="planner-block-duration">
                      {block.minutes} 分钟
                    </span>
                    <button
                      type="button"
                      className="planner-record-button btn btn-secondary"
                      aria-label={`记录${block.title}的实际运动`}
                      onClick={() =>
                        onRecordActivity(blockActivityId(block), block.minutes)
                      }
                    >
                      记录实际运动
                    </button>
                  </div>
                  <div className="planner-move-list">
                    {block.moves.map((prescription, moveIndex) => {
                      const move = workoutMoveById[prescription.moveId];
                      if (!move) return null;
                      return (
                        <article
                          className="planner-move"
                          key={`${prescription.moveId}-${moveIndex}`}
                        >
                          <div className="planner-move-heading">
                            <h5>{move.name}</h5>
                            <a
                              className="planner-video-link"
                              href={move.teachingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {move.teachingLabel}
                              <ExternalLink size={14} aria-hidden="true" />
                            </a>
                          </div>
                          <p className="planner-prescription">
                            {prescriptionText(prescription)}
                          </p>
                          <details className="planner-move-details">
                            <summary>
                              查看动作步骤与要点
                              <ChevronDown size={15} aria-hidden="true" />
                            </summary>
                            <ol className="planner-steps">
                              {move.instructions.map((instruction, index) => (
                                <li key={index}>{instruction}</li>
                              ))}
                            </ol>
                            {move.cues.length > 0 && (
                              <ul className="planner-cues">
                                {move.cues.map((cue, index) => (
                                  <li key={index}>{cue}</li>
                                ))}
                              </ul>
                            )}
                          </details>
                          {prescription.alternative && (
                            <p className="planner-move-alternative">
                              调整方式：{prescription.alternative}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        <p className="planner-record-note">
          计划时长包含组间休息与动作转换。记录按钮会打开运动记录，请确认实际项目和运动分钟数后保存。
          教学链接为哔哩哔哩动作教学搜索，可选择讲解清楚、适合自己器械的视频。
        </p>
      </section>
    </div>
  );
}
