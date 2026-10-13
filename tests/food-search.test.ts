import assert from "node:assert/strict";
import test from "node:test";
import { searchFoods } from "../src/food-search";
import type { Food } from "../src/types";
import { foods } from "../src/data";

function food(
  id: string,
  name: string,
  keywords?: string,
  category: Food["category"] = "水果",
): Food {
  return {
    id,
    name,
    keywords,
    category,
    emoji: "🍽️",
    kcal: 100,
    protein: 1,
    carbs: 20,
    fat: 1,
    portion: "1 份",
    portionGrams: 100,
  };
}
const ids = (foods: Food[]) => foods.map((item) => item.id);

test("the live catalog finds Yakult under simplified, traditional, English and pinyin names", () => {
  for (const query of [
    "养乐多",
    "養樂多",
    "益力多",
    "Yakult",
    "ＹＡＫＵＬＴ",
    "yang le duo",
    "yi li duo",
  ]) {
    const matches = searchFoods(foods, query);
    assert.deepEqual(ids(matches), ["brand-yakult-reference"], query);
    assert.equal(matches[0].unit, "ml");
    assert.match(matches[0].note ?? "", /并非经核验的品牌标签/);
  }
  assert.equal(searchFoods(foods, "").length, foods.length);
});

test("branded drink search separates sugared and zero sugar references", () => {
  const zero = searchFoods(foods, "可口可乐 无糖");
  const sugared = searchFoods(foods, "可口可乐 含糖");
  assert.ok(zero.length > 0);
  assert.ok(sugared.length > 0);
  assert.ok(zero.every((food) => food.kcal === 0));
  assert.ok(sugared.every((food) => food.kcal > 0));
  assert.ok(searchFoods(foods, "旺旺 雪饼")[0].note?.includes("米饼"));
});

test("grape aliases find the existing grape ID and new varieties with fresh fruit first", () => {
  const catalog = [
    food("raisins", "葡萄干", "putaogan raisins"),
    food("grape-juice", "葡萄汁", "grape juice"),
    food("grape", "葡萄（可食部分）", "putao grape"),
    food("red-grapes", "红提子（鲜）", "red grape"),
    food("green-grapes", "青提（鲜）", "green grape"),
    food("black-grapes", "黑提（鲜）", "black grape"),
    food("grapefruit", "西柚（葡萄柚，去皮）", "grapefruit"),
    food("apple", "苹果"),
  ];
  assert.deepEqual(ids(searchFoods(catalog, "提子")), [
    "red-grapes",
    "grape",
    "green-grapes",
    "black-grapes",
    "raisins",
    "grape-juice",
  ]);
  assert.deepEqual(ids(searchFoods(catalog, "红提")), ["red-grapes"]);
  assert.deepEqual(ids(searchFoods(catalog, "绿提子")), ["green-grapes"]);
  assert.deepEqual(ids(searchFoods(catalog, "黑提子")), ["black-grapes"]);
  assert.deepEqual(ids(searchFoods(catalog, "葡萄汁")), ["grape-juice"]);
  assert.deepEqual(ids(searchFoods(catalog, "葡萄柚")), ["grapefruit"]);
  assert.deepEqual(ids(searchFoods(catalog, "grape")), [
    "grape",
    "red-grapes",
    "green-grapes",
    "black-grapes",
    "grape-juice",
  ]);
});

