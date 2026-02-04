/**
 * Emotion Detector - 从文本中检测情绪
 * 
 * 根据 AI 回复的文本内容，推断应该展示的表情
 * 
 * v2.0 - SOTA 优化版
 * - 支持24种表情类型
 * - 扩展关键词库 (300+ 关键词)
 * - 上下文感知检测
 * - 情绪强度分析
 */

import type { Expression } from './AvatarController';

// 情绪关键词映射 - 扩展到24种情绪，300+关键词
const EMOTION_KEYWORDS: Record<Expression, string[]> = {
  // === 基础情绪 ===
  happy: [
    // 中文
    '哈哈', '嘻嘻', '开心', '高兴', '太棒了', '好耶', '真好', '喜欢', '爱',
    '棒', '赞', '厉害', '牛', '酷', '漂亮', '美', '可爱', '萌', '甜',
    '恭喜', '祝贺', '成功', '胜利', '完美', '精彩', '有趣', '好玩',
    '感谢', '谢谢', '开心死了', '乐', '嘿嘿', '哇塞', '太好了', '真棒',
    '幸福', '快乐', '欢乐', '愉快', '欣慰', '满意', '舒心', '畅快',
    '❤️', '💕', '😊', '😄', '🎉', '✨', '🥳', '😁', '💖', '🌟',
    // English
    'happy', 'glad', 'great', 'awesome', 'wonderful', 'amazing',
    'love', 'like', 'cute', 'nice', 'good', 'excellent', 'perfect',
    'thanks', 'congratulations', 'yay', 'haha', 'lol', 'fantastic',
    'brilliant', 'superb', 'terrific', 'magnificent', 'delightful',
  ],
  
  sad: [
    // 中文
    '难过', '伤心', '悲伤', '哭', '呜呜', '唉', '叹气', '遗憾',
    '抱歉', '对不起', '不好意思', '失败', '糟糕', '可惜', '失望',
    '孤独', '寂寞', '累', '疲惫', '辛苦', '痛苦', '心痛', '难受',
    '郁闷', '沮丧', '消沉', '低落', '忧伤', '哀愁', '凄凉', '惨',
    '呜', '555', 'qaq', 'qwq', '泪目', '眼泪', '哭了', '想哭',
    '😢', '😭', '💔', '🥺', '😿', '😞',
    // English
    'sad', 'sorry', 'unfortunately', 'regret', 'disappointed',
    'lonely', 'tired', 'exhausted', 'failed', 'miss you',
    'heartbroken', 'depressed', 'miserable', 'gloomy', 'unhappy',
  ],
  
  surprised: [
    // 中文
    '哇', '天啊', '什么', '真的吗', '不会吧', '居然', '竟然',
    '没想到', '意外', '惊讶', '震惊', '不敢相信', '好厉害',
    '卧槽', '我靠', '天呐', '我去', '哎呀', '哦豁', '离谱',
    '神奇', '不可思议', '奇迹', '绝了', '惊了', '服了',
    '？！', '！？', '???', '!!!', '⁉️',
    '😮', '😲', '🤯', '❗', '❓', '😱', '🙀', '😳',
    // English
    'wow', 'omg', 'what', 'really', 'seriously', 'no way',
    'incredible', 'unbelievable', 'surprising', 'shocked',
    'astonishing', 'stunning', 'mind-blowing', 'wtf',
  ],
  
  angry: [
    // 中文
    '生气', '愤怒', '恼火', '火大', '气死', '讨厌', '烦', '烦躁',
    '可恶', '该死', '混蛋', '笨蛋', '白痴', '蠢', '傻',
    '滚', '闭嘴', '够了', '受够', '无语', '崩溃', '抓狂',
    '不爽', '郁闷', '窝火', '来气', '冒火', '暴躁', '狂怒',
    '😤', '😠', '😡', '🤬', '💢', '👿',
    // English
    'angry', 'mad', 'furious', 'annoyed', 'irritated', 'frustrated',
    'hate', 'damn', 'stupid', 'idiot', 'shut up', 'enough',
  ],
  
  fear: [
    // 中文
    '害怕', '恐惧', '恐怖', '可怕', '吓人', '吓死', '惊恐',
    '担心', '忧虑', '紧张', '不安', '慌', '慌张', '惊慌',
    '瑟瑟发抖', '怕怕', '救命', '逃', '躲', '小心', '危险',
    '噩梦', '阴影', '创伤', '瘆人', '毛骨悚然', '心惊胆战',
    '😨', '😰', '😱', '🫣', '💀', '👻',
    // English
    'afraid', 'scared', 'terrified', 'frightened', 'horror',
    'nervous', 'worried', 'anxious', 'panic', 'help', 'danger',
  ],
  
  disgusted: [
    // 中文
    '恶心', '厌恶', '讨厌', '反感', '嫌弃', '鄙视', '唾弃',
    '呕', '吐了', '受不了', '难以接受', '无法忍受', '恶',
    '脏', '臭', '丑', '难看', '倒胃口', '作呕', '想吐',
    '🤢', '🤮', '😒', '🙄', '😑',
    // English
    'disgusted', 'gross', 'yuck', 'ew', 'nasty', 'revolting',
    'repulsive', 'vile', 'sick', 'nauseating',
  ],
  
  // === 积极情绪 ===
  excited: [
    // 中文
    '兴奋', '激动', '期待', '迫不及待', '等不及', '好期待',
    '太刺激', '爽', '痛快', '过瘾', '带劲', '燃', '热血',
    '冲', '冲鸭', '冲冲冲', '加油', '奥利给', '给力',
    '🔥', '🚀', '💪', '⚡', '🎯', '🏆',
    // English
    'excited', 'thrilled', 'pumped', 'hyped', 'cant wait',
    'eager', 'enthusiastic', 'fired up', 'psyched',
  ],
  
  proud: [
    // 中文
    '骄傲', '自豪', '得意', '荣幸', '光荣', '值得', '做到了',
    '成就', '成功', '胜利', '冠军', '第一', '最棒', '最强',
    '了不起', '佩服自己', '厉害了', '我可以', '我能行',
    '🏅', '🎖️', '👑', '🏆', '⭐',
    // English
    'proud', 'accomplished', 'honored', 'glory', 'achievement',
    'victory', 'champion', 'winner', 'nailed it',
  ],
  
  loving: [
    // 中文
    '爱你', '喜欢你', '爱', '心动', '暗恋', '想你', '思念',
    '亲爱的', '宝贝', '甜蜜', '浪漫', '温柔', '深情', '痴情',
    '告白', '表白', '牵手', '拥抱', '亲亲', '么么哒', 'mua',
    '💗', '💓', '💘', '💝', '💑', '😘', '🥰', '😍',
    // English
    'love you', 'adore', 'cherish', 'dear', 'sweetheart',
    'honey', 'darling', 'romantic', 'affection', 'kiss',
  ],
  
  grateful: [
    // 中文
    '感谢', '感激', '感恩', '谢谢', '多谢', '太感谢', '不胜感激',
    '辛苦了', '麻烦你', '帮大忙', '救命恩人', '恩人', '贵人',
    '铭记', '难忘', '受益', '获益', '承蒙', '感谢有你',
    '🙏', '🤝', '💐', '🎁',
    // English
    'thank', 'grateful', 'appreciate', 'thankful', 'thanks a lot',
    'much appreciated', 'bless', 'gratitude',
  ],
  
  hopeful: [
    // 中文
    '希望', '期待', '期盼', '盼望', '憧憬', '向往', '展望',
    '未来', '明天会更好', '相信', '乐观', '会好的', '有希望',
    '光明', '曙光', '美好', '愿望', '许愿', '祈祷', '祝福',
    '🌈', '🌅', '🌄', '✨', '🙌',
    // English
    'hope', 'hopeful', 'looking forward', 'optimistic', 'wish',
    'dream', 'aspire', 'bright future', 'fingers crossed',
  ],
  
  amused: [
    // 中文
    '笑死', '太逗了', '搞笑', '好笑', '滑稽', '幽默', '诙谐',
    '有意思', '乐了', '笑喷', '绷不住', '没绷住', '笑出声',
    '哈哈哈', '嘻嘻嘻', '噗', '哎哟', '笑不活了', '笑拉了',
    '🤣', '😂', '😆', '🤭', '😹',
    // English
    'funny', 'hilarious', 'amusing', 'lmao', 'rofl',
    'laughing', 'crack up', 'joke', 'humor',
  ],
  
  relieved: [
    // 中文
    '放心', '安心', '松了口气', '如释重负', '终于', '好险',
    '还好', '幸好', '庆幸', '逃过一劫', '化险为夷', '没事了',
    '搞定', '解决了', '完成了', '结束了', '轻松', '释然',
    '😌', '😮‍💨', '🥲', '😅',
    // English
    'relieved', 'relief', 'finally', 'phew', 'thank goodness',
    'close call', 'dodged', 'safe', 'all good',
  ],
  
  // === 消极情绪 ===
  anxious: [
    // 中文
    '焦虑', '焦急', '着急', '急', '急死了', '等不了',
    '紧张', '忐忑', '不安', '担忧', '忧心', '心慌',
    '坐立不安', '心神不宁', '七上八下', '惴惴不安',
    '怎么办', '完了', '来不及', '赶不上', '糟了',
    '😟', '😧', '😥', '🥴',
    // English
    'anxious', 'worried', 'nervous', 'uneasy', 'restless',
    'stressed', 'tense', 'panicking', 'freaking out',
  ],
  
  embarrassed: [
    // 中文
    '害羞', '不好意思', '尴尬', '脸红', '羞涩', '腼腆',
    '社死', '太丢人', '出糗', '丢脸', '难为情', '羞耻',
    '无地自容', '找个地缝钻', '想死', '好丢人', '窘',
    '😳', '🙈', '😶', '🫠', '🥵',
    // English
    'embarrassed', 'shy', 'awkward', 'cringe', 'ashamed',
    'mortified', 'blushing', 'flustered',
  ],
  
  confused: [
    // 中文
    '困惑', '迷惑', '疑惑', '不懂', '不明白', '不理解',
    '搞不懂', '想不通', '糊涂', '迷茫', '茫然', '懵',
    '蒙圈', '一脸懵', '黑人问号', '什么意思', '啥意思',
    '为什么', '为啥', '怎么回事', '咋回事', '搞不清',
    '🤔', '❓', '🧐', '😕', '🤷',
    // English
    'confused', 'puzzled', 'perplexed', 'dont understand',
    'what do you mean', 'lost', 'bewildered', 'baffled',
  ],
  
  bored: [
    // 中文
    '无聊', '没意思', '乏味', '枯燥', '单调', '闷',
    '好无聊', '无趣', '没劲', '没事干', '干嘛呢', '发呆',
    '摸鱼', '划水', '闲着', '空虚', '虚度', '浪费时间',
    '😐', '😑', '🥱', '😴', '💤',
    // English
    'bored', 'boring', 'dull', 'tedious', 'nothing to do',
    'meh', 'whatever', 'yawn', 'snooze',
  ],
  
  disappointed: [
    // 中文
    '失望', '太失望', '好失望', '令人失望', '让人失望',
    '不如预期', '没达到', '差强人意', '差点意思', '还差得远',
    '白期待', '白费', '泡汤', '落空', '破灭', '幻灭',
    '唉', '算了', '罢了', '不抱希望', '心凉',
    '😔', '😕', '🙁', '☹️',
    // English
    'disappointed', 'let down', 'underwhelmed', 'dissatisfied',
    'not what i expected', 'bummed', 'letdown',
  ],
  
  lonely: [
    // 中文
    '孤独', '寂寞', '孤单', '一个人', '独自', '落单',
    '形单影只', '孤身', '无人陪伴', '没人理', '被冷落',
    '想找人聊天', '谁在', '有人吗', '好孤独', '太孤独',
    '🥺', '😢', '🌙', '🍂',
    // English
    'lonely', 'alone', 'isolated', 'solitary', 'by myself',
    'nobody', 'no one', 'all alone',
  ],
  
  // === 复杂情绪 ===
  thinking: [
    // 中文
    '想想', '思考', '考虑', '琢磨', '斟酌', '权衡',
    '让我想想', '容我思考', '嗯...', '这个嘛', '我觉得',
    '分析', '推理', '判断', '评估', '研究', '探讨',
    '有道理', '说得对', '确实', '也是', '可能', '或许',
    '🤔', '💭', '🧠', '📝',
    // English
    'thinking', 'let me think', 'consider', 'ponder', 'reflect',
    'hmm', 'well', 'actually', 'perhaps', 'maybe',
  ],
  
  curious: [
    // 中文
    '好奇', '想知道', '想了解', '有兴趣', '感兴趣',
    '这是什么', '那是什么', '怎么做', '为什么会', '怎么回事',
    '求解', '求问', '请问', '想问', '疑问', '好想知道',
    '探索', '发现', '揭秘', '解密', '一探究竟',
    '👀', '🔍', '🧐', '❓',
    // English
    'curious', 'wonder', 'interested', 'what is', 'how does',
    'tell me more', 'fascinating', 'intriguing',
  ],
  
  determined: [
    // 中文
    '决定', '坚定', '决心', '下定决心', '一定要', '必须',
    '绝对', '务必', '坚持', '不放弃', '不认输', '绝不',
    '我要', '我会', '我能', '加油', '努力', '奋斗',
    '拼了', '豁出去', '全力以赴', '义无反顾', '坚定不移',
    '💪', '✊', '🎯', '🔥',
    // English
    'determined', 'decided', 'resolved', 'committed', 'must',
    'will do', 'going to', 'no matter what', 'persist',
  ],
  
  playful: [
    // 中文
    '嘿嘿', '嘻嘻', '调皮', '俏皮', '淘气', '捣蛋',
    '逗你玩', '开玩笑', '闹着玩', '搞怪', '作妖', '皮',
    '哼', '略略略', '吐舌头', '眨眼', '使眼色', '坏笑',
    '小调皮', '小坏蛋', '小机灵', '鬼灵精',
    '😜', '😝', '😛', '🤪', '😏', '😈',
    // English
    'playful', 'teasing', 'joking', 'kidding', 'mischievous',
    'naughty', 'cheeky', 'silly', 'goofy',
  ],
  
  neutral: [
    // 这些词保持中性表情
    '好的', '嗯', '是的', '明白', '了解', '知道了',
    '行', '可以', '没问题', '好', 'ok', 'okay',
    '收到', '已阅', '已读', '明白了', '懂了',
    'yes', 'sure', 'understood', 'i see', 'alright', 'got it',
  ],
};

