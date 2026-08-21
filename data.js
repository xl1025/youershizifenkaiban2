
    // ========== 自然元素识字数据 ==========
    // 字段说明：char 汉字 | pinyin 拼音 | english 英文 | words 组词 | meaning 释义
    //          radical 部首 | strokes 笔画数 | structure 字形结构 | sentence 造句示例 | strokesName 笔画名称(按笔顺)
    const literacyData = [
        // 第一排：天文气象
        { id: "ri",   char: "日", pinyin: "rì",   english: "SUN",       words: ["日出", "节日"], meaning: "太阳给我们带来光明和温暖，每天东升西落。", radical: "日", strokes: 4,  structure: "独体字",   sentence: "早晨，红红的太阳从东方升起。", strokesName: ["竖","横折","横","横"], image: "日.mp4", poster: "日.jpg", col: 0, row: 0 },
        { id: "yue",  char: "月", pinyin: "yuè",  english: "MOON",      words: ["月亮", "明月"], meaning: "月亮是地球的卫星，晚上会发出柔和的光。", radical: "月", strokes: 4,  structure: "独体字",   sentence: "十五的月亮又圆又亮。", strokesName: ["撇","横折钩","横","横"], image: "月.mp4", poster: "月.jpg", col: 1, row: 0 },
        { id: "xing", char: "星", pinyin: "xīng", english: "STAR",      words: ["星星", "星空"], meaning: "星星是夜空中闪闪发光的天体，数量非常多。", radical: "日", strokes: 9,  structure: "上下结构", sentence: "夜空中闪烁着无数颗小星星。", strokesName: ["竖","横折","横","横","撇","横","横","竖","横"], image: "星.mp4", poster: "星.jpg", col: 2, row: 0 },
        { id: "yun",  char: "云", pinyin: "yún",  english: "CLOUD",     words: ["白云", "云朵"], meaning: "云是天空中的水汽凝结成的白色漂浮物。", radical: "二", strokes: 4,  structure: "独体字",   sentence: "天空中飘着一朵朵白云。", strokesName: ["横","横","撇折","点"], image: "云.mp4", poster: "云.jpg", col: 3, row: 0 },
        { id: "feng1",char: "风", pinyin: "fēng", english: "WIND",      words: ["大风", "风车"], meaning: "风是空气流动形成的，可以吹动树叶和风车。", radical: "风", strokes: 4,  structure: "半包围结构", sentence: "春风轻轻地吹过柳枝。", strokesName: ["撇","横折弯钩","撇","点"], image: "风.mp4", poster: "风.jpg", col: 4, row: 0 },

        // 第二排：自然现象
        { id: "bing", char: "冰", pinyin: "bīng", english: "ICE",       words: ["冰雪", "结冰"], meaning: "冰是水在很冷的时候结成的固体，摸起来凉凉的、滑滑的。冬天湖面会结冰。", radical: "冫", strokes: 6,  structure: "左右结构",   sentence: "冬天，河面上结了一层薄薄的冰。", strokesName: ["点","提","竖钩","横撇","撇","捺"], image: "冰.mp4", poster: "冰.jpg", col: 0, row: 1 },
        { id: "yu",   char: "雨", pinyin: "yǔ",   english: "RAIN",      words: ["下雨", "雨水"], meaning: "雨是从云中降落的水滴，能滋润花草树木。", radical: "雨", strokes: 8,  structure: "独体字",   sentence: "下雨了，小动物们都躲回了家。", strokesName: ["横","竖","横折钩","竖","点","点","点","点"], image: "雨.mp4", poster: "雨.jpg", col: 1, row: 1 },
        { id: "xue",  char: "雪", pinyin: "xuě",  english: "SNOW",      words: ["下雪", "雪人"], meaning: "雪是天气寒冷时从天上飘下来的白色雪花。", radical: "雨", strokes: 11, structure: "上下结构", sentence: "冬天到了，天上飘起了雪花。", strokesName: ["横","竖","横折钩","竖","点","点","点","点","横折","横","横"], image: "雪.mp4", poster: "雪.jpg", col: 2, row: 1 },
        { id: "shan", char: "山", pinyin: "shān", english: "MOUNTAIN",  words: ["高山", "爬山"], meaning: "山是地面隆起的高地，山上有很多植物和动物。", radical: "山", strokes: 3,  structure: "独体字",   sentence: "远处的高山上覆盖着白雪。", strokesName: ["竖","竖折","竖"], image: "山.mp4", poster: "山.jpg", col: 3, row: 1 },
        { id: "shi",  char: "石", pinyin: "shí",  english: "ROCK",      words: ["石头", "岩石"], meaning: "石头是坚硬的矿物，有的圆圆的，有的尖尖的。", radical: "石", strokes: 5,  structure: "独体字",   sentence: "溪水里的石头被冲刷得圆圆的。", strokesName: ["横","撇","竖","横折","横"], image: "石.mp4", poster: "石.jpg", col: 4, row: 1 },

        // 第三排：地理元素
        { id: "shui", char: "水", pinyin: "shuǐ", english: "WATER",     words: ["喝水", "河水"], meaning: "水是生命之源，我们每天都需要喝干净的水。", radical: "水", strokes: 4,  structure: "独体字",   sentence: "河水清澈，小鱼在水中游来游去。", strokesName: ["竖钩","横撇","撇","捺"], image: "水.mp4", poster: "水.jpg", col: 0, row: 2 },
        { id: "huo",  char: "火", pinyin: "huǒ",  english: "FIRE",      words: ["大火", "篝火"], meaning: "火可以取暖、做饭，但小朋友要远离火源哦！", radical: "火", strokes: 4,  structure: "独体字",   sentence: "篝火温暖了露营的夜晚。", strokesName: ["点","撇","撇","捺"], image: "火.mp4", poster: "火.jpg", col: 1, row: 2 },
        { id: "tu",   char: "土", pinyin: "tǔ",   english: "EARTH",     words: ["泥土", "土地"], meaning: "泥土是大地的皮肤，花草树木都生长在土里。", radical: "土", strokes: 3,  structure: "独体字",   sentence: "泥土里钻出了一棵嫩绿的小芽。", strokesName: ["横","竖","横"], image: "土.mp4", poster: "土.jpg", col: 2, row: 2 },
        { id: "sha",  char: "沙", pinyin: "shā",  english: "SAND",      words: ["沙子", "沙漠"], meaning: "沙子是细小的石粒，沙滩上有好多好玩的沙子。", radical: "氵", strokes: 7,  structure: "左右结构", sentence: "沙滩上留下了一串小脚印。", strokesName: ["点","点","提","竖","撇","点","撇"], image: "沙.mp4", poster: "沙.jpg", col: 3, row: 2 },
        { id: "di",   char: "地", pinyin: "dì",   english: "LAND",      words: ["地球", "草地"], meaning: "大地是我们脚下踩着的土地，也是我们的家园。", radical: "土", strokes: 6,  structure: "左右结构", sentence: "草地上开满了五颜六色的小花。", strokesName: ["横","竖","提","横折钩","竖","竖弯钩"], image: "地.mp4", poster: "地.jpg", col: 4, row: 2 }
    ];

    // ========== 动物园识字数据（动物王国，资源位于项目根目录） ==========
    // 字段结构与 literacyData 完全一致，复用全部交互逻辑
    const zooData = [
        // 第一排：十二生肖前六
        { id: "shu",   char: "鼠", pinyin: "shǔ",  english: "RAT",       words: ["老鼠", "田鼠"], meaning: "鼠是一种小巧灵活的哺乳动物，门牙会不断生长，所以需要经常磨牙。", radical: "鼠", strokes: 13, structure: "独体字", sentence: "小老鼠偷偷从洞里钻出来找食物吃。", strokesName: ["撇","竖","横","横折","横","横","竖提","点","点","竖提","点","点","斜钩"], image: "鼠.mp4", poster: "鼠.jpg", col: 0, row: 0 },
        { id: "niu",  char: "牛", pinyin: "niú",  english: "OX",        words: ["黄牛", "奶牛"], meaning: "牛是勤劳的动物，能帮农民耕田拉车，还给我们提供牛奶。", radical: "牛", strokes: 4,  structure: "独体字", sentence: "老牛在河边悠闲地吃着青草。", strokesName: ["撇","横","横","竖"], image: "牛.mp4", poster: "牛.jpg", col: 1, row: 0 },
        { id: "hu",   char: "虎", pinyin: "hǔ",   english: "TIGER",     words: ["老虎", "猛虎"], meaning: "虎是森林之王，身上有漂亮的条纹，非常威武强壮。", radical: "虍", strokes: 8,  structure: "半包围结构", sentence: "大老虎在山林里大声吼叫。", strokesName: ["竖","横","横撇","撇","横","竖弯钩","撇","横折弯钩"], image: "虎.mp4", poster: "虎.jpg", col: 2, row: 0 },
        { id: "tu",   char: "兔", pinyin: "tù",   english: "RABBIT",    words: ["兔子", "白兔"], meaning: "兔有长长的耳朵和短尾巴，喜欢蹦蹦跳跳地吃胡萝卜。", radical: "刀", strokes: 8,  structure: "上下结构", sentence: "小白兔在草地上快乐地跳来跳去。", strokesName: ["撇","横撇","竖","横折","横","撇","竖弯钩","点"], image: "兔.mp4", poster: "兔.jpg", col: 3, row: 0 },
        { id: "long", char: "龙", pinyin: "lóng", english: "DRAGON",    words: ["巨龙", "龙船"], meaning: "龙是中国神话中的神兽，象征着力量、吉祥和好运。", radical: "龙", strokes: 5,  structure: "独体字", sentence: "端午节大家划着龙船在河上比赛。", strokesName: ["横","撇","竖弯钩","撇","点"], image: "龙.mp4", poster: "龙.jpg", col: 4, row: 0 },
        { id: "she",  char: "蛇", pinyin: "shé",  english: "SNAKE",     words: ["毒蛇", "蟒蛇"], meaning: "蛇没有脚，靠身体蜿蜒爬行，每年都会蜕一次皮长出新皮。", radical: "虫", strokes: 11, structure: "左右结构", sentence: "小蛇在草丛中悄悄地爬行。", strokesName: ["竖","横折","横","竖","横","点","点","点","横撇","撇","竖弯钩"], image: "蛇.mp4", poster: "蛇.jpg", col: 5, row: 0 },

        // 第二排：十二生肖后六
        { id: "ma",   char: "马", pinyin: "mǎ",   english: "HORSE",     words: ["小马", "骏马"], meaning: "马跑得很快，古代时是重要的交通工具和作战坐骑。", radical: "马", strokes: 3,  structure: "独体字", sentence: "小马在草原上自由自在地奔跑。", strokesName: ["横折","竖折折钩","横"], image: "马.mp4", poster: "马.jpg", col: 0, row: 1 },
        { id: "yang", char: "羊", pinyin: "yáng", english: "SHEEP",     words: ["绵羊", "山羊"], meaning: "羊性情温顺，身上的毛可以做成温暖的毛衣和毯子。", radical: "羊", strokes: 6,  structure: "独体字", sentence: "小羊在山坡上咩咩地叫着吃草。", strokesName: ["点","撇","横","横","横","竖"], image: "羊.mp4", poster: "羊.jpg", col: 1, row: 1 },
        { id: "hou",  char: "猴", pinyin: "hóu",  english: "MONKEY",    words: ["猴子", "猿猴"], meaning: "猴聪明又灵巧，喜欢在树上跳来跳去，最爱吃桃子和香蕉。", radical: "犭", strokes: 12, structure: "左右结构", sentence: "小猴子在树上荡秋千玩得真开心。", strokesName: ["撇","弯钩","撇","撇","竖","横折","横","撇","横","横","撇","捺"], image: "猴.mp4", poster: "猴.jpg", col: 2, row: 1 },
        { id: "ji",   char: "鸡", pinyin: "jī",   english: "ROOSTER",   words: ["公鸡", "母鸡"], meaning: "鸡每天早上打鸣叫人们起床，还会下蛋给我们吃。", radical: "又", strokes: 7,  structure: "左右结构", sentence: "大公鸡站在墙头上喔喔地打鸣。", strokesName: ["横撇","点","撇","横折钩","点","竖折折钩","横"], image: "鸡.mp4", poster: "鸡.jpg", col: 3, row: 1 },
        { id: "gou",  char: "狗", pinyin: "gǒu",  english: "DOG",       words: ["小狗", "花狗"], meaning: "狗是人类最忠诚的朋友，会看家护院、帮助警察抓坏人。", radical: "犭", strokes: 8,  structure: "左右结构", sentence: "小狗看见主人回家高兴地摇尾巴。", strokesName: ["撇","弯钩","撇","撇","横折钩","竖","横折","横"], image: "狗.mp4", poster: "狗.jpg", col: 4, row: 1 },
        { id: "zhu",  char: "猪", pinyin: "zhū",  english: "PIG",       words: ["小猪", "野猪"], meaning: "猪胖乎乎的，鼻子大大的，爱睡觉也爱吃东西。", radical: "犭", strokes: 11, structure: "左右结构", sentence: "小猪在泥坑里滚来滚去玩得开心。", strokesName: ["撇","弯钩","撇","横","竖","横","撇","竖","横折","横","横"], image: "猪.mp4", poster: "猪.jpg", col: 5, row: 1 },

        // 第三排：更多动物朋友
        { id: "mao",  char: "猫", pinyin: "māo",  english: "CAT",       words: ["小猫", "花猫"], meaning: "猫眼睛亮亮的，晚上也能看清东西，最喜欢捉老鼠和睡懒觉。", radical: "犭", strokes: 11, structure: "左右结构", sentence: "小花猫趴在窗台上晒太阳。", strokesName: ["撇","弯钩","撇","横","竖","竖","竖","横折","横","竖","横"], image: "猫.mp4", poster: "猫.jpg", col: 0, row: 2 },
        { id: "xiang",char: "象",pinyin: "xiàng",english: "ELEPHANT",  words: ["大象", "象牙"], meaning: "象是世界上最大的陆地动物，长长的鼻子能卷起很重的东西。", radical: "⺤", strokes: 11, structure: "独体字", sentence: "大象用长长的鼻子喷水洗澡。", strokesName: ["撇","横撇","竖","横折","横","撇","弯钩","撇","撇","撇","捺"], image: "象.mp4", poster: "象.jpg", col: 1, row: 2 },
        { id: "xiong",char: "熊",pinyin: "xióng",english: "BEAR",      words: ["黑熊", "熊猫"], meaning: "熊力气很大，冬天要冬眠，喜欢吃蜂蜜和鱼。", radical: "灬", strokes: 14, structure: "上下结构", sentence: "大熊在森林里寻找蜂蜜吃。", strokesName: ["撇折","点","竖","横折钩","横","横","撇","竖弯钩","撇","竖弯钩","点","点","点","点"], image: "熊.mp4", poster: "熊.jpg", col: 2, row: 2 },
        { id: "shi2", char: "狮",pinyin: "shī",  english: "LION",      words: ["狮子", "雄狮"], meaning: "狮是草原之王，雄狮有威风凛凛的鬃毛，吼声能传很远。", radical: "犭", strokes: 9,  structure: "左右结构", sentence: "雄狮站在岩石上守护着它的领地。", strokesName: ["撇","弯钩","撇","竖","撇","横","竖","横折钩","竖"], image: "狮.mp4", poster: "狮.jpg", col: 3, row: 2 },
        { id: "niao", char: "鸟",pinyin: "niǎo",  english: "BIRD",      words: ["小鸟", "飞鸟"], meaning: "鸟有羽毛和翅膀，能在天空中自由飞翔，唱出动听的歌。", radical: "鸟", strokes: 5,  structure: "独体字", sentence: "小鸟在树枝上叽叽喳喳地唱歌。", strokesName: ["撇","横折钩","点","竖折折钩","横"], image: "鸟.mp4", poster: "鸟.jpg", col: 4, row: 2 },
        { id: "yu2",  char: "鱼",pinyin: "yú",   english: "FISH",       words: ["小鱼", "金鱼"], meaning: "鱼生活在水里，用鳃呼吸，用鳍游泳，摆动尾巴前进。", radical: "鱼", strokes: 8,  structure: "独体字", sentence: "小鱼在清澈的河水里游来游去。", strokesName: ["撇","横撇","竖","横折","横","竖","横","横"], image: "鱼.mp4", poster: "鱼.jpg", col: 5, row: 2 }
    ];

    // ========== 奖励图标库 ==========
    const rewardLibrary = [
        { icon: '🌟', text: '解锁星星徽章！' },
        { icon: '🌸', text: '获得一朵小红花！' },
        { icon: '👍', text: '太棒啦，给你大拇指！' },
        { icon: '🏆', text: '识字小冠军！' },
        { icon: '👑', text: '汉字小国王！' },
        { icon: '🎈', text: '气球飞起来啦！' },
        { icon: '🦋', text: '蝴蝶为你跳舞！' },
        { icon: '🍭', text: '甜甜的奖励！' }
    ];
    