test("common regional and ingredient aliases work in both directions", () => {
  const pairs = [
    ["番茄", "西红柿"],
    ["土豆", "马铃薯"],
    ["红薯", "地瓜"],
    ["猕猴桃", "奇异果"],
    ["樱桃", "车厘子"],
    ["牛油果", "鳄梨"],
    ["菠萝", "凤梨"],
    ["西兰花", "青花菜"],
    ["花菜", "花椰菜"],
    ["黄瓜", "青瓜"],
    ["茄子", "矮瓜"],
    ["彩椒", "灯笼椒"],
    ["大白菜", "黄芽菜"],
    ["上海青", "青江菜"],
    ["山药", "淮山"],
    ["黑木耳", "木耳"],
    ["银耳", "雪耳"],
    ["香菇", "冬菇"],
    ["金针菇", "金菇"],
    ["洋葱", "葱头"],
    ["香菜", "芫荽"],
    ["毛豆", "枝豆"],
    ["豆腐干", "豆干"],
    ["豆腐皮", "千张"],
    ["腐竹", "支竹"],
    ["鹰嘴豆", "鸡豆"],
    ["小扁豆", "兵豆"],
    ["花生", "落花生"],
    ["核桃", "胡桃"],
    ["榛子", "榛果"],
    ["开心果", "阿月浑子"],
    ["番石榴", "芭乐"],
    ["橘子", "桔子"],
    ["草莓", "士多啤梨"],
    ["桑葚", "桑椹"],
    ["龙眼", "桂圆"],
    ["三文鱼", "鲑鱼"],
    ["金枪鱼", "吞拿鱼"],
    ["鲅鱼", "马鲛鱼"],
    ["鲭鱼", "青花鱼"],
    ["牡蛎", "生蚝"],
    ["章鱼", "八爪鱼"],
    ["玉米", "包谷"],
    ["糯米", "江米"],
    ["大米", "稻米"],
    ["吐司", "方包"],
    ["意大利面", "意粉"],
    ["酸奶", "优酪乳"],
    ["奶酪", "起司"],
    ["炼乳", "炼奶"],
    ["酱油", "豉油"],
    ["八角", "大料"],
    ["肉桂", "桂皮"],
    ["孜然", "枯茗"],
  ];
  for (const [canonical, alias] of pairs) {
    assert.deepEqual(
      ids(searchFoods([food("canonical", canonical)], alias)),
      ["canonical"],
      `${alias} → ${canonical}`,
    );
    assert.deepEqual(
      ids(searchFoods([food("regional", alias)], canonical)),
      ["regional"],
      `${canonical} → ${alias}`,
    );
  }
});

test("NFKC, casing, punctuation, separate words, pinyin and numeric-width names work", () => {
  const catalog = [
    food("brown-rice", "糙米饭（熟）", "caomi brown rice", "主食谷物"),
    food("white-rice", "白米饭（熟）", "mifan rice", "主食谷物"),
    food("lowfat-milk", "牛奶（２％ 脂肪）", "low fat milk", "奶豆坚果"),
    food("potato", "土豆（蒸熟）", "tudou potato", "主食谷物"),
  ];
  assert.deepEqual(ids(searchFoods(catalog, "ＢＲＯＷＮ－ＲＩＣＥ")), [
    "brown-rice",
  ]);
  assert.deepEqual(ids(searchFoods(catalog, "rice brown")), ["brown-rice"]);
  assert.deepEqual(ids(searchFoods(catalog, "brownrice")), ["brown-rice"]);
  assert.deepEqual(ids(searchFoods(catalog, "ＭＩＦＡＮ")), ["white-rice"]);
  assert.deepEqual(ids(searchFoods(catalog, "牛奶 2%")), ["lowfat-milk"]);
  assert.deepEqual(ids(searchFoods(catalog, "马铃薯，蒸")), ["potato"]);
  assert.deepEqual(ids(searchFoods(catalog, "主食 谷物")), [
    "brown-rice",
    "white-rice",
    "potato",
  ]);
  assert.deepEqual(searchFoods(catalog, "brown milk"), []);
});

test("compound aliases preserve preparation suffixes without matching plain ingredients", () => {
  const catalog = [
    food("tomato", "番茄（生）", undefined, "蔬菜菌菇"),
    food("tomato-eggs", "番茄炒蛋", "西红柿炒鸡蛋", "中式菜肴"),
    food("pineapple", "菠萝（去皮）"),
    food("pineapple-juice", "菠萝汁", "pineapple juice", "饮品零食"),
    food("potato", "土豆（煮熟）", undefined, "主食谷物"),
    food("potato-strips", "土豆丝", undefined, "中式菜肴"),
  ];
  assert.deepEqual(ids(searchFoods(catalog, "西红柿炒蛋")), ["tomato-eggs"]);
  assert.deepEqual(ids(searchFoods(catalog, "凤梨汁")), ["pineapple-juice"]);
  assert.deepEqual(ids(searchFoods(catalog, "马铃薯丝")), ["potato-strips"]);
  assert.deepEqual(
    ids(searchFoods([food("regional-juice", "凤梨汁")], "菠萝汁")),
    ["regional-juice"],
  );
});

