let questions = [];
let selectedQuestions = [];
let currentQuestion = 0;
let score = 0;
let gameState = 'loading'; // loading, quiz, result, error
let table;
let buttons = [];
let feedback = '';
let answerLocked = false; // 點選答案後鎖定直到切換題目
let lastSelected = -1;
let stars = [];
let startButton = null;
let particles = [];
let resultAnimTime = 0;
let congratsParticles = [];
// Emoji 分類：滿分、九十分、八十分、不及格
let perfectEmoji = ['👑', '🏆', '🎖️', '🌟'];
let ninetyEmoji = ['🎉', '🎊', '🏅', '👏'];
let eightyEmoji = ['✨', '🌟', '👍', '🎯'];
let failEmoji = ['💪', '📚', '🔁', '🙂'];
// 備援
let encourageEmoji = ['💪', '✨', '🌟', '⭐', '🎯', '📚', '💡'];
let celebrateEmoji = ['🎉', '🎊', '🏆', '👏', '💫', '🌈', '🎯'];

// 每十分為一級距（0%,10%,...,100%）的單一 emoji 映射
let bucketEmoji = [
  '😞', // 0%
  '😕', // 10%
  '🙂', // 20%
  '🙂', // 30%
  '🙂', // 40%
  '😊', // 50%
  '🙂', // 60%
  '👍', // 70%
  '🎯', // 80%
  '🏅', // 90%
  '🏆'  // 100%
];

// 響應式文字與畫布設定與 UI 位置
let textScale = 1;
function updateTextScale() {
  // 參考設計尺寸 800x600，根據較小比率縮放
  textScale = min(width / 800, height / 600);
  textScale = max(0.6, textScale); // 最低縮放避免太小
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新配置 UI 與文字大小
  updateTextScale();
  // 更新按鈕位置
  layoutUI();
  // 重新排列星星數量以適應新尺寸
  initStars(Math.max(40, Math.floor(width / 10)));
}

function rTextSize(base) {
  // base 為設計稿字級 (px)，乘上 textScale
  textSize(max(12, Math.round(base * textScale)) );
}

function layoutUI() {
  // 調整開始按鈕大小與位置
  if (!startButton) startButton = {};
  startButton.w = min(360, Math.round(width * 0.28));
  startButton.h = min(96, Math.round(height * 0.12));
  startButton.x = Math.round(width / 2 - startButton.w / 2);
  startButton.y = Math.round(height * 0.45 - startButton.h / 2);

  // 調整選項按鈕尺寸與位置
  for (let i = 0; i < buttons.length; i++) {
    let h = Math.max(36, Math.round(height * 0.06));
    let w = Math.min(600, Math.round(width * 0.5));
    buttons[i].w = w;
    buttons[i].h = h;
    buttons[i].x = Math.round(width / 2 - w / 2);
    buttons[i].y = Math.round(height * 0.5 + i * (h + 12));
  }
}

function preload() {
  // 嘗試在 preload 中載入 CSV（preload 會等待完成），但若網頁是透過 file:// 開啟，loadTable 可能會失敗。
  table = loadTable('questions.csv', 'csv', 'header');
}

function setup() {
  // 使用全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  updateTextScale();

  // 檢查 table 是否成功載入
  if (!table || typeof table.getRowCount !== 'function' || table.getRowCount() === 0) {
    // 顯示錯誤狀態，並提醒使用者啟動本機伺服器或檢查路徑/檔名
    console.error('questions.csv 無法載入或為空。請確認檔案位於專案根目錄，並用本機伺服器開啟網頁（例如：python3 -m http.server）。');
    gameState = 'error';
    return;
  }

  // 載入所有題目
  for (let r = 0; r < table.getRowCount(); r++) {
    let question = {
      question: table.getString(r, 0),
      options: [
        table.getString(r, 1),
        table.getString(r, 2),
        table.getString(r, 3),
        table.getString(r, 4)
      ],
      correct: table.getString(r, 5)
    };
    questions.push(question);
  }

  // 隨機選擇10個題目（從題庫中抽取）
  // 創建按鈕（選項按鈕先建立，但題目抽取會在開始時進行）
  for (let i = 0; i < 4; i++) {
    buttons[i] = {
      x: 0, // 初始值會在 layoutUI 中設定
      y: 0,
      w: 0,
      h: 0,
      label: String.fromCharCode(65 + i), // A, B, C, D
      selected: false
    };
  }
  
  // 初始化按鈕位置
  layoutUI();

  // 初始化星星與開始按鈕（會根據畫布大小調整）
  initStars(Math.max(40, Math.floor(width / 10)));
  startButton = { x: 0, y: 0, w: 0, h: 0 };
  layoutUI();
  updateTextScale();

  // 顯示介紹頁面，等待使用者開始
  gameState = 'intro';
}

