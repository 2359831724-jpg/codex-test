import { shiftDate } from "./lib";
import type { Profile, TrainingPreferences } from "./types";

export interface WorkoutMove {
  id: string;
  name: string;
  instructions: string[];
  cues: string[];
  teachingUrl: string;
  teachingLabel: string;
  activityId?: string;
}

export interface WorkoutPrescription {
  moveId: string;
  sets?: number;
  reps?: string;
  seconds?: number;
  restSeconds?: number;
  alternative?: string;
}

export interface WorkoutBlock {
  id: string;
  phase: "warmup" | "strength" | "cardio" | "mobility" | "cooldown";
  title: string;
  minutes: number;
  moves: WorkoutPrescription[];
}

export interface DailyWorkout {
  date: string;
  title: string;
  focus: string;
  totalMinutes: number;
  blocks: WorkoutBlock[];
  intensity: "轻松" | "中等";
  explanation: string;
}

type PreferenceLoad = "knee" | "wrist" | "overhead" | "impact";
const movementLoads: Record<string, readonly PreferenceLoad[]> = {};

function move(
  id: string,
  name: string,
  instructions: string[],
  cues: string[],
  activityId?: string,
  loads: readonly PreferenceLoad[] = [],
): WorkoutMove {
  movementLoads[id] = loads;
  return {
    id,
    name,
    instructions,
    cues,
    teachingUrl: `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${name} 标准动作 教学`)}`,
    teachingLabel: "哔哩哔哩教学搜索",
    ...(activityId ? { activityId } : {}),
  };
}

/** Links open a named teaching search; individual search results are not verified videos. */
export const workoutMoves: WorkoutMove[] = [
  move(
    "easy-walk",
    "舒适平地慢走",
    [
      "选择平坦、无障碍的路线，先用自然步幅缓慢行走。",
      "保持身体直立、双臂自然摆动，不刻意迈大步。",
      "只在膝部舒适时继续；不舒服就改为坐姿活动或结束这一段。",
    ],
    ["能轻松说完整句子。", "不用坡度或速度补偿训练量。"],
    "walk-slow",
  ),
  move(
    "shoulder-roll",
    "小幅肩部绕环",
    [
      "站立或坐稳，双手自然垂在身体两侧。",
      "肩膀缓慢向后画小圈，再放松回原位。",
      "做几次后暂停，换方向，始终让手臂低于肩膀。",
    ],
    ["不耸肩憋气。", "动作范围以舒适为准。"],
    "stretching",
  ),
  move(
    "ankle-circle",
    "坐姿踝关节绕环",
    [
      "坐在稳固座椅上，背部自然直立。",
      "一只脚轻轻离地，用脚踝画小圈，膝盖保持安静。",
      "顺、逆方向交替，换另一侧；也可脚跟落地做轻缓踝泵。",
    ],
    ["不用手压膝盖或脚踝。", "每轮短暂放松，不追求大幅度。"],
    "stretching",
  ),
  move(
    "standing-rotation",
    "站姿胸椎小幅转动",
    [
      "站稳或坐稳，双臂交叉放在胸前。",
      "骨盆朝前，上背部缓慢向一侧转动。",
      "回到中间，再换另一侧，呼吸保持自然。",
    ],
    ["不快速甩腰。", "不用手臂举过头顶。"],
    "stretching",
  ),
  move(
    "chair-squat",
    "椅子深蹲",
    [
      "使用靠墙、不会滑动的稳固椅子，双脚约与肩同宽。",
      "臀部向后移，膝盖朝脚尖方向，缓慢坐向椅面。",
      "轻触或坐稳后，脚掌均匀发力站起，再慢慢重复。",
    ],
    ["先用能控制的浅幅度。", "下去约 2 秒，站起约 1 秒；不弹起。"],
    "bodyweight",
    ["knee"],
  ),
  move(
    "wall-pushup",
    "墙壁俯卧撑",
    [
      "面对墙壁站稳，双掌在胸部高度撑墙，略宽于肩。",
      "收紧腹部，让头、躯干保持一条线，屈肘缓慢靠近墙。",
      "呼气推回起点；通过靠近墙壁降低难度。",
    ],
    ["肘部不要向两边完全打开。", "手腕不舒服时改选不撑手的动作。"],
    "bodyweight",
    ["wrist"],
  ),
  move(
    "hip-hinge",
    "徒手髋铰链",
    [
      "双脚与髋同宽，膝盖只微屈，双手放在髋部。",
      "像用臀部关门一样把臀部向后送，背部保持自然中立。",
      "在能够保持姿势的范围内停下，臀部发力回到站姿。",
    ],
    [
      "弯曲来自髋部，不是反复蹲起。",
      "不用追求手碰到地面；下去约 2 秒、起来约 1 秒。",
    ],
    "bodyweight",
  ),
  move(
    "glute-bridge",
    "舒适幅度臀桥",
    [
      "仰卧，双脚平放、膝盖自然弯曲，双臂放松在身旁。",
      "轻收腹部，臀部发力把骨盆抬到舒适高度。",
      "停 1 秒后缓慢放下；膝部不舒服时调整脚的位置或跳过。",
    ],
    ["不把腰顶到过度后弯。", "脚掌均匀着地，不用手掌用力撑地。"],
    "bodyweight",
  ),
  move(
    "bird-dog",
    "鸟狗式",
    [
      "在垫子上四点支撑，双手在肩下，双膝在髋下。",
      "收紧腹部，缓慢伸出一侧腿和对侧手，手臂最多到肩膀高度。",
      "保持骨盆平稳，回到起点再换侧。",
    ],
    [
      "不塌腰、不过度抬腿。",
      "每侧动作都缓慢控制；撑手或跪姿不舒服就换死虫式。",
    ],
    "core",
    ["wrist", "knee"],
  ),
  move(
    "dead-bug",
    "死虫式脚跟点地",
    [
      "仰卧，膝髋舒适弯曲，双手放在腹部，手臂不向头顶伸。",
      "轻收腹部，让一侧脚跟缓慢落向地面，再回到起点。",
      "换另一侧；若腰背拱起，缩小幅度或让另一只脚留在地面。",
    ],
    ["每侧算一次，保持自然呼吸。", "不追求把腿伸直，动作约 3 秒完成。"],
    "core",
  ),
  move(
    "calf-raise",
    "站姿提踵",
    [
      "双脚与髋同宽，站在平地，必要时前臂轻靠墙保持平衡。",
      "膝盖自然伸展，脚跟缓慢抬起。",
      "停 1 秒后控制脚跟回到地面。",
    ],
    ["不在台阶边缘做，也不弹跳。", "平衡或膝部不舒服时换坐姿踝泵。"],
    "bodyweight",
    ["knee"],
  ),
  move(
    "prone-w-row",
    "俯卧 W 提拉",
    [
      "俯卧在垫子上，额头舒适朝下，肘部弯曲成低于肩部的 W 形。",
      "轻收腹部，肩胛向后下方移动，肘部离地少许。",
      "停 1 秒，缓慢放回；不抬头或用腰部把胸口顶高。",
    ],
    [
      "无需把身体挂在桌椅或门上。",
      "这是背部控制练习，阻力较小，不能完全替代负重划船。",
    ],
    "bodyweight",
  ),
  move(
    "standing-core-brace",
    "站姿腹部收紧练习",
    [
      "站稳或坐稳，肩膀放松，双手自然垂下。",
      "呼气时轻轻收紧腹部，像准备迎接轻微碰触。",
      "保持自然呼吸 10 秒后放松，在计划时段内重复。",
    ],
    [
      "不屏气，也不用力把肚子一直吸到最小。",
      "这是低负荷替代动作，不需要手掌撑地。",
    ],
    "core",
  ),
  move(
    "seated-scapular-retraction",
    "坐姿肩胛后缩练习",
    [
      "坐稳，双脚舒适落地，双手自然垂在身体两侧。",
      "不抬起手臂，肩胛缓慢向后下方移动。",
      "停 2 秒，再放松回原位，每次都保持背部自然直立。",
    ],
    [
      "不耸肩，不用后仰或憋气借力。",
      "这是轻负荷控制练习，不能完全替代负重划船。",
    ],
    "bodyweight",
  ),
  move(
    "standing-external-rotation",
    "无负重肩外旋练习",
    [
      "站稳或坐稳，肘部弯曲约 90 度，轻贴在身体两侧。",
      "肘部保持原位，前臂缓慢向身体外侧转动少许。",
      "在舒适范围内停下，再缓慢回到起点。",
    ],
    [
      "双手放松，不用握哑铃或弹力带。",
      "手臂保持在肩部以下，这是低负荷控制练习。",
    ],
    "bodyweight",
  ),
  move(
    "side-lying-leg-raise",
    "侧卧抬腿",
    [
      "侧卧，下侧腿自然弯曲，上侧腿伸展，头部舒适放在下侧手臂上。",
      "脚尖朝前，上侧腿缓慢抬起少许，骨盆保持朝前。",
      "控制放回，不用甩腿；完成后换另一侧。",
    ],
    ["上侧手放松，不用手掌承担体重。", "每侧 8–12 次，不追求抬得高。"],
    "bodyweight",
  ),
  move(
    "standing-hip-extension",
    "站姿小幅髋后伸",
    [
      "站稳，可用前臂轻靠墙保持平衡。",
      "一侧腿保持自然伸展，小幅向后移动，躯干不向前倒。",
      "慢慢回到起点，再换侧；不舒服时改为坐姿踝活动。",
    ],
    ["不用弯腰顶臀或把腰后仰。", "不必抬高腿，优先保持平衡。"],
    "bodyweight",
  ),
  move(
    "goblet-squat",
    "哑铃杯式深蹲",
    [
      "双手把哑铃稳稳抱在胸前，站距略宽于髋。",
      "臀部向后下方移动，膝盖随脚尖方向，慢慢下蹲。",
      "在能稳定控制的深度停下，再呼气站起。",
    ],
    [
      "选择做完后还可多做 2–3 次的重量。",
      "不按体重推算公斤数；先掌握徒手动作。",
    ],
    "weights-light",
    ["knee", "wrist"],
  ),
  move(
    "dumbbell-row",
    "哑铃俯身划船",
    [
      "双脚站稳，髋部向后移，膝盖微屈，双手握哑铃自然垂下。",
      "保持背部中立，肘部朝身后拉，哑铃靠近身体两侧。",
      "停 1 秒，缓慢放下，不用躯干摆动带起重量。",
    ],
    ["不依赖不稳的家用桌椅支撑。", "手腕保持直，选择还可多做 2–3 次的阻力。"],
    "weights-light",
    ["wrist"],
  ),
  move(
    "dumbbell-rdl",
    "哑铃罗马尼亚硬拉",
    [
      "站稳，双手把哑铃放在大腿前方，膝盖保持微屈。",
      "臀部向后移，哑铃贴近腿部下降，背部维持自然中立。",
      "在姿势仍稳定时停下，臀部发力站起。",
    ],
    [
      "不是反复蹲起，也不用把哑铃落地。",
      "先轻阻力练习，下去约 2 秒、起来约 1 秒。",
    ],
    "weights-light",
    ["wrist"],
  ),
  move(
    "dumbbell-floor-press",
    "哑铃地板卧推",
    [
      "仰卧在垫子上，双脚平放，双手握轻哑铃，手腕保持直。",
      "上臂与身体约 45 度，呼气把哑铃推到胸部上方。",
      "慢慢下降，直到上臂轻触地面，再重复。",
    ],
    ["不把哑铃向头顶方向推。", "先确认能安全拿起和放下哑铃，保留 2–3 次余力。"],
    "weights-light",
    ["wrist"],
  ),
  move(
    "leg-press",
    "器械腿举",
    [
      "按器械说明调整座椅，背部与骨盆贴靠垫，双脚平放踏板。",
      "用轻阻力把踏板推开，膝盖保持自然微屈。",
      "控制返回到骨盆不离开靠垫的范围，再重复。",
    ],
    [
      "不锁死膝盖，也不追求很深的屈膝。",
      "初次使用请场馆教练说明调节与安全挡位。",
    ],
    "weights-light",
    ["knee"],
  ),
  move(
    "seated-row",
    "器械坐姿划船",
    [
      "调整座椅，双脚舒适落在支撑处，胸背自然直立。",
      "握住把手，肘部向后拉，让肩胛轻轻向后下方移动。",
      "缓慢伸回手臂，躯干保持稳定。",
    ],
    ["不耸肩，也不靠后仰甩动。", "先选轻阻力，完成后仍保留 2–3 次余力。"],
    "weights-light",
    ["wrist"],
  ),
  move(
    "chest-press",
    "器械坐姿推胸",
    [
      "调整座椅，让把手位于胸部中段，背部贴靠垫。",
      "手腕保持直，呼气把把手向前推，肘部不完全锁死。",
      "缓慢返回舒适范围，不让肩膀被过度向后拉。",
    ],
    ["双脚只是稳放，不需要用腿猛蹬。", "先选轻阻力，不需要最后一组练到力竭。"],
    "weights-light",
    ["wrist"],
  ),
  move(
    "lat-pulldown",
    "器械高位下拉",
    [
      "调整座椅与腿部固定垫，选择轻阻力，双手握把。",
      "身体略向后但保持稳定，肘部向下拉，把手靠近胸部上方。",
      "缓慢返回，不向颈后拉，也不晃动借力。",
    ],
    [
      "肩部不舒服时换坐姿划船。",
      "需要举手过肩；避开过头动作的偏好会替换这一动作。",
    ],
    "weights-light",
    ["wrist", "overhead"],
  ),
  move(
    "brisk-walk",
    "平地快走",
    [
      "在平坦路面行走，先从自然步速开始。",
      "逐渐加快到呼吸略快、仍能说完整句子的速度。",
      "保持自然步幅与摆臂；若无法说完整句子就减速。",
    ],
    ["无需跑步、爬坡或跳跃。", "需要时中途短暂减速，仍计入这一时段。"],
    "walk-brisk",
    ["knee"],
  ),
  move(
    "low-impact-march",
    "低冲击原地踏步",
    [
      "在平整地面站稳，轮流轻轻抬脚、落脚。",
      "脚不用抬高，双臂在肩部以下自然摆动。",
      "保持脚步轻柔、能说完整句子的节奏，累时减速。",
    ],
    ["始终有一只脚接触地面，不跳跃。", "不舒服时换慢走或坐姿活动。"],
    undefined,
    ["knee"],
  ),
  move(
    "stationary-bike",
    "低阻力室内单车",
    [
      "调整座椅，让踏板到最远处时膝盖仍微屈。",
      "从低阻力开始平稳踩踏，双手轻扶，不把体重压在手腕上。",
      "保持能说完整句子的速度，不站起来冲刺。",
    ],
    [
      "初次使用请工作人员帮助调节座椅。",
      "膝部不舒服就结束；减少膝部负担时不默认安排单车。",
    ],
    undefined,
    ["knee", "wrist"],
  ),
  move(
    "elliptical",
    "低阻力椭圆机",
    [
      "先确认器械停止，稳稳踏上踏板并按说明启动。",
      "选择低阻力，保持直立、小幅顺畅地移动。",
      "以能说完整句子的节奏持续，不追求快频率。",
    ],
    ["手臂放在肩膀以下，握把只用于平衡。", "膝部或手腕不舒服就结束。"],
    "elliptical",
    ["knee", "wrist"],
  ),
  move(
    "arm-ergometer",
    "坐姿手摇功率车",
    [
      "调整稳固座椅与手柄，让手柄约在胸部高度，双脚舒适放稳。",
      "从低阻力开始，双手缓慢转动手柄，保持背部稳定。",
      "维持能说完整句子的节奏；疲劳时减速或短暂休息。",
    ],
    [
      "不需要腿部踩踏，也不把手柄调到头顶高度。",
      "先请场馆工作人员确认器械调节；没有这台器械可换坐姿无负重摆臂。",
      "从轻阻力开始，按实际强度记录，不由分钟数推断有氧强度。",
    ],
    "arm-ergometer-easy",
    ["wrist"],
  ),
  move(
    "seated-arm-swing",
    "坐姿无负重摆臂",
    [
      "坐在稳固座椅上，双脚舒适落地，背部自然直立。",
      "双臂弯曲，缓慢向前后摆动，手臂保持在肩部以下。",
      "自然呼吸，穿插短暂放松；不舒服就停止。",
    ],
    [
      "不用握器械，也不用手掌撑身体。",
      "这是轻量活动替代，不承诺达到中等强度有氧效果。",
    ],
    "seated-arm-movement",
  ),
  move(
    "supine-rotation",
    "仰卧小幅躯干转动",
    [
      "仰卧，双脚平放，双臂自然靠在身旁。",
      "膝盖并拢，在舒适范围内慢慢向一侧移动少许。",
      "回到中间再换侧，每轮短暂放松。",
    ],
    ["肩膀留在垫子上，不用手压腿。", "不需要让膝盖碰到地面。"],
    "stretching",
  ),
  move(
    "calf-stretch",
    "小腿轻缓拉伸",
    [
      "面对墙站稳，需要时用前臂轻靠墙，一脚轻轻后移。",
      "后侧脚跟保持着地，躯干缓慢前移一点。",
      "只拉到轻微牵伸感，保持 20–30 秒后放松、换侧，重复短轮。",
    ],
    ["不要弹震或压到疼痛。", "站姿不舒服时改为坐姿踝活动。"],
    "stretching",
    ["knee"],
  ),
  move(
    "seated-hamstring-stretch",
    "坐姿大腿后侧轻缓拉伸",
    [
      "坐在稳固座椅前部，一侧脚跟着地，膝盖保留舒适弯曲。",
      "保持背部自然中立，从髋部轻轻向前倾一点。",
      "轻微牵伸 20–30 秒后回正、换侧，穿插放松再重复。",
    ],
    ["不用手向下压膝盖，也不用勉强伸直腿。", "没有牵伸感也不用强行加大幅度。"],
    "stretching",
  ),
  move(
    "chest-opening",
    "低位开胸放松",
    [
      "站稳或坐稳，双臂弯曲并放在肩部以下。",
      "肩胛轻轻向后下方移动，胸口自然打开。",
      "保持自然呼吸 10–20 秒，然后放松，在时段内重复短轮。",
    ],
    ["手臂不举过头顶。", "不把腰部用力向后弯。"],
    "stretching",
  ),
  move(
    "relaxed-breathing",
    "坐姿自然呼吸放松",
    [
      "坐在稳固座椅上，双脚放稳，肩膀自然下沉。",
      "用舒服的节奏吸气、呼气，不刻意憋气或吸得过深。",
      "逐渐放松身体，等呼吸接近日常状态。",
    ],
    ["不用追求固定呼吸秒数。", "若头晕或不舒服就停止并休息。"],
  ),
];

export const workoutMoveById: Record<string, WorkoutMove> = Object.fromEntries(
  workoutMoves.map((item) => [item.id, item]),
);

function fitsPreferences(id: string, prefs: TrainingPreferences): boolean {
  const avoided: Record<PreferenceLoad, boolean> = {
    knee: prefs.avoidKneeLoad,
    wrist: prefs.avoidWristLoad,
    overhead: prefs.avoidOverhead,
    impact: prefs.avoidImpact,
  };
  return (movementLoads[id] ?? []).every((load) => !avoided[load]);
}

function safeMove(id: string, prefs: TrainingPreferences): string {
  if (fitsPreferences(id, prefs)) return id;
  const replacements: Record<string, string> = {
    "chair-squat": "hip-hinge",
    "goblet-squat": prefs.avoidKneeLoad ? "hip-hinge" : "chair-squat",
    "leg-press": "hip-hinge",
    "wall-pushup": "standing-core-brace",
    "dumbbell-floor-press": "standing-core-brace",
    "chest-press": "standing-core-brace",
    "dumbbell-row": "prone-w-row",
    "seated-row": "prone-w-row",
    "lat-pulldown": prefs.avoidWristLoad ? "prone-w-row" : "seated-row",
    "dumbbell-rdl": "hip-hinge",
    "bird-dog": "dead-bug",
    "calf-raise": "glute-bridge",
    "calf-stretch": "ankle-circle",
  };
  return replacements[id] ?? "standing-core-brace";
}

function timedBlock(
  phase: WorkoutBlock["phase"],
  title: string,
  minutes: number,
  ids: string[],
): WorkoutBlock {
  const seconds = minutes * 60;
  const perMove = Math.floor(seconds / ids.length);
  return {
    id: phase,
    phase,
    title,
    minutes,
    moves: ids.map((moveId, index) => ({
      moveId,
      seconds: perMove + (index < seconds % ids.length ? 1 : 0),
    })),
  };
}

function warmup(prefs: TrainingPreferences, minutes: number): WorkoutBlock {
  return timedBlock("warmup", "热身 · 从轻缓动作开始", minutes, [
    prefs.avoidKneeLoad ? "ankle-circle" : "easy-walk",
    "shoulder-roll",
    "standing-rotation",
  ]);
}

function cooldown(prefs: TrainingPreferences, minutes: number): WorkoutBlock {
  return timedBlock("cooldown", "放松 · 短轮牵伸与自然呼吸", minutes, [
    safeMove("calf-stretch", prefs),
    "chest-opening",
    "relaxed-breathing",
  ]);
}

function cardioMove(prefs: TrainingPreferences, alternate: boolean): string {
  if (prefs.avoidKneeLoad) {
    if (prefs.equipment === "gym" && !prefs.avoidWristLoad)
      return "arm-ergometer";
    return prefs.avoidWristLoad ? "seated-arm-swing" : "easy-walk";
  }
  if (prefs.equipment === "gym" && !prefs.avoidWristLoad)
    return alternate ? "elliptical" : "stationary-bike";
  return alternate ? "low-impact-march" : "brisk-walk";
}

function cardio(
  prefs: TrainingPreferences,
  minutes: number,
  alternate: boolean,
): WorkoutBlock {
  const id = cardioMove(prefs, alternate);
  const block = timedBlock("cardio", "有氧 · 可说完整句子的节奏", minutes, [
    id,
  ]);
  block.moves[0].alternative =
    id === "arm-ergometer"
      ? "没有手摇功率车时，改为坐姿无负重摆臂；不强求达到中等强度。"
      : prefs.avoidKneeLoad
        ? "仅在膝部舒适时继续；不舒服可改为坐姿轻缓活动或直接休息。"
        : "累时减速或短暂休息；无需把未完成的分钟数补回来。";
  return block;
}

function strengthIds(
  prefs: TrainingPreferences,
  weekday: number,
  split: "full" | "upper" | "lower",
): string[] {
  const equipment = prefs.equipment;
  const squat =
    equipment === "gym"
      ? "leg-press"
      : equipment === "dumbbells"
        ? "goblet-squat"
        : "chair-squat";
  const push =
    equipment === "gym"
      ? "chest-press"
      : equipment === "dumbbells"
        ? "dumbbell-floor-press"
        : "wall-pushup";
  const pull =
    equipment === "gym"
      ? "seated-row"
      : equipment === "dumbbells"
        ? "dumbbell-row"
        : "prone-w-row";
  const hinge = equipment === "dumbbells" ? "dumbbell-rdl" : "hip-hinge";
  const core = weekday === 3 && equipment === "none" ? "bird-dog" : "dead-bug";
  const candidates =
    split === "upper"
      ? [
          push,
          pull,
          equipment === "gym" && weekday === 4
            ? "lat-pulldown"
            : "seated-scapular-retraction",
          "dead-bug",
          "standing-core-brace",
        ]
      : split === "lower"
        ? [squat, hinge, "glute-bridge", "side-lying-leg-raise", "calf-raise"]
        : [
            squat,
            push,
            weekday === 3 ? "glute-bridge" : hinge,
            pull,
            weekday === 5 ? "calf-raise" : core,
          ];
  const selected = [...new Set(candidates.map((id) => safeMove(id, prefs)))];
  // Restrictions can merge movements; keep distinct, usable alternatives instead of duplicates.
  const fillers =
    split === "upper"
      ? [
          "prone-w-row",
          "dead-bug",
          "standing-core-brace",
          "seated-scapular-retraction",
          "standing-external-rotation",
        ]
      : [
          "glute-bridge",
          "side-lying-leg-raise",
          "dead-bug",
          "standing-hip-extension",
          "calf-raise",
        ];
  for (const id of fillers) {
    if (selected.length >= 5) break;
    if (!selected.includes(id) && fitsPreferences(id, prefs)) selected.push(id);
  }
  return selected.slice(0, prefs.sessionMinutes === 20 ? 4 : 5);
}

function strength(
  prefs: TrainingPreferences,
  weekday: number,
  split: "full" | "upper" | "lower",
): WorkoutBlock {
  const longerRegular =
    prefs.experience === "regular" && prefs.sessionMinutes >= 45;
  const minutes = prefs.sessionMinutes === 20 ? 14 : longerRegular ? 30 : 20;
  const unilateral = new Set([
    "bird-dog",
    "dead-bug",
    "side-lying-leg-raise",
    "standing-hip-extension",
  ]);
  return {
    id: "strength",
    phase: "strength",
    title: "力量 · 时段已含组间休息与动作转换",
    minutes,
    moves: strengthIds(prefs, weekday, split).map((moveId) => ({
      moveId,
      sets: longerRegular ? 3 : 2,
      ...(moveId === "standing-core-brace"
        ? { seconds: 30 }
        : { reps: unilateral.has(moveId) ? "每侧 8–12 次" : "8–12 次" }),
      restSeconds: 60,
      alternative: "先减少次数或动作幅度；疼痛时停止这一动作，调整或休息。",
    })),
  };
}

function goalExplanation(profile: Profile | null): string {
  if (!profile)
    return "通用训练安排，不需要先填写完整身体资料。按当天状态选择可控制的动作与阻力。";
  if (profile.goal === "strictLoss" || profile.goal === "extremeLoss")
    return "减脂目标采用同样的循序训练和恢复日，不因热量缺口更大而加倍运动。疲劳明显时缩短训练或休息，不用运动补偿进食。";
  if (profile.goal === "gain")
    return "以练好力量动作和逐步进步为重点；动作稳定后再小幅增加次数或阻力，不按体重推算训练公斤数。";
  if (profile.goal === "maintain")
    return "用规律的力量、有氧和恢复维持活动习惯；根据精力与完成情况逐步调整。";
  return "以规律的力量与舒适有氧配合减脂目标，保留恢复时间；实际变化还取决于饮食、睡眠和持续性。";
}

/** A movement preference selects gentler alternatives; it is not an injury diagnosis or rehabilitation plan. */
export function generateDailyWorkout(
  profile: Profile | null,
  prefs: TrainingPreferences,
  date: string,
): DailyWorkout {
  const validDate = shiftDate(date, 0);
  const weekday = new Date(`${validDate}T12:00:00Z`).getUTCDay();
  const goalNote = goalExplanation(profile);
  if (weekday === 0) {
    return {
      date: validDate,
      title: "恢复日",
      focus: "休息、睡眠与日常轻量活动",
      totalMinutes: 0,
      blocks: [],
      intensity: "轻松",
      explanation: `${goalNote} 今天不安排必须完成的训练，也不用补做本周遗漏的动作。`,
    };
  }
  if (weekday === 6) {
    const totalMinutes = Math.min(20, prefs.sessionMinutes);
    return {
      date: validDate,
      title: "轻缓活动与灵活性",
      focus: "轻缓活动，不追求拉伸幅度",
      totalMinutes,
      blocks: [
        warmup(prefs, 3),
        timedBlock(
          "mobility",
          "灵活性 · 交替活动与短暂放松",
          totalMinutes - 8,
          ["ankle-circle", "standing-rotation", "supine-rotation"],
        ),
        cooldown(prefs, 5),
      ],
      intensity: "轻松",
      explanation: `${goalNote} 每个时段可用短轮动作穿插放松；没有必须达到的幅度，不适时停止。`,
    };
  }

  const regular = prefs.experience === "regular";
  const isStrength = regular
    ? [1, 2, 4, 5].includes(weekday)
    : [1, 3, 5].includes(weekday);
  const edgeMinutes = prefs.sessionMinutes === 20 ? 3 : 5;
  const blocks: WorkoutBlock[] = [warmup(prefs, edgeMinutes)];
  let focus: string;
  let title: string;
  if (isStrength) {
    const split = regular
      ? [1, 4].includes(weekday)
        ? "upper"
        : "lower"
      : "full";
    blocks.push(strength(prefs, weekday, split));
    const extraMinutes =
      prefs.sessionMinutes - edgeMinutes * 2 - blocks[1].minutes;
    if (extraMinutes > 0)
      blocks.push(cardio(prefs, extraMinutes, weekday === 5));
    title =
      split === "full"
        ? `全身力量 ${weekday === 1 ? "A" : weekday === 3 ? "B" : "C"}`
        : split === "upper"
          ? "上肢与核心力量"
          : "髋部与下肢力量";
    focus = prefs.avoidKneeLoad
      ? "减少膝部负担的力量动作"
      : split === "full"
        ? "全身基础动作"
        : split === "upper"
          ? "上肢推拉与核心"
          : "髋部、腿部与平衡";
  } else {
    blocks.push(
      cardio(prefs, prefs.sessionMinutes - edgeMinutes * 2, weekday === 4),
    );
    title = prefs.avoidKneeLoad ? "低冲击轻缓有氧" : "稳定节奏有氧";
    focus = prefs.avoidKneeLoad
      ? "选择膝部舒适的活动方式"
      : "呼吸略快，仍能说完整句子";
  }
  blocks.push(cooldown(prefs, edgeMinutes));
  const preferenceNote = prefs.avoidKneeLoad
    ? " 已替换深蹲、腿举、跑跳与跪姿动作；臀桥等动作也只在舒适范围进行。没有手摇器械时可做坐姿轻量活动，单车仅在膝部舒适且愿意尝试时另行选择。"
    : "";
  const strengthNote = isStrength
    ? " 力量时段包含每组约 60 秒休息和动作转换；动作慢而可控，保留 2–3 次余力，不练到力竭。完成后可提前结束，不用凑满分钟。"
    : " 有氧时段可穿插减速与休息，强度以能说完整句子为准。";
  return {
    date: validDate,
    title,
    focus,
    totalMinutes: prefs.sessionMinutes,
    blocks,
    intensity: prefs.avoidKneeLoad && !isStrength ? "轻松" : "中等",
    explanation: `${goalNote}${strengthNote}${preferenceNote}`,
  };
}

/** Calendar weeks start on Monday and are clipped at the supported 1900–2199 date bounds. */
export function generateWeekWorkouts(
  profile: Profile | null,
  prefs: TrainingPreferences,
  selectedDate: string,
): DailyWorkout[] {
  const date = shiftDate(selectedDate, 0);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [year, month, day] = date.split("-").map(Number);
  const mondayOffset = -((weekday + 6) % 7);
  const days: DailyWorkout[] = [];
  for (let offset = mondayOffset; offset < mondayOffset + 7; offset++) {
    const dayDate = new Date(Date.UTC(year, month - 1, day + offset))
      .toISOString()
      .slice(0, 10);
    if (dayDate < "1900-01-01" || dayDate > "2199-12-31") continue;
    days.push(generateDailyWorkout(profile, prefs, dayDate));
  }
  return days;
}
