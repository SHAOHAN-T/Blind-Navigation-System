/**
 * Local Voice Service - Pure offline voice using pre-generated templates
 * No network required!
 */

class LocalVoiceService {
  constructor() {
    this.app = null
    this.pageVoiceManifest = null
    this.navigationManifest = null
    this.roomVoiceManifest = null  // 房间语音清单
    this.isInitialized = false
    this.currentAudio = null
    this.audioQueue = []
    this.isPlaying = false
  }

  /**
   * Get app instance
   */
  getApp() {
    if (!this.app) {
      try {
        this.app = getApp()
      } catch (error) {
        console.error('❌ Cannot get app instance:', error)
        return null
      }
    }
    return this.app
  }

  /**
   * Initialize - load manifests
   */
  async initialize() {
    if (this.isInitialized) return true

    console.log('🔊 Initializing local voice service...')
    
    try {
      const app = this.getApp()
      if (!app || !app.globalData) {
        throw new Error('App instance not available')
      }

      const baseUrl = app.globalData.apiBaseUrl.replace('/api', '')
      
      // Load page voice manifest, navigation manifest, and room voice manifest
      const pageManifestUrl = `${baseUrl}/static/audio/page_voices/manifest.json`
      const navManifestUrl = `${baseUrl}/static/audio/navigation_templates/manifest.json`
      const roomManifestUrl = `${baseUrl}/static/audio/room_voices/manifest.json`
      
      const [pageRes, navRes, roomRes] = await Promise.all([
        this.loadManifest(pageManifestUrl),
        this.loadManifest(navManifestUrl),
        this.loadManifest(roomManifestUrl)
      ])
      
      this.pageVoiceManifest = pageRes
      this.navigationManifest = navRes
      this.roomVoiceManifest = roomRes
      
      this.isInitialized = true
      console.log('✅ Local voice service initialized')
      console.log(`  - Page voices: ${Object.keys(this.pageVoiceManifest.files || {}).length}`)
      console.log(`  - Navigation templates: ${Object.keys(this.navigationManifest.templates || {}).length}`)
      console.log(`  - Room voices: ${Object.keys(this.roomVoiceManifest.rooms || {}).length}`)
      
      return true
    } catch (error) {
      console.error('❌ Failed to initialize local voice service:', error)
      return false
    }
  }