// 情绪强度权重
const EMOTION_WEIGHTS: Record<Expression, number> = {
  // 基础情绪
  happy: 1.0,
  sad: 1.2,
  surprised: 1.5,      // 惊讶容易触发
  angry: 1.3,
  fear: 1.2,
  disgusted: 1.1,
  // 积极情绪
  excited: 1.3,
  proud: 1.1,
  loving: 1.4,         // 爱意权重较高
  grateful: 1.1,
  hopeful: 1.0,
  amused: 1.2,
  relieved: 1.0,
  // 消极情绪
  anxious: 1.1,
  embarrassed: 1.3,    // 害羞/尴尬容易触发
  confused: 1.2,
  bored: 0.9,
  disappointed: 1.1,
  lonely: 1.0,
  // 复杂情绪
  thinking: 0.8,       // 思考权重较低，避免误触发
  curious: 1.1,
  determined: 1.2,
  playful: 1.3,        // 俏皮容易触发
  // 中性
  neutral: 0.5,
};

// 情绪分类 - 用于回退映射
const EMOTION_CATEGORIES: Record<string, Expression[]> = {
  positive: ['happy', 'excited', 'proud', 'loving', 'grateful', 'hopeful', 'amused', 'relieved', 'playful'],
  negative: ['sad', 'angry', 'fear', 'disgusted', 'anxious', 'embarrassed', 'disappointed', 'lonely'],
  neutral: ['neutral', 'thinking', 'curious', 'confused', 'bored', 'determined'],
  intense: ['surprised', 'excited', 'angry', 'fear'],
};