function draw() {
  // 使用粉紅漸層背景取代單色背景
  drawPinkGradientBackground();
  // 繪製飄動的星星
  drawStars();

  if (gameState === 'loading') {
    rTextSize(20);
    fill(0);
    text('載入中...', width / 2, height / 2);
  } else if (gameState === 'error') {
    drawError();
  } else if (gameState === 'quiz') {
    drawQuiz();
  } else if (gameState === 'result') {
    drawResult();
  } else if (gameState === 'intro') {
    drawIntro();
  }
}

// 繪製垂直粉紅漸層背景（從上到下）
function drawPinkGradientBackground() {
  // 漸層起始與結束顏色，可依喜好調整
  let c1 = color(255, 235, 240); // 淺粉
  let c2 = color(255, 160, 190); // 深粉
  noFill();
  for (let y = 0; y <= height; y++) {
    let amt = map(y, 0, height, 0, 1);
    let c = lerpColor(c1, c2, amt);
    stroke(c);
    line(0, y, width, y);
  }
}

function drawError() {
  rTextSize(22);
  fill(50);
  text('無法載入題庫（questions.csv）。', width / 2, 140);
  rTextSize(16);
  text('可能原因：直接以檔案開啟（file://）導致載入失敗，或檔名/路徑錯誤。', width / 2, 180, width - 60, 80);
  text('請在專案資料夾執行：python3 -m http.server，然後開啟 http://localhost:8000', width / 2, 220, width - 60, 80);
}

// ----- Intro 畫面 -----
function drawIntro() {
  // 標題
  fill(50);
  rTextSize(36);
  text('p5.js 是什麼？', width/2, Math.round(height * 0.18));

  

  // 開始按鈕
  fill(255);
  stroke(0);
  rect(startButton.x, startButton.y, startButton.w, startButton.h, 8);
  noStroke();
  fill(50);
  rTextSize(20);
  text('開始測驗', startButton.x + startButton.w/2, startButton.y + startButton.h/2);
}

function drawQuiz() {
  // 顯示進度
  rTextSize(20);
  fill(100);
  text(`問題 ${currentQuestion + 1}/10`, width / 2, Math.round(height * 0.08));

  // 顯示題目（如果 selectedQuestions 長度不足，顯示錯誤）
  if (!selectedQuestions || !selectedQuestions[currentQuestion]) {
    fill(0);
    rTextSize(18);
    text('題目載入異常。', width / 2, height / 2);
    return;
  }

  // 顯示題目
  rTextSize(24);
  fill(0);
  push();
  textAlign(CENTER, TOP);
  textWrap(WORD);
  // 用從左到右的文字框 (x=50, w=width-100)，並在框內置中顯示
  text(selectedQuestions[currentQuestion].question, 50, 150, width - 100, 100);
  pop();

  // 顯示選項（支援正誤顯示）
  for (let i = 0; i < 4; i++) {
    let btn = buttons[i];
    // 根據 btn.result 顯示顏色: 'correct' 綠, 'wrong' 紅, 選取顏色藍
    if (btn.result === 'correct') {
      fill(120, 200, 120);
    } else if (btn.result === 'wrong') {
      fill(255, 130, 130);
    } else if (btn.selected) {
      fill(200, 220, 255);
    } else {
      fill(255);
    }
    stroke(0);
    rect(btn.x, btn.y, btn.w, btn.h, 5);

    // 文字顏色在深色背景時改為白色
    if (btn.result === 'correct' || btn.result === 'wrong') {
      fill(255);
    } else {
      fill(0);
    }
    noStroke();
    rTextSize(16);
    text(btn.label + '. ' + selectedQuestions[currentQuestion].options[i],
      btn.x + btn.w / 2, btn.y + btn.h / 2);
  }
}

