import assert from "node:assert/strict";
import test from "node:test";
import { activities } from "../src/data";
import {
  generateDailyWorkout,
  generateWeekWorkouts,
  workoutMoveById,
  workoutMoves,
} from "../src/workout-planner";
import type { Profile, TrainingPreferences } from "../src/types";

const profile: Profile = {
  height: 168,
  weight: 68,
  age: 32,
  sex: "female",
  bodyFat: null,
  activityLevel: 1.375,
  goal: "lose",
};

const defaultPreferences: TrainingPreferences = {
  equipment: "none",
  sessionMinutes: 30,
  experience: "beginner",
  avoidImpact: false,
  avoidKneeLoad: false,
  avoidWristLoad: false,
  avoidOverhead: false,
  preferredStartTime: "10:00",
  unavailableStart: "17:00",
  unavailableEnd: "18:00",
};

function preferences(
  overrides: Partial<TrainingPreferences> = {},
): TrainingPreferences {
  return { ...defaultPreferences, ...overrides };
}

type DailyWorkout = ReturnType<typeof generateDailyWorkout>;

function moveIds(workout: DailyWorkout): string[] {
  return workout.blocks.flatMap((block) =>
    block.moves.map((move) => move.moveId),
  );
}

function weekMoveIds(prefs: TrainingPreferences): string[] {
  return generateWeekWorkouts(profile, prefs, "2026-10-13").flatMap(moveIds);
}

function strengthMoves(workout: DailyWorkout) {
  return workout.blocks
    .filter((block) => block.phase === "strength")
    .flatMap((block) => block.moves);
}

function assertForbiddenMovesAbsent(
  prefs: TrainingPreferences,
  forbiddenIds: string[],
  forbiddenNames?: RegExp,
) {
  for (const id of weekMoveIds(prefs)) {
    assert.ok(
      !forbiddenIds.includes(id),
      `${id} violates the selected restriction`,
    );
    if (forbiddenNames) {
      assert.doesNotMatch(workoutMoveById[id].name, forbiddenNames);
    }
  }
}

