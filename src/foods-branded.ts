import type { Food } from "./types";

type BrandRow = [id: string, name: string, baseId: string, aliases: string];

// 品牌索引方便按包装上的名字查找；这里没有已核验的品牌营养标签。
// 只采用现有、最接近品类的通用食物基准，不编造品牌专属营养数值。
// 干燕麦使用干重，饮品沿用通用条目的 g 单位，不推定单瓶容量或密度。
const brandRows: BrandRow[] = [
  [
    "yili-milk",
    "伊利纯牛奶",
    "whole-milk",
    "yili yi li 伊利 Yili pure whole milk",
  ],
  [
    "mengniu-milk",
    "蒙牛纯牛奶",
    "whole-milk",
    "mengniu meng niu 蒙牛 Mengniu pure whole milk",
  ],
  [
    "telunsu-milk",
    "特仑苏纯牛奶",
    "whole-milk",
    "telunsu te lun su 特侖蘇 蒙牛 Deluxe pure milk",
  ],
  [
    "satine-milk",
    "金典纯牛奶",
    "whole-milk",
    "jindian jin dian 金典 伊利 Satine pure milk",
  ],
  [
    "bright-milk",
    "光明纯牛奶",
    "whole-milk",
    "guangming guang ming 光明 Bright pure milk",
  ],
  [
    "sanyuan-milk",
    "三元纯牛奶",
    "whole-milk",
    "sanyuan san yuan 三元 Sanyuan pure milk",
  ],
  [
    "ambrosial-yogurt",
    "安慕希原味酸奶",
    "sweet-yogurt",
    "anmuxi an mu xi 安慕希 伊利 Ambrosial sweet yogurt",
  ],
  [
    "chunzhen-yogurt",
    "纯甄原味酸奶",
    "sweet-yogurt",
    "chunzhen chun zhen 純甄 蒙牛 Chunzhen sweet yogurt",
  ],
  [
    "junlebao-yogurt",
    "君乐宝原味酸奶",
    "sweet-yogurt",
    "junlebao jun le bao 君樂寶 Junlebao sweet yogurt",
  ],
  [
    "quaker-oats",
    "桂格即食燕麦片（干）",
    "ext-everyday-instant-oat-flakes",
    "guige gui ge 桂格 Quaker dry instant oats",
  ],
  [
    "seamild-oats",
    "西麦即食燕麦片（干）",
    "ext-everyday-instant-oat-flakes",
    "ximai xi mai 西麥 Seamild dry instant oats",
  ],
  [
    "kelloggs-cornflakes",
    "家乐氏玉米片（干）",
    "ext-everyday-corn-flakes",
    "jialeshi jia le shi 家樂氏 Kelloggs corn flakes cereal",
  ],
  [
    "lays-chips",
    "乐事薯片",
    "potato-chips",
    "leshi le shi 樂事 Lays Lay's potato chips",
  ],
  [
    "pringles-chips",
    "品客薯片",
    "potato-chips",
    "pinke pin ke 品客 Pringles potato chips",
  ],
  [
    "oreo-cookies",
    "奥利奥夹心饼干",
    "ext-everyday-sandwich-cookie",
    "aoliao ao li ao 奧利奧 Oreo sandwich cookies",
  ],
  [
    "chips-ahoy-cookies",
    "趣多多曲奇饼干",
    "cookies",
    "quduoduo qu duo duo 趣多多 Chips Ahoy cookies",
  ],
  [
    "orion-potato-chips",
    "好丽友薯愿薯片",
    "potato-chips",
    "haoliyou hao li you shuyuan shu yuan 好麗友 薯願 Orion potato chips",
  ],
  [
    "dove-milk-chocolate",
    "德芙牛奶巧克力",
    "milk-chocolate",
    "defu de fu 德芙 Dove milk chocolate",
  ],
  [
    "snickers-bar",
    "士力架花生巧克力棒",
    "milk-chocolate",
    "shilijia shi li jia 士力架 Snickers peanut chocolate bar",
  ],
  [
    "ferrero-chocolate",
    "费列罗榛果巧克力",
    "milk-chocolate",
    "feilieluo fei lie luo 費列羅 Ferrero Rocher hazelnut chocolate",
  ],
  [
    "kitkat-wafer",
    "雀巢奇巧威化巧克力",
    "ext-everyday-wafer-cookie",
    "quechao que chao qiqiao qi qiao 雀巢 奇巧 Nestle KitKat wafer chocolate",
  ],
  [
    "want-want-crackers",
    "旺旺雪饼",
    "ext-plant-rice-cracker",
    "wangwang wang wang xuebing xue bing 旺旺 雪餅 Want Want rice crackers",
  ],
  [
    "qiaqia-sunflower-seeds",
    "洽洽香瓜子仁",
    "ext-plant-sunflower-seed",
    "qiaqia qia qia 洽洽 恰恰 ChaCha sunflower seeds 瓜子仁",
  ],
  [
    "three-squirrels-walnuts",
    "三只松鼠核桃仁",
    "walnut",
    "sanzhisongshu san zhi song shu 三隻松鼠 Three Squirrels walnut",
  ],
  [
    "bestore-cashews",
    "良品铺子腰果",
    "cashew",
    "liangpinpuzi liang pin pu zi 良品鋪子 Bestore cashew nuts",
  ],
  [
    "coca-cola",
    "可口可乐（含糖）",
    "cola",
    "kekoukele ke kou ke le 可口可樂 Coca Cola Coke sugary soda",
  ],
  [
    "pepsi",
    "百事可乐（含糖）",
    "cola",
    "baishikele bai shi ke le 百事可樂 Pepsi sugary soda",
  ],
  [
    "coca-cola-zero",
    "可口可乐零度（无糖）",
    "zero-cola",
    "kekoukele lingdu ke kou ke le ling du 可口可樂零度 Coca Cola Zero Coke Zero sugar free",
  ],
  [
    "pepsi-zero",
    "百事可乐（无糖）",
    "zero-cola",
    "baishikele wutang bai shi ke le wu tang 百事可樂無糖 Pepsi Zero sugar free",
  ],
  [
    "sprite",
    "雪碧（含糖）",
    "cola",
    "xuebi xue bi 雪碧 Sprite lemon lime soda sugary",
  ],
  [
    "7up",
    "七喜（含糖）",
    "cola",
    "qixi qi xi 七喜 7up Seven Up lemon lime soda sugary",
  ],
  [
    "fanta-orange",
    "芬达橙味汽水（含糖）",
    "cola",
    "fenda fen da 芬達 Fanta orange soda sugary",
  ],
  [
    "vitasoy",
    "维他奶原味豆奶（含糖）",
    "ext-everyday-sweet-soymilk",
    "weitanai wei ta nai 維他奶 维他豆奶 Vitasoy soy milk sweetened",
  ],
  [
    "yonho-soymilk",
    "永和豆浆（含糖）",
    "ext-everyday-sweet-soymilk",
    "yonghe yong he 永和 豆漿 Yonho sweet soy milk",
  ],
  [
    "mizone",
    "脉动维生素饮料（含糖）",
    "sports-drink",
    "maidong mai dong 脈動 Mizone vitamin drink sugary",
  ],
  [
    "jianlibao",
    "健力宝运动饮料（含糖）",
    "sports-drink",
    "jianlibao jian li bao 健力寶 Jianlibao sports drink sugary",
  ],
  [
    "pocari-sweat",
    "宝矿力水特（含糖）",
    "sports-drink",
    "baokuanglishuite bao kuang li shui te 寶礦力水特 Pocari Sweat sports drink",
  ],
  [
    "gatorade",
    "佳得乐运动饮料（含糖）",
    "sports-drink",
    "jiadele jia de le 佳得樂 Gatorade sports drink sugary",
  ],
  [
    "wanglaoji",
    "王老吉凉茶（含糖）",
    "ext-plant-herbal-drink",
    "wanglaoji wang lao ji 王老吉 涼茶 Wang Lao Ji herbal tea sweetened",
  ],
  [
    "jiaduobao",
    "加多宝凉茶（含糖）",
    "ext-plant-herbal-drink",
    "jiaduobao jia duo bao 加多寶 涼茶 Jia Duo Bao JDB herbal tea sweetened",
  ],
  [
    "genki-forest",
    "元气森林气泡水（无糖）",
    "zero-cola",
    "yuanqisenlin yuan qi sen lin 元氣森林 氣泡水 Genki Forest sugar free sparkling water",
  ],
  [
    "uni-iced-tea",
    "统一冰红茶（含糖）",
    "ext-everyday-lemon-tea",
    "tongyi tong yi binghongcha bing hong cha 統一 冰紅茶 Uni President sweet iced black tea",
  ],
  [
    "master-kong-green-tea",
    "康师傅绿茶（含糖）",
    "ext-everyday-lemon-tea",
    "kangshifu kang shi fu lucha lv cha 康師傅 綠茶 Master Kong sweet green tea",
  ],
  [
    "oriental-leaf-tea",
    "东方树叶茶饮料（无糖）",
    "tea",
    "dongfangshuye dong fang shu ye 東方樹葉 Nongfu Spring Oriental Leaf unsweetened tea",
  ],
  [
    "nongfu-spring-water",
    "农夫山泉饮用水",
    "water",
    "nongfushanquan nong fu shan quan 農夫山泉 Nongfu Spring drinking water",
  ],
  [
    "cestbon-water",
    "怡宝饮用水",
    "water",
    "yibao yi bao 怡寶 Cestbon drinking water",
  ],
  [
    "vita-lemon-tea",
    "维他柠檬茶（含糖）",
    "ext-everyday-lemon-tea",
    "weita wei ta ningmengcha ning meng cha 維他檸檬茶 Vita lemon tea sugary",
  ],
  [
    "minute-maid-orange",
    "美汁源果粒橙饮料（含糖）",
    "orange-juice",
    "meizhiyuan mei zhi yuan guolicheng guo li cheng 美汁源 果粒橙 Minute Maid orange juice drink",
  ],
  [
    "coconut-palm",
    "椰树牌椰汁（含糖）",
    "ext-everyday-coconut-milk-drink",
    "yeshu ye shu yezhi ye zhi 椰樹 椰汁 Coconut Palm coconut milk drink sweetened",
  ],
];

export function createBrandFoods(baseFoods: Food[]): Food[] {
  const byId = new Map(baseFoods.map((food) => [food.id, food]));
  return brandRows.map(([id, name, baseId, aliases]) => {
    const base = byId.get(baseId);
    if (!base) throw new Error(`品牌参考食物缺少通用基准：${baseId}`);
    return {
      ...base,
      id: `brand-${id}`,
      name: `${name}（同类通用参考）`,
      portion: "1 份可食部分",
      portionGrams: 100,
      keywords: `${aliases} ${name} ${base.name} ${base.keywords ?? ""}`,
      note: `品牌名用于查找；数值沿用「${base.name}」每 100 g 的同类食物估算，非该品牌已核验包装标签。口味、地区和版本可能不同，请按瓶身或包装标签修正。`,
    };
  });
}
