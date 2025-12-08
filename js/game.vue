<template>
    <div class="app">
      <h1>卡牌管理游戏</h1>
      
      <div class="controls">
        <button @click="dealCards" class="btn deal-btn" :disabled="isDealing || !hasUnlockedBox">
          {{ isDealing ? '发牌中...' : '发牌' }}
        </button>
        <button @click="mergeCards" class="btn merge-btn" :disabled="isMerging || !hasBoxToMerge">
          {{ isMerging ? '合成中...' : '合成' }}
        </button>
        <div class="instructions">
          <h3>游戏说明：</h3>
          <ul>
            <li>每个盒子最多放10张牌</li>
            <li>前3个盒子默认解锁，后6个加锁</li>
            <li>牌值范围：1-当前解锁盒子数</li>
            <li>每次发牌，每个盒子最多发4张牌</li>
            <li>移牌：点击源盒子，再点击目标盒子（牌值需相同）</li>
            <li>合成：盒子满10张牌且牌值相同，点击合成按钮</li>
            <li>合成后，牌值最大的盒子优先解锁新盒子</li>
          </ul>
        </div>
      </div>
  
      <!-- 合成特效容器 -->
      <div class="effect-container">
        <div 
          v-for="effect in mergeEffects" 
          :key="effect.id"
          class="merge-effect"
          :style="{
            left: effect.x + 'px',
            top: effect.y + 'px',
            '--effect-color': effect.color
          }"
        ></div>
      </div>
  
      <div class="boxes-container">
        <div
          v-for="(box, index) in boxes"
          :key="box.id"
          :class="['box', { 
            locked: box.locked, 
            selected: selectedBox === box.id, 
            merging: isBoxMerging(box.id),
            'can-merge': box.cards.length === 10 && isCardsAllSame(box.cards)
          }]"
          @click="handleBoxClick(box.id)"
        >
          <div class="box-header">
            <span class="box-number">盒子 {{ index + 1 }}</span>
            <button 
              :class="['lock-btn', { locked: box.locked }]"
              @click.stop="toggleLock(box.id)"
            >
              {{ box.locked ? '🔒' : '🔓' }}
            </button>
          </div>
          
          <div class="box-content">
            <div class="cards-count">
              牌数: {{ box.cards.length }}/10
              <span v-if="box.cards.length > 0" class="box-max-value">
                (最大牌值: {{ getMaxCardValue(box.cards) }})
              </span>
            </div>
            
            <div class="cards-visual-container">
              <transition-group 
                name="card" 
                tag="div" 
                class="cards-visual"
              >
                <div
                  v-for="(card, cardIndex) in getVisibleCards(box.cards)"
                  :key="`${box.id}-${cardIndex}`"
                  class="card"
                  :style="{ 
                    backgroundColor: `hsl(${card.value * 40}, 70%, 70%)`,
                    'z-index': cardIndex 
                  }"
                >
                  {{ card.value }}
                </div>
              </transition-group>
            </div>
            
            <div v-if="box.cards.length > 5" class="more-cards">
              +{{ box.cards.length - 5 }}张
            </div>
            
            <div v-if="box.cards.length === 0" class="empty-box">
              空
            </div>
            
            <!-- 牌值统计 -->
            <div v-if="box.cards.length > 0" class="card-value-distribution">
              <div 
                v-for="value in getCardValueDistribution(box.cards)" 
                :key="value.value"
                class="value-item"
                :style="{ backgroundColor: `hsl(${value.value * 40}, 70%, 70%)` }"
                :title="`牌值${value.value}: ${value.count}张`"
              >
                {{ value.count }}
              </div>
            </div>
            
            <!-- 合成提示 -->
            <transition name="merge-hint">
              <div v-if="box.cards.length === 10 && isCardsAllSame(box.cards)" class="merge-hint">
                ⚡ 可合成
              </div>
            </transition>
          </div>
          
          <!-- 升级动画 -->
          <transition name="level-up">
            <div v-if="isBoxLevelingUp(box.id)" class="level-up-animation">
              <span class="level-up-text">↑ {{ getMaxCardValue(box.cards) }}</span>
              <div class="level-up-sparkles">
                <div v-for="i in 8" :key="i" class="sparkle"></div>
              </div>
            </div>
          </transition>
        </div>
      </div>
  
      <!-- 解锁动画 -->
      <transition name="unlock">
        <div v-if="unlockedBox !== null" class="unlock-animation">
          <div class="unlock-message">
            <div class="unlock-icon">🔓</div>
            <div class="unlock-text">盒子 {{ unlockedBox + 1 }} 已解锁！</div>
          </div>
        </div>
      </transition>
  
      <!-- 状态显示 -->
      <div class="status-panel">
        <div class="status-item">
          <span class="status-label">解锁盒子数:</span>
          <span class="status-value">{{ unlockedBoxesCount }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">可合成盒子:</span>
          <span class="status-value">{{ mergeableBoxesCount }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">最大牌值:</span>
          <span class="status-value">{{ globalMaxCardValue }}</span>
        </div>
      </div>
  
      <div class="game-log">
        <h3>游戏日志：</h3>
        <div class="log-content">
          <transition-group name="log" tag="div">
            <div
              v-for="(log, index) in gameLog"
              :key="log.id"
              class="log-entry"
              :class="{
                'log-success': log.type === 'success',
                'log-error': log.type === 'error',
                'log-warning': log.type === 'warning'
              }"
            >
              {{ log.message }}
            </div>
          </transition-group>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, reactive, computed, onMounted, nextTick } from 'vue'
  
  interface Card {
    value: number
  }
  
  interface CardBox {
    id: number
    locked: boolean
    cards: Card[]
  }
  
  interface GameLog {
    id: number
    message: string
    type: 'info' | 'success' | 'error' | 'warning'
  }
  
  interface MergeEffect {
    id: number
    x: number
    y: number
    color: string
  }
  
  interface ValueDistribution {
    value: number
    count: number
  }
  
  // 响应式数据
  const boxes = ref<CardBox[]>([])
  const selectedBox = ref<number | null>(null)
  const gameLog = ref<GameLog[]>([])
  const mergeEffects = ref<MergeEffect[]>([])
  const isMerging = ref(false)
  const isDealing = ref(false)
  const unlockedBox = ref<number | null>(null)
  const mergingBoxIds = ref<number[]>([])
  const levelingUpBoxIds = ref<number[]>([])
  const logIdCounter = ref(0)
  const effectIdCounter = ref(0)
  
  // 计算属性
  const unlockedBoxesCount = computed(() => {
    return boxes.value.filter(box => !box.locked).length
  })
  
  const hasUnlockedBox = computed(() => {
    return boxes.value.some(box => !box.locked)
  })
  
  const globalMaxCardValue = computed(() => {
    let max = 0
    boxes.value.forEach(box => {
      if (!box.locked && box.cards.length > 0) {
        const boxMax = getMaxCardValue(box.cards)
        if (boxMax > max) max = boxMax
      }
    })
    return max
  })
  
  const mergeableBoxesCount = computed(() => {
    return boxes.value.filter(box => 
      !box.locked && 
      box.cards.length === 10 && 
      isCardsAllSame(box.cards)
    ).length
  })
  
  const hasBoxToMerge = computed(() => {
    return mergeableBoxesCount.value > 0
  })
  
  // 辅助函数
  const isBoxMerging = (boxId: number) => {
    return mergingBoxIds.value.includes(boxId)
  }
  
  const isBoxLevelingUp = (boxId: number) => {
    return levelingUpBoxIds.value.includes(boxId)
  }
  
  const getVisibleCards = (cards: Card[]) => {
    return cards.slice(0, Math.min(cards.length, 5))
  }
  
  const getMaxCardValue = (cards: Card[]): number => {
    if (cards.length === 0) return 0
    return Math.max(...cards.map(card => card.value))
  }
  
  const isCardsAllSame = (cards: Card[]): boolean => {
    if (cards.length === 0) return false
    const firstValue = cards[0].value
    return cards.every(card => card.value === firstValue)
  }
  
  const getCardValueDistribution = (cards: Card[]): ValueDistribution[] => {
    const distribution: { [key: number]: number } = {}
    cards.forEach(card => {
      distribution[card.value] = (distribution[card.value] || 0) + 1
    })
    return Object.entries(distribution)
      .map(([value, count]) => ({ value: parseInt(value), count }))
      .sort((a, b) => b.value - a.value)
  }
  
  // 初始化盒子
  const initializeBoxes = () => {
    boxes.value = Array.from({ length: 9 }, (_, index) => ({
      id: index,
      locked: index >= 3,
      cards: []
    }))
  }
  
  // 添加日志
  const addLog = (message: string, type: GameLog['type'] = 'info') => {
    gameLog.value.unshift({
      id: logIdCounter.value++,
      message,
      type
    })
    if (gameLog.value.length > 10) {
      gameLog.value.pop()
    }
  }
  
  // 发牌函数（每个盒子可以发不同牌值的牌，最多4张）
  const dealCards = async () => {
    if (isDealing.value || !hasUnlockedBox.value) return
    
    isDealing.value = true
    addLog('开始发牌...', 'info')
    
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const unlockedBoxes = boxes.value.filter(box => !box.locked)
    
    if (unlockedBoxes.length === 0) {
      addLog('没有解锁的盒子可以发牌', 'warning')
      isDealing.value = false
      return
    }
    
    // 每次发牌，牌值范围：1-当前解锁盒子数
    const maxCardValue = unlockedBoxesCount.value
    
    boxes.value = boxes.value.map(box => {
      if (box.locked) return box
      
      // 每个盒子最多发4张牌，且不能超过10张限制
      const availableSpace = 10 - box.cards.length
      if (availableSpace === 0) {
        addLog(`盒子${box.id + 1}已满，无法发牌`, 'warning')
        return box
      }
      
      const cardsToAdd = Math.min(
        Math.floor(Math.random() * 4) + 1, // 1-4张
        availableSpace
      )
      
      if (cardsToAdd === 0) return box
      
      // 生成牌值（每个盒子可以有不同的牌值）
      const cardValues: number[] = []
      for (let i = 0; i < cardsToAdd; i++) {
        const cardValue = Math.floor(Math.random() * maxCardValue) + 1
        cardValues.push(cardValue)
      }
      
      const newCards: Card[] = cardValues.map(value => ({ value }))
      
      addLog(
        `向盒子${box.id + 1}发了${cardsToAdd}张牌（牌值: ${Array.from(new Set(cardValues)).join(',')}）`,
        'success'
      )
      
      return {
        ...box,
        cards: [...box.cards, ...newCards]
      }
    })
    
    isDealing.value = false
    addLog('发牌完成！', 'success')
  }
  
  // 处理盒子点击（移牌操作）
  const handleBoxClick = (boxId: number) => {
    if (isMerging.value || boxes.value[boxId].locked) return
  
    if (selectedBox.value === null) {
      // 第一次点击，选择源盒子
      if (boxes.value[boxId].cards.length > 0) {
        selectedBox.value = boxId
        const topCard = boxes.value[boxId].cards[boxes.value[boxId].cards.length - 1]
        addLog(`选择了盒子${boxId + 1}（顶部牌值: ${topCard.value}）`, 'info')
      }
    } else {
      // 第二次点击，选择目标盒子
      if (selectedBox.value === boxId) {
        selectedBox.value = null
        return
      }
  
      const sourceBox = boxes.value[selectedBox.value]
      const targetBox = boxes.value[boxId]
  
      if (targetBox.locked) {
        addLog(`目标盒子已锁定，移动失败`, 'error')
        selectedBox.value = null
        return
      }
  
      // 获取源盒子顶部牌值
      const sourceTopCard = sourceBox.cards[sourceBox.cards.length - 1]
      if (!sourceTopCard) {
        selectedBox.value = null
        return
      }
  
      // 计算可移动的牌数（连续相同牌值的牌）
      let movableCards = 0
      for (let i = sourceBox.cards.length - 1; i >= 0; i--) {
        if (sourceBox.cards[i].value === sourceTopCard.value) {
          movableCards++
        } else {
          break
        }
      }
  
      // 目标盒子剩余空间
      const availableSpace = 10 - targetBox.cards.length
      const cardsToMove = Math.min(movableCards, availableSpace)
  
      if (cardsToMove === 0) {
        addLog(`目标盒子已满，无法移动`, 'error')
        selectedBox.value = null
        return
      }
  
      // 移动牌
      const sourceCards = [...sourceBox.cards]
      const targetCards = [...targetBox.cards]
      
      const movedCards = sourceCards.splice(-cardsToMove)
      targetCards.push(...movedCards)
  
      // 更新盒子状态
      boxes.value = boxes.value.map(b => {
        if (b.id === selectedBox.value) {
          return {
            ...b,
            cards: sourceCards
          }
        }
        if (b.id === boxId) {
          return {
            ...b,
            cards: targetCards
          }
        }
        return b
      })
  
      addLog(
        `从盒子${selectedBox.value! + 1}移动了${cardsToMove}张值为${sourceTopCard.value}的牌到盒子${boxId + 1}`,
        'success'
      )
      selectedBox.value = null
    }
  }
  
  // 创建合成特效
  const createMergeEffect = (boxId: number, cardValue: number) => {
    const boxElements = document.querySelectorAll('.box')
    if (boxElements[boxId]) {
      const rect = boxElements[boxId].getBoundingClientRect()
      const color = `hsl(${cardValue * 40}, 70%, 70%)`
      
      // 创建多个粒子效果
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8
        const distance = 100 + Math.random() * 50
        const effect = {
          id: effectIdCounter.value++,
          x: rect.left + rect.width / 2 + Math.cos(angle) * distance,
          y: rect.top + rect.height / 2 + Math.sin(angle) * distance,
          color
        }
        mergeEffects.value.push(effect)
        
        // 移除特效
        setTimeout(() => {
          mergeEffects.value = mergeEffects.value.filter(e => e.id !== effect.id)
        }, 1000)
      }
    }
  }
  
  // 合成操作
  const mergeCards = async () => {
    if (isMerging.value || !hasBoxToMerge.value) return
    
    isMerging.value = true
    addLog('开始合成...', 'info')
    
    // 找出所有可以合成的盒子（10张牌且牌值相同）
    const boxesToMerge = boxes.value.filter(box => 
      !box.locked && 
      box.cards.length === 10 && 
      isCardsAllSame(box.cards)
    )
    
    if (boxesToMerge.length === 0) {
      addLog('没有可以合成的盒子', 'warning')
      isMerging.value = false
      return
    }
    
    // 找出牌值最大的盒子（可能有多个）
    let maxCardValue = 0
    boxesToMerge.forEach(box => {
      const boxMax = getMaxCardValue(box.cards)
      if (boxMax > maxCardValue) {
        maxCardValue = boxMax
      }
    })
    
    const boxesWithMaxValue = boxesToMerge.filter(box => 
      getMaxCardValue(box.cards) === maxCardValue
    )
    
    // 标记正在合成的盒子
    mergingBoxIds.value = boxesWithMaxValue.map(box => box.id)
    
    // 创建合成特效
    boxesWithMaxValue.forEach(box => {
      createMergeEffect(box.id, maxCardValue)
    })
    
    // 等待特效动画
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // 执行合成（只合成牌值最大的盒子）
    boxes.value = boxes.value.map(box => {
      if (boxesWithMaxValue.some(b => b.id === box.id)) {
        // 合成：牌值+1，牌数变为1
        const newCardValue = maxCardValue + 1
        
        // 标记升级动画
        levelingUpBoxIds.value.push(box.id)
        
        // 移除升级标记
        setTimeout(() => {
          levelingUpBoxIds.value = levelingUpBoxIds.value.filter(id => id !== box.id)
        }, 1500)
        
        addLog(`盒子${box.id + 1}合成成功！新牌值: ${newCardValue}`, 'success')
        
        return {
          ...box,
          cards: [{ value: newCardValue }]
        }
      }
      return box
    })
    
    // 清除合成标记
    mergingBoxIds.value = []
    
    // 解锁下一个盒子（按顺序解锁）
    const lockedBoxes = boxes.value.filter(box => box.locked)
    if (lockedBoxes.length > 0) {
      // 按顺序找到第一个锁定的盒子
      const boxToUnlock = lockedBoxes.reduce((minBox, box) => 
        box.id < minBox.id ? box : minBox
      )
      
      // 显示解锁动画
      unlockedBox.value = boxToUnlock.id
      
      // 等待解锁动画
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      boxes.value[boxToUnlock.id] = {
        ...boxToUnlock,
        locked: false
      }
      
      addLog(`解锁盒子${boxToUnlock.id + 1}`, 'success')
      
      // 隐藏解锁动画
      unlockedBox.value = null
    } else {
      addLog('所有盒子都已解锁！', 'success')
    }
    
    isMerging.value = false
    addLog('合成完成！', 'success')
  }
  
  // 切换锁定状态
  const toggleLock = (boxId: number) => {
    const box = boxes.value[boxId]
    boxes.value[boxId] = {
      ...box,
      locked: !box.locked
    }
    
    const action = box.locked ? '解锁' : '加锁'
    addLog(`${action}了盒子${boxId + 1}`, box.locked ? 'success' : 'warning')
  }
  
  // 初始化游戏
  onMounted(() => {
    initializeBoxes()
    addLog('游戏初始化完成', 'info')
    addLog('前3个盒子已解锁，后6个盒子已锁定', 'info')
    addLog('点击发牌按钮开始游戏', 'info')
  })
  </script>
  
  <style scoped>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  .app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }
  
  h1 {
    text-align: center;
    color: white;
    margin-bottom: 30px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    font-size: 2.5rem;
  }
  
  .controls {
    display: flex;
    gap: 20px;
    margin-bottom: 30px;
    align-items: flex-start;
    background: white;
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  }
  
  .btn {
    padding: 12px 24px;
    font-size: 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    font-weight: bold;
    position: relative;
    overflow: hidden;
    min-width: 120px;
  }
  
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
  }
  
  .deal-btn {
    background: linear-gradient(135deg, #4CAF50, #2E7D32);
    color: white;
  }
  
  .merge-btn {
    background: linear-gradient(135deg, #2196F3, #0D47A1);
    color: white;
  }
  
  .merge-btn:not(:disabled):hover {
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(33, 150, 243, 0); }
    100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0); }
  }
  
  /* 特效容器 */
  .effect-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 100;
  }
  
  .merge-effect {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--effect-color);
    animation: mergeEffect 1s ease-out forwards;
    box-shadow: 0 0 15px var(--effect-color);
  }
  
  @keyframes mergeEffect {
    0% {
      transform: translate(0, 0) scale(1);
      opacity: 1;
    }
    100% {
      transform: translate(
        calc(cos(var(--random-angle, 0deg)) * 200px),
        calc(sin(var(--random-angle, 0deg)) * 200px)
      ) scale(0);
      opacity: 0;
    }
  }
  
  .instructions {
    flex: 1;
    padding: 15px;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    border-radius: 10px;
    border-left: 5px solid #2196F3;
  }
  
  .instructions h3 {
    margin-bottom: 10px;
    color: #333;
    font-size: 1.2rem;
  }
  
  .instructions ul {
    padding-left: 20px;
    color: #555;
  }
  
  .instructions li {
    margin-bottom: 8px;
    line-height: 1.5;
  }
  
  .boxes-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 30px;
  }
  
  .box {
    border: 3px solid #ddd;
    border-radius: 12px;
    padding: 15px;
    background: white;
    cursor: pointer;
    transition: all 0.3s;
    min-height: 220px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  }
  
  .box:hover {
    transform: translateY(-8px);
    box-shadow: 0 15px 30px rgba(0,0,0,0.2);
  }
  
  .box.selected {
    border-color: #2196F3;
    box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.3);
    animation: selectedPulse 2s infinite;
  }
  
  @keyframes selectedPulse {
    0%, 100% { border-color: #2196F3; }
    50% { border-color: #4CAF50; }
  }
  
  .box.locked {
    background: linear-gradient(135deg, #f5f5f5, #e0e0e0);
    opacity: 0.8;
  }
  
  .box.locked .box-content {
    filter: grayscale(100%);
  }
  
  .box.merging {
    animation: mergeBox 0.8s ease-in-out;
    border-color: #FF9800;
    box-shadow: 0 0 25px rgba(255, 152, 0, 0.6);
  }
  
  @keyframes mergeBox {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }
  
  .box.can-merge {
    border-color: #FF9800;
    animation: canMergePulse 2s infinite;
  }
  
  @keyframes canMergePulse {
    0%, 100% { 
      border-color: #FF9800;
      box-shadow: 0 0 20px rgba(255, 152, 0, 0.4);
    }
    50% { 
      border-color: #FF5722;
      box-shadow: 0 0 30px rgba(255, 87, 34, 0.7);
    }
  }
  
  .box-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 2px solid #eee;
  }
  
  .box-number {
    font-weight: bold;
    color: #333;
    font-size: 1.1rem;
  }
  
  .lock-btn {
    background: rgba(0,0,0,0.05);
    border: none;
    font-size: 24px;
    cursor: pointer;
    padding: 8px;
    transition: all 0.3s;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .lock-btn:hover {
    transform: scale(1.2);
    background: rgba(0,0,0,0.1);
  }
  
  .lock-btn.locked {
    color: #f44336;
  }
  
  .box-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  
  .cards-count {
    font-size: 14px;
    color: #666;
    margin-bottom: 10px;
    font-weight: bold;
  }
  
  .box-max-value {
    font-size: 12px;
    color: #888;
    margin-left: 5px;
  }
  
  .card-value-distribution {
    display: flex;
    gap: 4px;
    margin-top: 10px;
    flex-wrap: wrap;
    justify-content: center;
    min-height: 24px;
  }
  
  .value-item {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    cursor: help;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    border: 2px solid rgba(255,255,255,0.5);
    transition: transform 0.2s;
  }
  
  .value-item:hover {
    transform: scale(1.2);
  }
  
  .cards-visual-container {
    min-height: 60px;
    margin-bottom: 10px;
  }
  
  .cards-visual {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
    min-height: 45px;
  }
  
  .card {
    width: 30px;
    height: 45px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 14px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    border: 2px solid rgba(255,255,255,0.3);
    transition: all 0.3s;
    position: relative;
    transform-style: preserve-3d;
  }
  
  .card:hover {
    transform: translateY(-5px) rotate(2deg);
    box-shadow: 0 8px 16px rgba(0,0,0,0.3);
    z-index: 100;
  }
  
  /* 卡片堆叠效果 */
  .cards-visual .card:nth-child(1) { transform: rotate(-2deg); z-index: 5; }
  .cards-visual .card:nth-child(2) { transform: rotate(1deg); z-index: 4; margin-left: -8px; }
  .cards-visual .card:nth-child(3) { transform: rotate(-1deg); z-index: 3; margin-left: -8px; }
  .cards-visual .card:nth-child(4) { transform: rotate(2deg); z-index: 2; margin-left: -8px; }
  .cards-visual .card:nth-child(5) { transform: rotate(-1.5deg); z-index: 1; margin-left: -8px; }
  
  /* 卡片动画 */
  .card-enter-active {
    transition: all 0.5s ease;
  }
  
  .card-enter-from {
    opacity: 0;
    transform: translateY(30px) scale(0.8) rotate(20deg);
  }
  
  .card-leave-active {
    transition: all 0.5s ease;
    position: absolute;
  }
  
  .card-leave-to {
    opacity: 0;
    transform: translateY(-30px) scale(0.8) rotate(-20deg);
  }
  
  .card-move {
    transition: all 0.5s ease;
  }
  
  .more-cards {
    font-size: 13px;
    color: #666;
    font-weight: bold;
    text-align: center;
    margin-top: 5px;
    padding: 3px 8px;
    background: rgba(0,0,0,0.05);
    border-radius: 12px;
    display: inline-block;
    align-self: center;
  }
  
  .empty-box {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #aaa;
    font-style: italic;
    font-size: 1.1rem;
  }
  
  /* 合成提示 */
  .merge-hint {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: linear-gradient(135deg, #FF9800, #FF5722);
    color: white;
    padding: 6px 12px;
    border-radius: 15px;
    font-size: 13px;
    font-weight: bold;
    animation: hintPulse 1.5s infinite;
    box-shadow: 0 4px 10px rgba(255, 87, 34, 0.4);
  }
  
  @keyframes hintPulse {
    0%, 100% { 
      opacity: 1;
      transform: scale(1);
    }
    50% { 
      opacity: 0.8;
      transform: scale(1.05);
    }
  }
  
  .merge-hint-enter-active,
  .merge-hint-leave-active {
    transition: all 0.5s ease;
  }
  
  .merge-hint-enter-from,
  .merge-hint-leave-to {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
  }
  
  /* 升级动画 */
  .level-up-animation {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 20;
    pointer-events: none;
  }
  
  .level-up-text {
    font-size: 28px;
    font-weight: bold;
    color: #FF9800;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    animation: levelUpText 1.5s ease-out forwards;
    display: block;
    text-align: center;
  }
  
  @keyframes levelUpText {
    0% {
      opacity: 0;
      transform: translateY(0) scale(0.5);
    }
    20% {
      opacity: 1;
      transform: translateY(-30px) scale(1.3);
    }
    40% {
      transform: translateY(-60px) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-100px) scale(0.8);
    }
  }
  
  .level-up-sparkles {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 120px;
    height: 120px;
    transform: translate(-50%, -50%);
  }
  
  .sparkle {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #FFD700;
    animation: sparkle 1s ease-out forwards;
    top: 50%;
    left: 50%;
  }
  
  @keyframes sparkle {
    0% {
      opacity: 1;
      transform: translate(0, 0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(
        calc(cos(var(--sparkle-angle, 0deg)) * 80px),
        calc(sin(var(--sparkle-angle, 0deg)) * 80px)
      ) scale(0);
    }
  }
  
  .level-up-enter-active {
    animation: levelUpEnter 0.3s ease;
  }
  
  .level-up-leave-active {
    animation: levelUpLeave 0.3s ease;
  }
  
  @keyframes levelUpEnter {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
  
  @keyframes levelUpLeave {
    from {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    to {
      opacity: 0;
      transform: translate(-50%, -50%) scale(1.3);
    }
  }
  
  /* 解锁动画 */
  .unlock-animation {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    pointer-events: none;
  }
  
  .unlock-message {
    background: linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(66, 165, 245, 0.95));
    color: white;
    padding: 25px 50px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 15px 40px rgba(0,0,0,0.4);
    backdrop-filter: blur(10px);
    animation: unlockMessage 1.5s ease-out forwards;
  }
  
  @keyframes unlockMessage {
    0% {
      opacity: 0;
      transform: scale(0.5) rotate(-10deg);
    }
    20% {
      opacity: 1;
      transform: scale(1.15) rotate(5deg);
    }
    40% {
      transform: scale(1) rotate(0deg);
    }
    80% {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
    100% {
      opacity: 0;
      transform: scale(1.2) rotate(10deg);
    }
  }
  
  .unlock-icon {
    font-size: 60px;
    animation: unlockIcon 2s infinite;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
  }
  
  @keyframes unlockIcon {
    0%, 100% { transform: rotate(0deg) scale(1); }
    25% { transform: rotate(15deg) scale(1.1); }
    75% { transform: rotate(-15deg) scale(1.1); }
  }
  
  .unlock-text {
    font-size: 28px;
    font-weight: bold;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  }
  
  .unlock-enter-active,
  .unlock-leave-active {
    transition: all 1.5s ease;
  }
  
  .unlock-enter-from,
  .unlock-leave-to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5) rotate(-30deg);
  }
  
  /* 状态面板 */
  .status-panel {
    display: flex;
    justify-content: center;
    gap: 40px;
    margin: 25px 0;
    padding: 20px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 15px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    backdrop-filter: blur(10px);
  }
  
  .status-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    min-width: 120px;
  }
  
  .status-label {
    font-size: 16px;
    color: #555;
    font-weight: 600;
  }
  
  .status-value {
    font-size: 32px;
    font-weight: bold;
    color: #2196F3;
    min-width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border-radius: 50%;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    transition: all 0.3s;
  }
  
  .status-value:hover {
    transform: scale(1.1);
    box-shadow: 0 8px 20px rgba(33, 150, 243, 0.3);
  }
  
  /* 游戏日志 */
  .game-log {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 15px;
    padding: 25px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    backdrop-filter: blur(10px);
  }
  
  .game-log h3 {
    margin-bottom: 20px;
    color: #333;
    padding-bottom: 15px;
    border-bottom: 3px solid #2196F3;
    font-size: 1.4rem;
  }
  
  .log-content {
    max-height: 250px;
    overflow-y: auto;
    padding: 15px;
    background: white;
    border-radius: 10px;
    border: 2px solid #e0e0e0;
  }
  
  .log-entry {
    padding: 12px 18px;
    margin-bottom: 10px;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.3s;
    background-color: #f8fafc;
    border-left: 5px solid #2196F3;
    box-shadow: 0 3px 10px rgba(0,0,0,0.05);
  }
  
  .log-entry:hover {
    transform: translateX(8px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  }
  
  .log-success {
    background-color: #f0fff4;
    border-left-color: #4CAF50;
    color: #2e7d32;
  }
  
  .log-error {
    background-color: #fff0f0;
    border-left-color: #f44336;
    color: #c62828;
  }
  
  .log-warning {
    background-color: #fff8e1;
    border-left-color: #FF9800;
    color: #ef6c00;
  }
  
  /* 日志动画 */
  .log-enter-active {
    transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  .log-enter-from {
    opacity: 0;
    transform: translateX(-30px) scale(0.9);
  }
  
  .log-leave-active {
    transition: all 0.5s ease;
    position: absolute;
    width: 100%;
  }
  
  .log-leave-to {
    opacity: 0;
    transform: translateX(30px) scale(0.9);
  }
  
  .log-move {
    transition: all 0.5s ease;
  }
  
  /* 响应式设计 */
  @media (max-width: 1024px) {
    .boxes-container {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (max-width: 768px) {
    .app {
      padding: 15px;
    }
    
    h1 {
      font-size: 2rem;
    }
    
    .controls {
      flex-direction: column;
      gap: 15px;
    }
    
    .status-panel {
      flex-direction: column;
      gap: 20px;
      align-items: center;
    }
    
    .status-item {
      flex-direction: row;
      justify-content: space-between;
      width: 100%;
      max-width: 250px;
    }
    
    .status-label {
      font-size: 16px;
    }
    
    .status-value {
      font-size: 28px;
      width: 45px;
      height: 45px;
    }
    
    .unlock-message {
      padding: 15px 30px;
    }
    
    .unlock-icon {
      font-size: 40px;
    }
    
    .unlock-text {
      font-size: 20px;
    }
  }
  
  @media (max-width: 480px) {
    .boxes-container {
      grid-template-columns: 1fr;
    }
    
    h1 {
      font-size: 1.8rem;
    }
    
    .btn {
      min-width: 100px;
      padding: 10px 20px;
      font-size: 15px;
    }
    
    .status-item {
      max-width: 200px;
    }
    
    .unlock-message {
      padding: 10px 20px;
      flex-direction: column;
      text-align: center;
      gap: 10px;
    }
    
    .unlock-icon {
      font-size: 36px;
    }
    
    .unlock-text {
      font-size: 18px;
    }
  }
  
  /* 添加随机角度给特效 */
  .merge-effect:nth-child(8n+1) { --random-angle: 0deg; }
  .merge-effect:nth-child(8n+2) { --random-angle: 45deg; }
  .merge-effect:nth-child(8n+3) { --random-angle: 90deg; }
  .merge-effect:nth-child(8n+4) { --random-angle: 135deg; }
  .merge-effect:nth-child(8n+5) { --random-angle: 180deg; }
  .merge-effect:nth-child(8n+6) { --random-angle: 225deg; }
  .merge-effect:nth-child(8n+7) { --random-angle: 270deg; }
  .merge-effect:nth-child(8n+8) { --random-angle: 315deg; }
  
  /* 添加随机角度给火花 */
  .sparkle:nth-child(8n+1) { --sparkle-angle: 0deg; }
  .sparkle:nth-child(8n+2) { --sparkle-angle: 45deg; }
  .sparkle:nth-child(8n+3) { --sparkle-angle: 90deg; }
  .sparkle:nth-child(8n+4) { --sparkle-angle: 135deg; }
  .sparkle:nth-child(8n+5) { --sparkle-angle: 180deg; }
  .sparkle:nth-child(8n+6) { --sparkle-angle: 225deg; }
  .sparkle:nth-child(8n+7) { --sparkle-angle: 270deg; }
  .sparkle:nth-child(8n+8) { --sparkle-angle: 315deg; }
  
  /* 自定义滚动条 */
  .log-content::-webkit-scrollbar {
    width: 8px;
  }
  
  .log-content::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  
  .log-content::-webkit-scrollbar-thumb {
    background: #2196F3;
    border-radius: 10px;
  }
  
  .log-content::-webkit-scrollbar-thumb:hover {
    background: #1976D2;
  }
  </style>