export interface EmotionResult {
  emotion: Expression;
  confidence: number;
  keywords: string[];
  intensity: 'low' | 'medium' | 'high';
  category: 'positive' | 'negative' | 'neutral' | 'intense';
}

/**
 * 检测文本中的情绪
 */
export function detectEmotion(text: string): EmotionResult {
  const lowerText = text.toLowerCase();
  const scores: Record<Expression, { score: number; keywords: string[] }> = {} as any;
  
  // 初始化所有情绪分数
  const allEmotions = Object.keys(EMOTION_KEYWORDS) as Expression[];
  for (const emotion of allEmotions) {
    scores[emotion] = { score: 0, keywords: [] };
  }

  // 遍历每种情绪的关键词
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      // 计算关键词出现次数
      let count = 0;
      let pos = 0;
      while ((pos = lowerText.indexOf(lowerKeyword, pos)) !== -1) {
        count++;
        pos += lowerKeyword.length;
      }
      
      if (count > 0) {
        const emotionKey = emotion as Expression;
        scores[emotionKey].score += count * EMOTION_WEIGHTS[emotionKey];
        if (!scores[emotionKey].keywords.includes(keyword)) {
          scores[emotionKey].keywords.push(keyword);
        }
      }
    }
  }

  // 上下文增强：检测感叹号和问号数量
  const exclamationCount = (text.match(/[!！]{2,}/g) || []).length;
  const questionCount = (text.match(/[?？]{2,}/g) || []).length;
  
  if (exclamationCount > 0) {
    // 多个感叹号增强 excited/surprised
    scores.excited.score += exclamationCount * 0.5;
    scores.surprised.score += exclamationCount * 0.3;
  }
  
  if (questionCount > 0) {
    // 多个问号增强 confused/curious
    scores.confused.score += questionCount * 0.5;
    scores.curious.score += questionCount * 0.3;
  }

  // 找出得分最高的情绪
  let maxEmotion: Expression = 'neutral';
  let maxScore = 0;

  for (const [emotion, data] of Object.entries(scores)) {
    if (data.score > maxScore) {
      maxScore = data.score;
      maxEmotion = emotion as Expression;
    }
  }

  // 计算置信度 (0-1)
  const totalScore = Object.values(scores).reduce((sum, d) => sum + d.score, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0;

  // 计算强度
  let intensity: 'low' | 'medium' | 'high' = 'medium';
  if (maxScore < 1) intensity = 'low';
  else if (maxScore > 3) intensity = 'high';

  // 确定分类
  let category: EmotionResult['category'] = 'neutral';
  for (const [cat, emotions] of Object.entries(EMOTION_CATEGORIES)) {
    if (emotions.includes(maxEmotion)) {
      category = cat as EmotionResult['category'];
      break;
    }
  }

  // 如果没有明显情绪，返回 neutral
  if (maxScore < 0.5) {
    return {
      emotion: 'neutral',
      confidence: 1,
      keywords: [],
      intensity: 'low',
      category: 'neutral',
    };
  }

  return {
    emotion: maxEmotion,
    confidence: Math.min(1, confidence),
    keywords: scores[maxEmotion].keywords,
    intensity,
    category,
  };
}