function drawResult() {
  background(0);
  resultAnimTime += 0.016; // 約每幀 16ms

  // 繪製星星背景
  drawStars();

  // 根據分數決定特效
  if (score === 10) {
    // 完美表現：金色煙火效果
    if (frameCount % 30 === 0) {
      createFirework(random(width), height);
    }
  } else if (score >= 8) {
    // 優秀表現：星星散射
    if (frameCount % 20 === 0) {
      createStarBurst(random(width), random(height));
    }
  }

  // 更新所有粒子
  updateParticles();

  // 標題動畫（彈跳效果）
  let titleY = Math.round(height * 0.18) + sin(resultAnimTime * 3) * 5;
  rTextSize(32);
  fill(255);
  textAlign(CENTER, CENTER);
  text('測驗完成！', width / 2, titleY);

  // 分數顯示（放大縮小動畫）
  let scoreScale = 1 + sin(resultAnimTime * 2) * 0.1;
  push();
  translate(width / 2, 200);
  scale(scoreScale);
  rTextSize(24);
  fill(255);
  text(`得分：${score}/10`, 0, 0);
  pop();

  // 根據分數顯示不同的回饋效果
  rTextSize(20);
  let feedbackText = '';
  let emojis = [];
  let textColor = color(255);
  let textY = 250;

  // 精細分級：滿分(10)、九十分(9)、八十分(8)、不及格(其他)
  if (score === 10) {
    feedbackText = '太棒了！完美的表現（100%）！';
    emojis = perfectEmoji;
    textColor = color(255, 215, 0); // 金色
    // 生成煙火
    if (frameCount % 12 === 0) {
      createFirework(random(width), random(height/2));
    }
    // 頻繁產生歡慶星形
    if (frameCount % 15 === 0) {
      createCelebrationParticles();
    }
  } else if (score === 9) {
    feedbackText = '非常好！接近完美（90%）！';
    emojis = ninetyEmoji;
    textColor = color(50, 205, 50); // 綠色
    if (frameCount % 20 === 0) {
      createStarBurst(random(width), random(height/2));
    }
  } else if (score === 8) {
    feedbackText = '不錯！達到 80%！';
    emojis = eightyEmoji;
    textColor = color(30, 144, 255); // 藍色
    if (frameCount % 30 === 0) {
      createCelebrationParticles();
    }
  } else {
    feedbackText = '加油！再接再厲（未達 80%）！';
    emojis = failEmoji;
    textColor = color(255, 99, 71); // 蕃茄紅色
    if (frameCount % 60 === 0) {
      createStarBurst(random(width), random(height/2));
    }
  }

  // 動態文字效果（閃爍和飄浮）
  let spacing = sin(resultAnimTime * 3) * 2;
  let floatingY = textY + cos(resultAnimTime * 2) * 3;
  
  // 主要回饋文字（閃爍效果）
  let textAlpha = 200 + sin(resultAnimTime * 4) * 55;
  fill(red(textColor), green(textColor), blue(textColor), textAlpha);
  rTextSize(20);
  text(feedbackText, width/2, floatingY);

  // 顯示每十分一個級距的固定 emoji（不頻繁跳動）
  // 計算百分比並取級距索引 0..10
  let pct = 0;
  if (selectedQuestions && selectedQuestions.length > 0) {
    pct = Math.round((score / selectedQuestions.length) * 100);
  } else {
    pct = Math.round((score / 10) * 100);
  }
  let bucket = Math.min(10, Math.max(0, Math.floor(pct / 10)));
  let bucketEmojiChar = bucketEmoji[bucket] || '🙂';

  // 顯示一個穩定的 emoji 在分數附近，帶小幅上下浮動
  push();
  rTextSize(56);
  // 嘗試指定系統 emoji 字型（macOS），若不可用則忽略
  try { textFont('Apple Color Emoji'); } catch (e) {}
  let emojiX = width/2 + 140;
  let emojiY = floatingY + sin(resultAnimTime * 2) * 8;
  fill(255);
  text(bucketEmojiChar, emojiX, emojiY);
  pop();

  // 重新開始按鈕（呼吸效果）
  let buttonPulse = 1 + sin(resultAnimTime * 2) * 0.05;
  push();
  translate(width/2, height - 100);
  scale(buttonPulse);
  
  // 按鈕懸停效果
  if (mouseX > width/2 - 75 && mouseX < width/2 + 75 &&
      mouseY > height - 125 && mouseY < height - 75) {
    fill(100, 200, 100, 200);
  } else {
    fill(50, 100, 50, 200);
  }
  
  // 繪製按鈕
  rect(-75, -25, 150, 50, 20);
  fill(255);
  rTextSize(20);
  text('重新開始', 0, 5);
  pop();
}


