import type { Food } from "./types";

// Keep regional names together. Varieties use their own group so a search for
// 红提 does not turn into a search for every color of grape.
const aliasGroups: readonly (readonly string[])[] = [
  ["葡萄", "提子"],
  ["红提", "红提子", "红葡萄"],
  ["青提", "青提子", "绿提", "绿提子", "绿葡萄", "青葡萄"],
  ["黑提", "黑提子", "黑葡萄"],
  ["西柚", "葡萄柚"],
  ["番茄", "西红柿"],
  ["圣女果", "樱桃番茄", "小番茄"],
  ["土豆", "马铃薯"],
  ["红薯", "番薯", "地瓜", "甘薯"],
  ["猕猴桃", "奇异果"],
  ["樱桃", "车厘子"],
  ["牛油果", "鳄梨"],
  ["菠萝", "凤梨"],
  ["西兰花", "青花菜", "绿花椰菜"],
  ["花菜", "菜花", "花椰菜"],
  ["黄瓜", "青瓜"],
  ["茄子", "矮瓜"],
  ["甜椒", "彩椒", "灯笼椒", "柿子椒"],
  ["大白菜", "黄芽菜", "结球白菜"],
  ["上海青", "青江菜"],
  ["山药", "淮山"],
  ["木耳", "黑木耳"],
  ["银耳", "白木耳", "雪耳"],
  ["香菇", "冬菇", "花菇"],
  ["金针菇", "金菇"],
  ["洋葱", "葱头"],
  ["香菜", "芫荽", "胡荽"],
  ["毛豆", "枝豆"],
  ["豆腐干", "豆干"],
  ["豆腐皮", "千张", "豆百叶"],
  ["腐竹", "支竹"],
  ["鹰嘴豆", "鸡豆"],
  ["小扁豆", "兵豆"],
  ["花生", "落花生"],
  ["核桃", "胡桃"],
  ["榛子", "榛果"],
  ["开心果", "阿月浑子"],
  ["番石榴", "芭乐"],
  ["橘子", "桔子"],
  ["油桃", "桃驳李"],
  ["草莓", "士多啤梨"],
  ["桑葚", "桑椹", "桑果"],
  ["龙眼", "桂圆"],
  ["三文鱼", "鲑鱼"],
  ["金枪鱼", "吞拿鱼"],
  ["鲅鱼", "马鲛鱼"],
  ["鲭鱼", "青花鱼"],
  ["秋刀鱼", "竹刀鱼"],
  ["牡蛎", "生蚝", "蚵仔"],
  ["鱿鱼", "枪乌贼"],
  ["墨鱼", "乌贼", "花枝"],
  ["章鱼", "八爪鱼"],
  ["玉米", "苞米", "苞谷", "包谷"],
  ["糯米", "江米"],
  ["大米", "稻米"],
  ["荞麦", "乌麦"],
  ["通心粉", "通心面"],
  ["吐司", "土司", "方包"],
  ["意大利面", "意面", "意粉"],
  ["酸奶", "酸乳", "优酪乳"],
  ["奶酪", "芝士", "起司"],
  ["淡奶油", "稀奶油"],
  ["炼乳", "炼奶"],
  ["酱油", "豉油"],
  ["味精", "味素"],
  ["辣椒粉", "辣椒面"],
  ["八角", "大料", "大茴香"],
  ["肉桂", "桂皮"],
  ["孜然", "枯茗"],
];

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const normalizedGroups = aliasGroups.map((group) => group.map(normalize));
const knownAliases = new Set(normalizedGroups.flat());
const derivedFood =
  /汁|干|脯|酱|罐头|果茶|果冻|奶茶|奶昔|糖浆|蜜饯|酒|风味|粉|蛋糕|饼干|冰淇淋|冰激凌|籽油|果油|juice|dried|raisin|jam|jelly|syrup|wine|candied|powder|cake|cookie|icecream|milkshake|flavou?r/u;