test("the move catalog provides unique IDs, usable teaching instructions and accurate teaching search links", () => {
  assert.ok(workoutMoves.length >= 20);
  assert.equal(
    new Set(workoutMoves.map((move) => move.id)).size,
    workoutMoves.length,
  );
  assert.equal(Object.keys(workoutMoveById).length, workoutMoves.length);
  const activityIds = new Set(activities.map((activity) => activity.id));

  for (const move of workoutMoves) {
    assert.deepEqual(workoutMoveById[move.id], move);
    assert.ok(move.name.trim());
    assert.ok(move.instructions.length > 0, `${move.id} needs instructions`);
    assert.ok(move.cues.length > 0, `${move.id} needs form cues`);
    assert.ok(
      move.instructions.every((instruction) => instruction.trim().length > 0),
    );
    assert.ok(move.cues.every((cue) => cue.trim().length > 0));
    if (move.activityId) {
      assert.ok(
        activityIds.has(move.activityId),
        `${move.id} references an unknown logging activity`,
      );
    }
    assert.equal(move.teachingLabel, "哔哩哔哩教学搜索");
    assert.equal(
      move.teachingUrl,
      `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${move.name} 标准动作 教学`)}`,
    );
  }
});

test("beginner weeks alternate three strength days and two cardio days before light mobility and Sunday recovery", () => {
  const week = generateWeekWorkouts(profile, preferences(), "2026-10-13");
  assert.deepEqual(
    week.map((workout) => workout.date),
    [
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ],
  );
  assert.deepEqual(
    week.map((workout) => strengthMoves(workout).length > 0),
    [true, false, true, false, true, false, false],
  );
  for (const index of [1, 3]) {
    assert.ok(week[index].blocks.some((block) => block.phase === "cardio"));
  }
  assert.ok(week[5].blocks.some((block) => block.phase === "mobility"));
  assert.ok(week[5].totalMinutes > 0 && week[5].totalMinutes <= 20);
  assert.equal(week[5].intensity, "轻松");
  assert.equal(week[6].totalMinutes, 0);
  assert.equal(week[6].intensity, "轻松");
  assert.deepEqual(week[6].blocks, []);
});

test("regular training separates upper and lower body sessions with a midweek cardio day", () => {
  const week = generateWeekWorkouts(
    profile,
    preferences({ experience: "regular" }),
    "2026-10-13",
  );
  assert.deepEqual(
    week.map((workout) => strengthMoves(workout).length > 0),
    [true, true, false, true, true, false, false],
  );
  for (const index of [0, 3])
    assert.match(`${week[index].title} ${week[index].focus}`, /上肢/);
  for (const index of [1, 4])
    assert.match(`${week[index].title} ${week[index].focus}`, /下肢/);
  assert.ok(week[2].blocks.some((block) => block.phase === "cardio"));
  assert.equal(week[6].totalMinutes, 0);
});

test("calendar weeks stay Monday to Sunday across year boundaries, leap days and daylight saving dates", () => {
  const cases = [
    ["2025-12-29", "2025-12-29", "2026-01-04"],
    ["2026-01-01", "2025-12-29", "2026-01-04"],
    ["2026-01-04", "2025-12-29", "2026-01-04"],
    ["2024-02-29", "2024-02-26", "2024-03-03"],
    ["2026-03-08", "2026-03-02", "2026-03-08"],
  ];
  for (const [selectedDate, start, end] of cases) {
    const week = generateWeekWorkouts(null, preferences(), selectedDate);
    assert.equal(week.length, 7);
    assert.equal(week[0].date, start);
    assert.equal(week.at(-1)?.date, end);
    assert.equal(new Set(week.map((workout) => workout.date)).size, 7);
    for (const workout of week) {
      assert.deepEqual(
        workout,
        generateDailyWorkout(null, preferences(), workout.date),
      );
    }
  }
});

test("calendar weeks clip at both supported date limits without repeating a clamped day", () => {
  const first = generateWeekWorkouts(null, preferences(), "1900-01-01");
  assert.equal(first.length, 7);
  assert.equal(first[0].date, "1900-01-01");
  assert.equal(first.at(-1)?.date, "1900-01-07");
  const last = generateWeekWorkouts(null, preferences(), "2199-12-31");
  assert.deepEqual(
    last.map((workout) => workout.date),
    ["2199-12-30", "2199-12-31"],
  );
  for (const workout of [...first, ...last]) {
    assert.ok(workout.date >= "1900-01-01" && workout.date <= "2199-12-31");
  }
});

test("daily and weekly planners reject dates outside the supported calendar and malformed dates", () => {
  for (const date of [
    "1899-12-31",
    "2200-01-01",
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-1-01",
    "2026/01/01",
    "not-a-date",
    "",
  ]) {
    assert.throws(() => generateDailyWorkout(null, preferences(), date));
    assert.throws(() => generateWeekWorkouts(null, preferences(), date));
  }
});

test("every plan fits its selected duration, accounts for all block minutes and uses known prescribed moves", () => {
  for (const experience of ["beginner", "regular"] as const) {
    for (const equipment of ["none", "dumbbells", "gym"] as const) {
      for (const sessionMinutes of [20, 30, 45, 60] as const) {
        const prefs = preferences({ experience, equipment, sessionMinutes });
        for (const workout of generateWeekWorkouts(
          profile,
          prefs,
          "2026-10-13",
        )) {
          assert.ok(workout.title.trim());
          assert.ok(workout.focus.trim());
          assert.ok(workout.explanation.trim());
          assert.ok(["轻松", "中等"].includes(workout.intensity));
          assert.ok(
            workout.totalMinutes >= 0 && workout.totalMinutes <= sessionMinutes,
          );
          assert.equal(
            workout.totalMinutes,
            workout.blocks.reduce((sum, block) => sum + block.minutes, 0),
          );
          assert.equal(
            new Set(workout.blocks.map((block) => block.id)).size,
            workout.blocks.length,
          );
          for (const block of workout.blocks) {
            assert.ok(block.title.trim());
            assert.ok(Number.isFinite(block.minutes) && block.minutes > 0);
            assert.ok(block.moves.length > 0);
            if (block.phase !== "strength") {
              assert.equal(
                block.moves.reduce((sum, move) => sum + (move.seconds ?? 0), 0),
                block.minutes * 60,
              );
            }
            for (const prescription of block.moves) {
              assert.ok(
                workoutMoveById[prescription.moveId],
                `${prescription.moveId} is absent from the catalog`,
              );
              if (prescription.sets !== undefined) {
                assert.ok(
                  Number.isInteger(prescription.sets) && prescription.sets > 0,
                );
              }
              if (prescription.seconds !== undefined)
                assert.ok(prescription.seconds > 0);
              if (prescription.restSeconds !== undefined)
                assert.ok(prescription.restSeconds >= 0);
              assert.ok(
                prescription.reps?.trim() || prescription.seconds,
                `${prescription.moveId} needs a dose`,
              );
            }
          }
          if (strengthMoves(workout).length > 0) {
            const ids = strengthMoves(workout).map((move) => move.moveId);
            assert.equal(new Set(ids).size, ids.length);
            assert.equal(workout.blocks[0].phase, "warmup");
            assert.equal(workout.blocks.at(-1)?.phase, "cooldown");
          }
        }
      }
    }
  }
});

test("beginner strength starts with two sets of eight to twelve repetitions or a timed core dose", () => {
  const week = generateWeekWorkouts(profile, preferences(), "2026-10-13");
  for (const workout of week) {
    for (const move of strengthMoves(workout)) {
      assert.equal(move.sets, 2);
      if (move.seconds !== undefined) {
        assert.ok(move.seconds > 0);
      } else {
        assert.match(move.reps ?? "", /8\s*[-–~～]\s*12/);
      }
    }
  }
});

test("equipment preferences provide bodyweight, dumbbell or gym exercises without requiring absent equipment", () => {
  const none = weekMoveIds(preferences());
  assert.ok(none.includes("chair-squat"));
  assert.ok(none.includes("wall-pushup"));
  assert.ok(
    none.every(
      (id) =>
        !/dumbbell|goblet|leg-press|seated-row|chest-press|lat-pulldown/.test(
          id,
        ),
    ),
  );
  const dumbbells = weekMoveIds(preferences({ equipment: "dumbbells" }));
  assert.ok(dumbbells.includes("dumbbell-row"));
  assert.ok(dumbbells.includes("dumbbell-rdl"));
  const gym = weekMoveIds(preferences({ equipment: "gym" }));
  assert.ok(gym.includes("leg-press"));
  assert.ok(gym.includes("seated-row"));
});

test("knee restrictions replace squats, leg presses and kneeling moves with hip-dominant alternatives", () => {
  for (const experience of ["beginner", "regular"] as const) {
    for (const equipment of ["none", "dumbbells", "gym"] as const) {
      const prefs = preferences({ experience, equipment, avoidKneeLoad: true });
      assertForbiddenMovesAbsent(
        prefs,
        [
          "chair-squat",
          "goblet-squat",
          "dumbbell-goblet-squat",
          "leg-press",
          "bird-dog",
          "calf-raise",
        ],
        /深蹲|腿举|弓步|跑|跳|鸟狗/,
      );
      const ids = weekMoveIds(prefs);
      assert.ok(ids.includes("hip-hinge") || ids.includes("dumbbell-rdl"));
      assert.ok(ids.includes("glute-bridge"));
    }
    const cardio = generateDailyWorkout(
      profile,
      preferences({ experience, equipment: "gym", avoidKneeLoad: true }),
      experience === "regular" ? "2026-10-14" : "2026-10-13",
    );
    assert.ok(moveIds(cardio).includes("arm-ergometer"));
    assert.ok(!moveIds(cardio).includes("stationary-bike"));
  }
});

test("wrist restrictions avoid palm support and weighted grips while retaining back and core work", () => {
  for (const experience of ["beginner", "regular"] as const) {
    for (const equipment of ["none", "dumbbells", "gym"] as const) {
      const prefs = preferences({
        experience,
        equipment,
        avoidWristLoad: true,
      });
      assertForbiddenMovesAbsent(
        prefs,
        [
          "wall-pushup",
          "bird-dog",
          "goblet-squat",
          "dumbbell-goblet-squat",
          "dumbbell-row",
          "dumbbell-rdl",
          "dumbbell-floor-press",
          "seated-row",
          "chest-press",
          "lat-pulldown",
          "arm-ergometer",
        ],
        /俯卧撑|平板支撑|哑铃|杠铃|鸟狗/,
      );
      const ids = weekMoveIds(prefs);
      assert.ok(ids.includes("prone-w-row"));
      assert.ok(
        ids.includes("dead-bug") || ids.includes("standing-core-brace"),
      );
    }
  }
});

test("overhead and impact restrictions remove the affected movements across the whole week", () => {
  assert.ok(
    weekMoveIds(
      preferences({ equipment: "gym", experience: "regular" }),
    ).includes("lat-pulldown"),
  );
  for (const experience of ["beginner", "regular"] as const) {
    for (const equipment of ["none", "dumbbells", "gym"] as const) {
      assertForbiddenMovesAbsent(
        preferences({ experience, equipment, avoidOverhead: true }),
        ["lat-pulldown"],
        /过头|推举|下拉/,
      );
      assertForbiddenMovesAbsent(
        preferences({ experience, equipment, avoidImpact: true }),
        [],
        /跑|跳/,
      );
    }
  }
});

test("combined knee and wrist restrictions select seated arm cardio and still produce complete sessions", () => {
  for (const experience of ["beginner", "regular"] as const) {
    for (const equipment of ["none", "dumbbells", "gym"] as const) {
      const prefs = preferences({
        experience,
        equipment,
        avoidKneeLoad: true,
        avoidWristLoad: true,
        avoidOverhead: true,
        avoidImpact: true,
      });
      const week = generateWeekWorkouts(profile, prefs, "2026-10-13");
      const cardioIndexes = experience === "regular" ? [2] : [1, 3];
      for (const index of cardioIndexes) {
        assert.ok(moveIds(week[index]).includes("seated-arm-swing"));
        assert.ok(!moveIds(week[index]).includes("arm-ergometer"));
        assert.ok(!moveIds(week[index]).includes("stationary-bike"));
      }
      const strengthIndexes =
        experience === "regular" ? [0, 1, 3, 4] : [0, 2, 4];
      for (const index of strengthIndexes) {
        const moves = strengthMoves(week[index]);
        assert.ok(moves.length > 0);
        for (const move of moves) {
          assert.ok(
            ![
              "standing-rotation",
              "chest-opening",
              "ankle-circle",
              "relaxed-breathing",
            ].includes(move.moveId),
          );
        }
      }
      assertForbiddenMovesAbsent(prefs, [
        "chair-squat",
        "leg-press",
        "bird-dog",
        "wall-pushup",
        "lat-pulldown",
      ]);
    }
  }
});

test("a missing profile yields a reproducible generic plan without changing inputs", () => {
  const prefs = preferences();
  const snapshot = structuredClone(prefs);
  const first = generateWeekWorkouts(null, prefs, "2026-10-13");
  assert.deepEqual(first, generateWeekWorkouts(null, prefs, "2026-10-13"));
  assert.deepEqual(prefs, snapshot);
  assert.ok(first.some((workout) => strengthMoves(workout).length > 0));
  for (const workout of first) assert.ok(workout.explanation.trim());
  const profileSnapshot = structuredClone(profile);
  generateWeekWorkouts(profile, prefs, "2026-10-13");
  assert.deepEqual(profile, profileSnapshot);
});

test("every goal preserves Sunday recovery and supplies guidance for its training approach", () => {
  const explanations = new Map<Profile["goal"], string>();
  for (const goal of [
    "lose",
    "maintain",
    "gain",
    "strictLoss",
    "extremeLoss",
  ] as const) {
    const workout = generateDailyWorkout(
      { ...profile, goal },
      preferences(),
      "2026-10-18",
    );
    assert.equal(workout.totalMinutes, 0);
    assert.equal(workout.intensity, "轻松");
    assert.deepEqual(workout.blocks, []);
    assert.ok(workout.explanation.trim());
    explanations.set(goal, workout.explanation);
  }
  assert.notEqual(explanations.get("gain"), explanations.get("lose"));
  assert.notEqual(explanations.get("maintain"), explanations.get("lose"));
  assert.notEqual(explanations.get("gain"), explanations.get("maintain"));
  assert.notEqual(explanations.get("strictLoss"), explanations.get("lose"));
  assert.notEqual(explanations.get("extremeLoss"), explanations.get("lose"));
});

test("strict and extreme loss goals never increase training duration, intensity or strength dose", () => {
  const intensity = { 轻松: 0, 中等: 1 };
  for (const experience of ["beginner", "regular"] as const) {
    for (const equipment of ["none", "dumbbells", "gym"] as const) {
      const prefs = preferences({ experience, equipment, sessionMinutes: 60 });
      const baseline = generateWeekWorkouts(profile, prefs, "2026-10-13");
      for (const goal of ["strictLoss", "extremeLoss"] as const) {
        const week = generateWeekWorkouts(
          { ...profile, goal },
          prefs,
          "2026-10-13",
        );
        assert.equal(week.length, baseline.length);
        for (let index = 0; index < week.length; index += 1) {
          const workout = week[index];
          const ordinary = baseline[index];
          assert.ok(workout.totalMinutes <= ordinary.totalMinutes);
          assert.ok(
            intensity[workout.intensity] <= intensity[ordinary.intensity],
          );
          const moves = strengthMoves(workout);
          const ordinaryMoves = strengthMoves(ordinary);
          assert.ok(moves.length <= ordinaryMoves.length);
          assert.ok(
            moves.reduce((sum, move) => sum + (move.sets ?? 1), 0) <=
              ordinaryMoves.reduce((sum, move) => sum + (move.sets ?? 1), 0),
          );
          for (const move of moves) {
            const reference = ordinaryMoves.find(
              (candidate) => candidate.moveId === move.moveId,
            );
            if (
              reference?.seconds !== undefined &&
              move.seconds !== undefined
            ) {
              assert.ok(move.seconds <= reference.seconds);
            }
            if (reference?.reps && move.reps) {
              const upperReps = Math.max(
                ...(move.reps.match(/\d+/g) ?? []).map(Number),
              );
              const ordinaryUpperReps = Math.max(
                ...(reference.reps.match(/\d+/g) ?? []).map(Number),
              );
              assert.ok(upperReps <= ordinaryUpperReps);
            }
          }
        }
      }
    }
  }
});