/**
 * 检测多种情绪（返回前N个最可能的情绪）
 */
export function detectMultipleEmotions(text: string, topN = 3): EmotionResult[] {
  const lowerText = text.toLowerCase();
  const scores: { emotion: Expression; score: number; keywords: string[] }[] = [];

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let score = 0;
    const foundKeywords: string[] = [];
    
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      let count = 0;
      let pos = 0;
      while ((pos = lowerText.indexOf(lowerKeyword, pos)) !== -1) {
        count++;
        pos += lowerKeyword.length;
      }
      
      if (count > 0) {
        score += count * EMOTION_WEIGHTS[emotion as Expression];
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
      }
    }
    
    if (score > 0) {
      scores.push({ emotion: emotion as Expression, score, keywords: foundKeywords });
    }
  }

  // 按分数排序
  scores.sort((a, b) => b.score - a.score);

  // 转换为结果
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  
  return scores.slice(0, topN).map(s => {
    let intensity: 'low' | 'medium' | 'high' = 'medium';
    if (s.score < 1) intensity = 'low';
    else if (s.score > 3) intensity = 'high';

    let category: EmotionResult['category'] = 'neutral';
    for (const [cat, emotions] of Object.entries(EMOTION_CATEGORIES)) {
      if (emotions.includes(s.emotion)) {
        category = cat as EmotionResult['category'];
        break;
      }
    }

    return {
      emotion: s.emotion,
      confidence: totalScore > 0 ? s.score / totalScore : 0,
      keywords: s.keywords,
      intensity,
      category,
    };
  });
}