// Similar-looking names are not automatically aliases. 银鳕 and 菠萝蜜 are
// different foods from true cod and pineapple, respectively.
const unrelatedNames = [
  {
    terms: ["葡萄", "提子", "grape"],
    names: ["葡萄柚", "西柚", "grapefruit", "海葡萄", "葡萄糖"],
  },
  {
    terms: ["樱桃", "车厘子", "cherry"],
    names: ["樱桃番茄", "圣女果", "cherrytomato", "樱桃萝卜"],
  },
  {
    terms: ["鳕鱼", "真鳕", "大西洋鳕", "太平洋鳕", "cod"],
    names: ["银鳕", "黑鳕", "裸盖鱼"],
  },
  { terms: ["菠萝", "凤梨", "pineapple"], names: ["菠萝蜜"] },
  {
    terms: ["花菜", "菜花", "花椰菜"],
    names: ["绿花椰菜", "青花菜", "西兰花"],
  },
] as const;

function relatedToQuery(
  name: string,
  terms: string[],
  fullQuery: string,
): boolean {
  return !unrelatedNames.some(
    (rule) =>
      rule.terms.some((term) => terms.includes(term)) &&
      rule.names.some((other) => name.includes(other)) &&
      !rule.names.some((other) => fullQuery.includes(other)),
  );
}

function aliasesFor(fields: string[]): string[] {
  const aliases = new Set<string>();
  for (const field of fields) {
    const matches: { group: string[]; start: number; end: number }[] = [];
    for (const group of normalizedGroups)
      for (const alias of group) {
        // For example 菠萝蜜 must not acquire the 凤梨 alias.
        if (
          unrelatedNames.some(
            (rule) =>
              rule.terms.some((term) => term === alias) &&
              rule.names.some((other) => field.includes(other)),
          )
        )
          continue;
        let start = field.indexOf(alias);
        while (start !== -1) {
          matches.push({ group, start, end: start + alias.length });
          start = field.indexOf(alias, start + 1);
        }
      }
    for (const match of matches) {
      // Prefer a longer overlapping name: 白木耳 is 银耳, not 黑木耳;
      // 绿花椰菜 is 西兰花, not white cauliflower.
      if (
        matches.some(
          (other) =>
            other.start <= match.start &&
            other.end >= match.end &&
            other.end - other.start > match.end - match.start,
        )
      )
        continue;
      for (const alias of match.group) {
        aliases.add(alias);
        // Preserve preparation words in compound searches such as 凤梨汁 and
        // 西红柿炒蛋. Replace one matched span, without combinatorial expansion.
        aliases.add(
          `${field.slice(0, match.start)}${alias}${field.slice(match.end)}`,
        );
      }
      if (
        match.group.some((alias) => ["红提", "青提", "黑提"].includes(alias))
      ) {
        // A general grape search includes these varieties, while a color-specific
        // search stays within its own group.
        aliases.add("葡萄");
        aliases.add("提子");
      }
    }
  }
  return [...aliases];
}

/** Search every food with AND semantics for separate words; never caps results. */
export function searchFoods(catalog: Food[], query: string): Food[] {
  const seen = new Set<string>();
  const uniqueCatalog = catalog.filter((food) => {
    if (seen.has(food.id)) return false;
    seen.add(food.id);
    return true;
  });
  const terms = [
    ...new Set(
      query
        .normalize("NFKC")
        .toLowerCase()
        .split(/[\s\p{P}\p{S}]+/u)
        .map(normalize)
        .filter(Boolean),
    ),
  ];
  if (!terms.length) return uniqueCatalog;
  const fullQuery = normalize(query);
  const queryRequestsDerived = derivedFood.test(fullQuery);
  const matches: {
    food: Food;
    index: number;
    rank: number;
    derived: boolean;
  }[] = [];
  uniqueCatalog.forEach((food, index) => {
    const name = normalize(food.name);
    if (!relatedToQuery(name, terms, fullQuery)) return;
    const keywords = normalize(food.keywords ?? "");
    const category = normalize(food.category);
    const aliases = aliasesFor([name, keywords]);
    let rank = 0;
    for (const term of terms) {
      if (name.includes(term)) continue;
      if (
        keywords.includes(term) ||
        aliases.some((alias) =>
          knownAliases.has(term) ? alias === term : alias.includes(term),
        )
      )
        rank = Math.max(rank, 1);
      else if (category.includes(term)) rank = Math.max(rank, 2);
      else return;
    }
    matches.push({
      food,
      index,
      rank,
      derived: !queryRequestsDerived && derivedFood.test(name),
    });
  });
  return matches
    .sort(
      (a, b) =>
        Number(a.derived) - Number(b.derived) ||
        a.rank - b.rank ||
        a.index - b.index,
    )
    .map((match) => match.food);
}