function mousePressed() {
  if (gameState === 'intro') {
    // 檢查是否點擊開始按鈕
    if (mouseX > startButton.x && mouseX < startButton.x + startButton.w &&
        mouseY > startButton.y && mouseY < startButton.y + startButton.h) {
      // 抽題並開始測驗（從題庫中抽10題）
      selectedQuestions = pickRandomElements(questions, 10);
      currentQuestion = 0;
      score = 0;
      gameState = 'quiz';
    }
    return;
  }

  if (gameState === 'quiz') {
    // 檢查是否點擊任何選項
    if (answerLocked) return; // 已選過答案，鎖定中
    for (let i = 0; i < buttons.length; i++) {
      let btn = buttons[i];
      if (mouseX > btn.x && mouseX < btn.x + btn.w &&
        mouseY > btn.y && mouseY < btn.y + btn.h) {

        // 鎖定回答，避免重複點擊
        answerLocked = true;
        lastSelected = i;

        // 重置視覺狀態但保留結果欄位
        buttons.forEach(b => { b.selected = false; b.result = b.result || null; });

        // 標記為被選取
        btn.selected = true;

        // 判斷正確性（正確答案為字母 A/B/C/D）
        let correctChar = selectedQuestions[currentQuestion].correct;
        let correctIndex = correctChar.charCodeAt(0) - 65;

        if (i === correctIndex) {
          // 正確
          btn.result = 'correct';
          score++;
        } else {
          // 錯誤：將被選到的標為 wrong，並標示正確答案為 correct
          btn.result = 'wrong';
          if (buttons[correctIndex]) buttons[correctIndex].result = 'correct';
        }

        // 小延遲後進入下一題
        setTimeout(() => {
          // 清除每個按鈕的結果與選取狀態
          buttons.forEach(b => { b.selected = false; b.result = null; });
          lastSelected = -1;
          answerLocked = false;
          currentQuestion++;
          if (currentQuestion >= 10) {
              // 進入結果頁時重置結果動畫狀態與粒子
              resultAnimTime = 0;
              particles = [];
              congratsParticles = [];
              gameState = 'result';
          }
        }, 1000);
        break;
      }
    }
  } else if (gameState === 'result') {
    // 檢查是否點擊重新開始按鈕 (按鈕是以中心 (width/2, height-100)，大小 150x50)
    let btnCenterX = width / 2;
    let btnCenterY = height - 100;
    let btnW = 150;
    let btnH = 50;
    if (mouseX > btnCenterX - btnW/2 && mouseX < btnCenterX + btnW/2 &&
        mouseY > btnCenterY - btnH/2 && mouseY < btnCenterY + btnH/2) {
      // 重置遊戲（重新抽10題）並重置動畫狀態
      currentQuestion = 0;
      score = 0;
      selectedQuestions = pickRandomElements(questions, 10);
      resultAnimTime = 0;
      particles = [];
      congratsParticles = [];
      gameState = 'quiz';
    }
  }
}