  /**
   * Load manifest file
   */
  async loadManifest(url) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        method: 'GET',
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data)
          } else {
            reject(new Error(`HTTP ${res.statusCode}`))
          }
        },
        fail: reject
      })
    })
  }

  /**
   * Play page voice by ID
   */
  async playPageVoice(voiceId, priority = 'normal') {
    await this.initialize()
    
    if (!this.pageVoiceManifest || !this.pageVoiceManifest.files[voiceId]) {
      console.warn(`⚠️ Page voice not found: ${voiceId}`)
      return false
    }

    const voiceInfo = this.pageVoiceManifest.files[voiceId]
    const app = this.getApp()
    const baseUrl = app.globalData.apiBaseUrl.replace('/api', '')
    const voiceUrl = `${baseUrl}/static/audio/page_voices/${voiceInfo.filename}`
    
    return this.playVoiceUrl(voiceUrl, priority)
  }

  /**
   * Play navigation instruction
   */
  async playNavigationInstruction(instructionText, priority = 'normal') {
    await this.initialize()
    
    // Match instruction to template
    const templateKey = this.matchInstructionToTemplate(instructionText)
    
    if (!templateKey) {
      console.warn(`⚠️ No matching template for: ${instructionText}`)
      // Fallback to generic template
      return this.playNavigationTemplate('guidance_unavailable', priority)
    }
    
    return this.playNavigationTemplate(templateKey, priority)
  }

  /**
   * Play navigation template by key
   */
  async playNavigationTemplate(templateKey, priority = 'normal') {
    await this.initialize()
    
    if (!this.navigationManifest || !this.navigationManifest.templates[templateKey]) {
      console.warn(`⚠️ Navigation template not found: ${templateKey}`)
      return false
    }

    const template = this.navigationManifest.templates[templateKey]
    const app = this.getApp()
    const baseUrl = app.globalData.apiBaseUrl.replace('/api', '')
    const voiceUrl = `${baseUrl}/static/audio/navigation_templates/${template.filename}`
    
    return this.playVoiceUrl(voiceUrl, priority)
  }

  /**
   * Play batch navigation instructions
   */
  async playBatchNavigation(instructions, callback) {
    await this.initialize()
    
    console.log(`🎙️ Playing batch navigation: ${instructions.length} instructions`)
    
    // Convert all instructions to template keys
    const templateKeys = instructions.map(inst => {
      const text = typeof inst === 'string' ? inst : (inst.text || '')
      return this.matchInstructionToTemplate(text) || 'guidance_unavailable'
    })
    
    // Play one by one
    let index = 0
    const playNext = () => {
      if (index >= templateKeys.length) {
        console.log('✅ Batch navigation playback completed')
        callback && callback(true)
        return
      }
      
      const templateKey = templateKeys[index]
      console.log(`  🔊 [${index + 1}/${templateKeys.length}] ${templateKey}`)
      
      this.playNavigationTemplate(templateKey, 'normal').then(() => {
        // Wait for current audio to finish
        if (this.currentAudio) {
          this.currentAudio.onEnded(() => {
            index++
            setTimeout(playNext, 500) // 0.5 second pause between instructions
          })
        } else {
          index++
          setTimeout(playNext, 500)
        }
      })
    }
    
    playNext()
  }

  /**
   * 匹配指令到语音模板（支持带步数的指令）
   */
  matchInstructionToTemplate(text) {
    if (!text || !this.navigationManifest) return null
    
    const lowerText = text.toLowerCase()
    const templates = this.navigationManifest.templates
    
    // 1. 匹配带步数的指令（如 "Walk 5 steps forward"）
    const stepMatch = lowerText.match(/walk\s+(\d+)\s+steps?\s+forward/i)
    if (stepMatch) {
      const steps = parseInt(stepMatch[1])
      const templateKey = `walk_${steps}_steps`
      
      // 检查是否有对应的语音文件
      if (templates[templateKey]) {
        console.log(`✓ 匹配到步数语音: ${templateKey} (${steps}步)`)
        return templateKey
      } else {
        // 没有对应步数的语音，使用通用语音
        console.log(`⚠️ 没有${steps}步的语音，使用通用语音`)
        return 'go_straight'
      }
    }
    
    // 2. 直接关键词匹配
    for (const [key, template] of Object.entries(templates)) {
      if (template.keywords) {
        for (const keyword of template.keywords) {
          if (lowerText.includes(keyword.toLowerCase())) {
            return key
          }
        }
      }
    }
    
    // 3. 降级匹配
    if (lowerText.includes('turn left') || lowerText.includes('left')) return 'turn_left'
    if (lowerText.includes('turn right') || lowerText.includes('right')) return 'turn_right'
    if (lowerText.includes('straight') || lowerText.includes('forward') || lowerText.includes('walk')) return 'go_straight'
    if (lowerText.includes('upstairs')) return 'go_upstairs'
    if (lowerText.includes('downstairs')) return 'go_downstairs'
    if (lowerText.includes('destination') || lowerText.includes('arrived') || lowerText.includes('reached')) return 'destination_reached'
    if (lowerText.includes('start') || lowerText.includes('begin')) return 'start_navigation'
    if (lowerText.includes('elevator')) {
      if (lowerText.includes('up')) return 'elevator_up'
      if (lowerText.includes('down')) return 'elevator_down'
    }
    
    return null
  }

  /**
   * Play voice from URL
   */
  playVoiceUrl(url, priority = 'normal') {
    return new Promise((resolve) => {
      const app = this.getApp()
      if (!app) {
        resolve(false)
        return
      }

      // Urgent priority interrupts current playback
      if (priority === 'urgent' && this.currentAudio) {
        this.stopCurrentAudio()
      }

      // Queue if already playing
      if (this.isPlaying && priority !== 'urgent') {
        this.audioQueue.push({ url, priority, resolve })
        return
      }

      this.isPlaying = true
      this.currentAudio = wx.createInnerAudioContext()
      this.currentAudio.src = url
      this.currentAudio.volume = app.globalData?.voiceSettings?.volume || 0.9

      this.currentAudio.onPlay(() => {
        console.log(`🔊 Playing: ${url.split('/').pop()}`)
      })

      this.currentAudio.onEnded(() => {
        console.log('✅ Playback completed')
        this.onPlayComplete()
        resolve(true)
      })

      this.currentAudio.onError((err) => {
        console.error('❌ Playback error:', err)
        this.onPlayComplete()
        resolve(false)
      })

      this.currentAudio.play()
    })
  }

  /**
   * Playback complete handler
   */
  onPlayComplete() {
    this.isPlaying = false
    if (this.currentAudio) {
      this.currentAudio.destroy()
      this.currentAudio = null
    }

    // Play next in queue
    if (this.audioQueue.length > 0) {
      const next = this.audioQueue.shift()
      setTimeout(() => {
        this.playVoiceUrl(next.url, next.priority).then(next.resolve)
      }, 100)
    }
  }

  /**
   * Play room voice by room name (硬编码房间语音)
   */
  async playRoomVoice(roomName) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.roomVoiceManifest || !this.roomVoiceManifest.rooms) {
      console.error('❌ Room voice manifest not loaded')
      return false
    }

    const roomData = this.roomVoiceManifest.rooms[roomName]
    
    if (!roomData) {
      console.warn(`⚠️ No voice template for room: ${roomName}`)
      // Fallback to generic room selected voice
      return this.playPageVoice('action_room_selected')
    }

    const app = this.getApp()
    if (!app || !app.globalData) {
      console.error('❌ App instance not available')
      return false
    }

    const baseUrl = app.globalData.apiBaseUrl.replace('/api', '')
    const voiceUrl = `${baseUrl}${this.roomVoiceManifest.base_path}${roomData.filename}`
    
    console.log(`🔊 Playing room voice: ${roomName} (${roomData.text})`)
    
    return this.playVoiceUrl(voiceUrl, 'high')
  }

  /**
   * Stop current audio
   */
  stopCurrentAudio() {
    if (this.currentAudio) {
      try {
        this.currentAudio.stop()
        this.currentAudio.destroy()
      } catch (error) {
        console.error('Error stopping audio:', error)
      }
      this.currentAudio = null
    }
    this.isPlaying = false
  }

  /**
   * Clear queue
   */
  clearQueue() {
    this.audioQueue = []
    this.stopCurrentAudio()
  }

  /**
   * Get available templates
   */
  getAvailableTemplates() {
    return {
      pageVoices: Object.keys(this.pageVoiceManifest?.files || {}),
      navigationTemplates: Object.keys(this.navigationManifest?.templates || {})
    }
  }
}

// Export singleton
let localVoiceServiceInstance = null

function getLocalVoiceService() {
  if (!localVoiceServiceInstance) {
    localVoiceServiceInstance = new LocalVoiceService()
  }
  return localVoiceServiceInstance
}

module.exports = {
  getLocalVoiceService,
  LocalVoiceService
}