/**
 * 分析一段流式文本，返回情绪变化序列
 * 用于长文本的分段情绪检测
 */
export function analyzeEmotionStream(text: string, chunkSize = 50): EmotionResult[] {
  const results: EmotionResult[] = [];
  
  // 按句子或固定长度分割
  const sentences = text.split(/[。！？\n.!?]/g).filter(s => s.trim());
  
  for (const sentence of sentences) {
    if (sentence.length > 0) {
      results.push(detectEmotion(sentence));
    }
  }
  
  // 如果句子太少，按字符分割
  if (results.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      results.push(detectEmotion(chunk));
    }
  }
  
  return results;
}

/**
 * 根据情绪结果获取建议的表情持续时间 (ms)
 */
export function getEmotionDuration(result: EmotionResult): number {
  const baseDuration = 3000;
  
  // 根据情绪类型调整
  const multiplier: Partial<Record<Expression, number>> = {
    happy: 1.2,
    sad: 1.5,
    surprised: 0.8,     // 惊讶持续较短
    angry: 1.3,
    fear: 1.0,
    disgusted: 1.0,
    excited: 0.9,       // 兴奋持续较短
    proud: 1.2,
    loving: 1.5,
    grateful: 1.2,
    hopeful: 1.3,
    amused: 1.0,
    relieved: 1.2,
    anxious: 1.0,
    embarrassed: 1.1,
    confused: 1.0,
    bored: 1.5,
    disappointed: 1.4,
    lonely: 1.5,
    thinking: 1.3,
    curious: 1.1,
    determined: 1.2,
    playful: 0.9,
    neutral: 1.0,
  };
  
  const emotionMultiplier = multiplier[result.emotion] ?? 1.0;
  
  // 根据强度调整
  const intensityMultiplier = {
    low: 0.7,
    medium: 1.0,
    high: 1.3,
  };
  
  return baseDuration * emotionMultiplier * intensityMultiplier[result.intensity] * result.confidence;
}