// 從陣列中隨機選擇 n 個元素（不覆寫 p5 的 random）
function pickRandomElements(arr, n) {
  let result = [];
  let temp = [...arr];
  n = Math.min(n, temp.length);
  for (let i = 0; i < n; i++) {
    let index = Math.floor(Math.random() * temp.length);
    result.push(temp[index]);
    temp.splice(index, 1);
  }
  return result;
}

// 創建煙火效果
function createFirework(x, y) {
  let particleCount = 50;
  let colors = [
    color(255, 215, 0),  // 金
    color(255, 255, 0),  // 黃
    color(255, 140, 0)   // 橙
  ];
  
  for (let i = 0; i < particleCount; i++) {
    let angle = random(TWO_PI);
    let speed = random(2, 8);
    let size = random(2, 4);
    let life = 255;
    let c = random(colors);
    
    particles.push({
      x: x,
      y: y,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed - 1,
      size: size,
      color: c,
      life: life
    });
  }
}

// 創建星星散射效果
function createStarBurst(x, y) {
  let particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    let angle = random(TWO_PI);
    let speed = random(1, 4);
    particles.push({
      x: x,
      y: y,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
      size: random(3, 6),
      color: color(255, 255, random(200, 255)),
      life: 255
    });
  }
}

// 創建歡慶粒子
function createCelebrationParticles() {
  let x = random(width);
  let y = random(height);
  let particleCount = 15;
  
  for (let i = 0; i < particleCount; i++) {
    let angle = random(TWO_PI);
    let speed = random(0.5, 2);
    congratsParticles.push({
      x: x,
      y: y,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed - 1,
      size: random(2, 4),
      color: color(random(200, 255), random(200, 255), 0),
      life: 255
    });
  }
}

// 更新所有粒子
function updateParticles() {
  // 更新普通粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;  // 重力
    p.life -= 5;
    
    // 繪製粒子
    if (p.life > 0) {
      fill(red(p.color), green(p.color), blue(p.color), p.life);
      noStroke();
      ellipse(p.x, p.y, p.size);
    } else {
      particles.splice(i, 1);
    }
  }
  
  // 更新歡慶粒子
  for (let i = congratsParticles.length - 1; i >= 0; i--) {
    let p = congratsParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life -= 3;
    
    if (p.life > 0) {
      fill(red(p.color), green(p.color), blue(p.color), p.life);
      noStroke();
      drawStarShape(p.x, p.y, p.size, 5);
    } else {
      congratsParticles.splice(i, 1);
    }
  }
}

// ----- 星星系統 -----
function initStars(count) {
  stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: random(0, width),
      y: random(0, height),
      r: random(3, 8),          // 星形外半徑
      speed: random(0.2, 0.8),  // 垂直飄動速度
      phase: random(TWO_PI),
      rotation: random(0, TWO_PI),
      twinkleSpeed: random(0.02, 0.08)
    });
  }
}

function drawStarShape(x, y, outerR, points) {
  // 繪製多角星（例如五角星）
  let angle = TWO_PI / (points * 2);
  beginShape();
  for (let a = 0; a < TWO_PI; a += angle) {
    let r = (floor(a / angle) % 2 === 0) ? outerR : outerR * 0.5;
    let sx = x + cos(a - HALF_PI) * r;
    let sy = y + sin(a - HALF_PI) * r;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}

function drawStars() {
  noStroke();
  for (let s of stars) {
    // 垂直漂浮
    s.y += s.speed;
    // 水平擺動
    s.x += sin(frameCount * 0.02 + s.phase) * 0.4;
    // 超出畫面則從頂部重來
    if (s.y > height + 10) s.y = -10 - random(0, 60);

    // 閃爍 alpha
    let tw = (sin(frameCount * s.twinkleSpeed + s.phase) + 1) / 2; // 0..1
    let alpha = map(tw, 0, 1, 120, 255);

    push();
    translate(s.x, s.y);
    rotate((frameCount * 0.001 * (s.rotation + 0.1)) % TWO_PI);
    fill(255, 255, 255, alpha);
    // 畫星形
    drawStarShape(0, 0, s.r, 5);
    pop();
  }
}

