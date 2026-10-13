import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, CircleHelp, X } from "lucide-react";
import { makeCustomFood } from "./lib";
import type { Food } from "./types";

interface CustomFoodFormProps {
  onSave: (food: Food) => void;
  onClose: () => void;
}

export default function CustomFoodForm({
  onSave,
  onClose,
}: CustomFoodFormProps) {
  const headingId = useId();
  const introId = useId();
  const nutritionNoteId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("0");
  const [carbs, setCarbs] = useState("0");
  const [fat, setFat] = useState("0");
  const [portionGrams, setPortionGrams] = useState("100");
  const [error, setError] = useState("");

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nameRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const change = (setter: (value: string) => void, value: string) => {
    setter(value);
    if (error) setError("");
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (!name.trim()) throw new Error("请输入食物名称");
      const values = [
        { label: "热量", value: kcal, max: 1000 },
        { label: "蛋白质", value: protein, max: 100 },
        { label: "碳水化合物", value: carbs, max: 100 },
        { label: "脂肪", value: fat, max: 100 },
        { label: "常用份量", value: portionGrams, min: 0.1, max: 2000 },
      ];
      for (const field of values) {
        const numericValue = Number(field.value);
        const minimum = field.min ?? 0;
        if (
          !field.value.trim() ||
          !Number.isFinite(numericValue) ||
          numericValue < minimum ||
          numericValue > field.max
        ) {
          throw new Error(
            `${field.label}请输入 ${minimum} 至 ${field.max} 之间的有效数值`,
          );
        }
      }
      onSave(
        makeCustomFood({
          name: name.trim(),
          kcal: Number(kcal),
          protein: Number(protein),
          carbs: Number(carbs),
          fat: Number(fat),
          portionGrams: Number(portionGrams),
        }),
      );
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : "保存失败，请检查食物信息",
      );
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal custom-food-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={introId}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">YOUR OWN FOOD LIBRARY</span>
            <h2 id={headingId}>添加自定义食物</h2>
          </div>
          <button
            type="button"
            className="icon-button modal-close"
            aria-label="关闭自定义食物窗口"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <p className="custom-food-intro" id={introId}>
              把常吃的包装食品或自己的食谱加入食物库，之后就能直接选择和记录。
            </p>
            <div className="form-grid">
              <label className="field full">
                食物名称 <span>最多 80 字</span>
                <input
                  ref={nameRef}
                  name="customFoodName"
                  aria-label="食物名称"
                  autoComplete="off"
                  required
                  maxLength={80}
                  placeholder="填写食物或品牌名称"
                  value={name}
                  onChange={(event) => change(setName, event.target.value)}
                />
              </label>
              <label className="field full">
                热量 <span>kcal / 每 100 克</span>
                <input
                  name="customFoodKcal"
                  aria-label="每100克热量"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  required
                  placeholder="按营养标签填写"
                  value={kcal}
                  onChange={(event) => change(setKcal, event.target.value)}
                />
                <small>千卡 kcal = 千焦 kJ ÷ 4.184</small>
              </label>
              <label className="field">
                蛋白质 <span>g / 100 克</span>
                <input
                  name="customFoodProtein"
                  aria-label="每100克蛋白质"
                  aria-describedby={nutritionNoteId}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={protein}
                  onChange={(event) => change(setProtein, event.target.value)}
                />
              </label>
              <label className="field">
                碳水化合物 <span>g / 100 克</span>
                <input
                  name="customFoodCarbs"
                  aria-label="每100克碳水化合物"
                  aria-describedby={nutritionNoteId}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={carbs}
                  onChange={(event) => change(setCarbs, event.target.value)}
                />
              </label>
              <label className="field">
                脂肪 <span>g / 100 克</span>
                <input
                  name="customFoodFat"
                  aria-label="每100克脂肪"
                  aria-describedby={nutritionNoteId}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={fat}
                  onChange={(event) => change(setFat, event.target.value)}
                />
              </label>
              <label className="field">
                常用份量 <span>克</span>
                <input
                  name="customFoodPortion"
                  aria-label="常用份量"
                  type="number"
                  min="0.1"
                  max="2000"
                  step="0.1"
                  required
                  value={portionGrams}
                  onChange={(event) =>
                    change(setPortionGrams, event.target.value)
                  }
                />
              </label>
            </div>
            <div className="inline-note custom-food-help">
              <CircleHelp size={16} />
              <div>
                <p id={nutritionNoteId}>
                  按包装每 100 克填写，未知营养素可填
                  0；统计会显示你输入的数值。
                </p>
                <p>缺少热量时请先查包装或可靠资料，不自动猜值。</p>
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
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
            <button type="submit" className="button primary">
              <Check size={17} /> 保存食物
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