/**
 * 获取情绪的衰减目标（某些情绪衰减到特定状态而非neutral）
 */
export function getDecayTarget(emotion: Expression): Expression {
  const decayMap: Partial<Record<Expression, Expression>> = {
    excited: 'happy',       // 兴奋衰减到开心
    angry: 'disappointed',  // 生气衰减到失望
    fear: 'anxious',        // 恐惧衰减到焦虑
    surprised: 'curious',   // 惊讶衰减到好奇
    loving: 'happy',        // 爱意衰减到开心
    embarrassed: 'neutral', // 害羞衰减到中性
  };
  
  return decayMap[emotion] ?? 'neutral';
}

/**
 * 判断两个情绪是否兼容（可以混合）
 */
export function areEmotionsCompatible(e1: Expression, e2: Expression): boolean {
  // 同类情绪可以混合
  for (const emotions of Object.values(EMOTION_CATEGORIES)) {
    if (emotions.includes(e1) && emotions.includes(e2)) {
      return true;
    }
  }
  
  // 特殊兼容组合
  const compatiblePairs: [Expression, Expression][] = [
    ['happy', 'surprised'],
    ['happy', 'embarrassed'],
    ['curious', 'confused'],
    ['thinking', 'curious'],
    ['playful', 'happy'],
    ['loving', 'embarrassed'],
  ];
  
  return compatiblePairs.some(([a, b]) => 
    (a === e1 && b === e2) || (a === e2 && b === e1)
  );
}

/**
 * 获取所有支持的情绪列表
 */
export function getSupportedEmotions(): Expression[] {
  return Object.keys(EMOTION_KEYWORDS) as Expression[];
}

/**
 * 获取情绪的关键词数量统计
 */
export function getEmotionStats(): Record<Expression, number> {
  const stats: Record<Expression, number> = {} as any;
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    stats[emotion as Expression] = keywords.length;
  }
  return stats;
}