test("all matching results remain available past 40 and 500 items without mutation", () => {
  const catalog = Array.from({ length: 550 }, (_, index) =>
    food(`food-${index}`, `测试食物 ${index}`),
  );
  const before = JSON.stringify(catalog);
  for (const query of ["", "  ", "，——！", "测试食物"]) {
    const results = searchFoods(catalog, query);
    assert.equal(results.length, 550);
    assert.deepEqual(ids(results), ids(catalog));
    assert.equal(results[549], catalog[549]);
  }
  assert.equal(JSON.stringify(catalog), before);
});

test("name matches precede keyword aliases, duplicate IDs collapse, ties preserve source order", () => {
  const catalog = [
    food("keyword", "我的水果", "apple 苹果"),
    food("first", "苹果（红）"),
    food("second", "苹果（青）"),
    food("first", "重复的苹果"),
    food("dried", "苹果干"),
  ];
  assert.deepEqual(ids(searchFoods(catalog, "苹果")), [
    "first",
    "second",
    "keyword",
    "dried",
  ]);
  assert.deepEqual(ids(searchFoods(catalog, "")), [
    "keyword",
    "first",
    "second",
    "dried",
  ]);
  assert.deepEqual(ids(searchFoods(catalog, "apple")), ["keyword"]);
});

test("custom foods and imported keywords receive the same alias and multiword search", () => {
  const custom = food(
    "custom-cereal",
    "自配早餐",
    "燕麦 cinnamon oats 低糖 马铃薯",
    "自定义",
  );
  assert.deepEqual(ids(searchFoods([custom], "CINNAMON OATS")), [custom.id]);
  assert.deepEqual(ids(searchFoods([custom], "土豆 低糖")), [custom.id]);
  assert.deepEqual(ids(searchFoods([custom], "自定义")), [custom.id]);
  assert.equal(searchFoods([custom], "土豆")[0], custom);
});

test("aliases do not conflate unrelated species or overlapping regional names", () => {
  const catalog = [
    food("onion", "洋葱", undefined, "蔬菜菌菇"),
    food("scallion", "大葱", undefined, "蔬菜菌菇"),
    food("cod", "鳕鱼", "cod", "肉蛋水产"),
    food("sablefish", "银鳕鱼", "black cod sablefish", "肉蛋水产"),
    food("pineapple", "菠萝"),
    food("jackfruit", "菠萝蜜", "jackfruit"),
    food("black-fungus", "黑木耳", undefined, "蔬菜菌菇"),
    food("white-fungus", "白木耳", undefined, "蔬菜菌菇"),
    food("broccoli", "绿花椰菜", undefined, "蔬菜菌菇"),
    food("cauliflower", "花椰菜", undefined, "蔬菜菌菇"),
    food("cherry", "樱桃", "cherry"),
    food("cherry-tomato", "圣女果", "cherry tomato", "蔬菜菌菇"),
  ];
  assert.deepEqual(ids(searchFoods(catalog, "葱头")), ["onion"]);
  assert.deepEqual(ids(searchFoods(catalog, "鳕鱼")), ["cod"]);
  assert.deepEqual(ids(searchFoods(catalog, "银鳕")), ["sablefish"]);
  assert.deepEqual(ids(searchFoods(catalog, "凤梨")), ["pineapple"]);
  assert.deepEqual(ids(searchFoods(catalog, "菠萝")), ["pineapple"]);
  assert.deepEqual(ids(searchFoods(catalog, "菠萝蜜")), ["jackfruit"]);
  assert.deepEqual(ids(searchFoods(catalog, "黑木耳")), ["black-fungus"]);
  assert.deepEqual(ids(searchFoods(catalog, "雪耳")), ["white-fungus"]);
  assert.deepEqual(ids(searchFoods(catalog, "青花菜")), ["broccoli"]);
  assert.deepEqual(ids(searchFoods(catalog, "花菜")), ["cauliflower"]);
  assert.deepEqual(ids(searchFoods(catalog, "车厘子")), ["cherry"]);
  assert.deepEqual(ids(searchFoods(catalog, "cherry")), ["cherry"]);
  assert.deepEqual(ids(searchFoods(catalog, "樱桃番茄")), ["cherry-tomato"]);
  assert.deepEqual(ids(searchFoods(catalog, "cherry tomato")), [
    "cherry-tomato",
  ]);
  assert.deepEqual(searchFoods(catalog, "巧克力"), []);
});
