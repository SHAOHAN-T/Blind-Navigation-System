/**
 * Page Voice Announcement Service - Pure Local Templates (NO NETWORK!)
 * Uses pre-generated voice files for instant playback
 */

const { getLocalVoiceService } = require('./localVoiceService.js')

class VoiceAnnouncementService {
  constructor() {
    this.app = null // Delayed app instance retrieval
    this.isEnabled = true
    this.localVoice = null // Local voice service
    
    // Duplicate prevention
    this.lastAnnouncementTime = new Map() // Record last announcement time
    this.duplicatePreventionDelay = 3000 // No duplicate announcement of same content within 3 seconds
    
    // Predefined voice ID mapping
    this.voiceIdMapping = {
      // Page enter
      'page_enter_home': 'page_enter_home',
      'page_enter_map_list': 'page_enter_map_list',
      'page_enter_navigation': 'page_enter_navigation',
      'page_enter_settings': 'page_enter_settings',
      
      // Button operations
      'button_voice_test': 'button_voice_test',
      'button_settings': 'button_settings',
      'button_view_all_maps': 'button_view_all_maps',
      'button_start_navigation': 'button_start_navigation',
      'button_stop_navigation': 'button_stop_navigation',
      
      // Navigation related
      'navigation_started': 'navigation_started',
      'navigation_stopped': 'navigation_stopped',
      'navigation_completed': 'navigation_completed',
      
      // General operations
      'action_loading': 'action_loading',
      'action_success': 'action_success',
      'action_error': 'action_error',
      'map_selected': 'map_selected',
      'room_selection_mode': 'room_selection_mode',
      
      // Error and success messages
      'error_network': 'error_network',
      'success_navigation_started': 'success_navigation_started'
    }
    
    // Initialize settings
    this.loadSettings()
    
    // Get local voice service
    this.localVoice = getLocalVoiceService()
  }

  /**
   *  Safe get app instance
   */
  getApp() {
    if (!this.app) {
      try {
        this.app = getApp()
        if (!this.app) {
          console.error('❌ Cannot get app instance')
          return null
        }
      } catch (error) {
        console.error('❌ Failed to get app instance:', error)
        return null
      }
    }
    return this.app
  }

  /**
   *  Load voice announcement settings
   */
  loadSettings() {
    try {
      const voiceSettings = wx.getStorageSync('voiceSettings') || {}
      this.isEnabled = voiceSettings.pageAnnouncement !== false // Default enabled
      this.volume = voiceSettings.volume || 0.8
      this.speed = voiceSettings.speed || 1.0
    } catch (e) {
      console.error('Failed to load voice announcement settings:', e)
    }
  }


  /**
   * Check if should prevent duplicate playback
   */
  shouldPreventDuplicate(key) {
    const now = Date.now()
    const lastTime = this.lastAnnouncementTime.get(key)
    
    if (lastTime && (now - lastTime) < this.duplicatePreventionDelay) {
      console.log(`🔇 Prevent duplicate playback: ${key}`)
      return true
    }
    
    this.lastAnnouncementTime.set(key, now)
    return false
  }

  /**
   * Announce page enter
   */
  announcePageEnter(pageName, pageDescription = '') {
    if (!this.isEnabled) return
    
    // Prevent duplicate playback check
    const duplicateKey = `page_enter_${pageName}`
    if (this.shouldPreventDuplicate(duplicateKey)) {
      return
    }
    
    // Page name mapping to English ID (support Chinese and English)
    const pageNameMapping = {
      '首页': 'home',
      'Home': 'home',
      '地图列表': 'map_list',
      'Map List': 'map_list',
      '导航页面': 'navigation',
      'Navigation Page': 'navigation',
      '设置': 'settings',
      'Settings': 'settings'
    }
    
    const englishPageName = pageNameMapping[pageName] || pageName.toLowerCase()
    const voiceId = this.voiceIdMapping[`page_enter_${englishPageName}`]
    
    if (voiceId) {
      this.playPredefinedVoice(voiceId)
    } else {
      // Fallback: use dynamic voice generation
      const announcement = pageDescription || `Entered ${pageName} page`
      this.playDynamicVoice(announcement)
    }
  }

  /**
    * Announce user operation
   */
  announceAction(action, target = '', result = '') {
    if (!this.isEnabled) return
    
    // Operation mapping to English ID (support Chinese and English)
    const actionMapping = {
      '选择地图': 'map_selected',
      'Map Selection': 'map_selected',
      '开始导航': 'navigation_started',
      'Start Navigation': 'navigation_started',
      '停止导航': 'navigation_stopped',
      'Stop Navigation': 'navigation_stopped',
      '加载中': 'action_loading',
      'Loading': 'action_loading',
      '加载完成': 'action_loading_complete',
      'Loading Complete': 'action_loading_complete'
    }
    
    const englishAction = actionMapping[action] || action.toLowerCase().replace(/\s+/g, '_')
    const voiceId = this.voiceIdMapping[englishAction] || this.voiceIdMapping[`action_${englishAction}`]
    
    if (voiceId && !target && !result) {
      this.playPredefinedVoice(voiceId)
    } else {
      // Use dynamic voice, include target and result information
      let announcement = `${action}`
      if (target) {
        announcement += ` ${target}`
      }
      if (result) {
        announcement += `. ${result}`
      }
      
      this.playDynamicVoice(announcement, {
        template_key: 'selected_map',
        dynamic_content: { map_name: target }
      })
    }
  }

  /**
   * Announce room selection - 使用本地硬编码房间语音（无网络依赖）
   */
  announceRoomSelection(roomName, description = '') {
    if (!this.isEnabled) return
    
    console.log(`🔊 播报房间选择（本地语音）: ${roomName}`)
    
    // 直接使用本地房间语音文件（硬编码，无网络请求）
    this.localVoice.playRoomVoice(roomName)
  }

  /**
   * Announce button operation
   */
  announceButton(buttonName, action = 'pressed') {
    if (!this.isEnabled) return
    
    // Button name mapping to English ID (support Chinese and English)
    const buttonMapping = {
      '语音测试': 'button_voice_test',
      'Voice Test': 'button_voice_test',
      '查看所有地图': 'button_view_all_maps',
      'View All Maps': 'button_view_all_maps',
      '设置': 'button_settings',
      'Settings': 'button_settings',
      '地图详情': 'button_view_all_maps', // Mapping to existing ID
      'Map Details': 'button_view_all_maps',
      '快速导航': 'button_start_navigation',
      'Quick Navigation': 'button_start_navigation'
    }
    
    const englishButtonName = buttonMapping[buttonName] || buttonName.toLowerCase().replace(/\s+/g, '_')
    const voiceId = this.voiceIdMapping[`button_${englishButtonName}`]
    
    if (voiceId) {
      this.playPredefinedVoice(voiceId)
    } else {
      const announcement = `${buttonName} button ${action}`
      this.playDynamicVoice(announcement)
    }
  }

  /**
   * Announce loading status
   */
  announceLoading(isLoading, content = '') {
    if (!this.isEnabled) return
    
    if (isLoading && !content) {
      this.playPredefinedVoice('action_loading')
    } else {
      const announcement = isLoading ? 
        `Loading ${content}` : 
        `${content} loaded`
      
      this.playDynamicVoice(announcement)
    }
  }

  /**
    * Announce error information
   */
  announceError(errorMessage) {
    if (!this.isEnabled) return
    
    // Check if there is a predefined error voice
    const errorKey = errorMessage.toLowerCase().replace(/\s+/g, '_')
    const voiceId = this.voiceIdMapping[`error_${errorKey}`]
    
    if (voiceId) {
      this.playPredefinedVoice(voiceId)
    } else {
      this.playPredefinedVoice('action_error')
    }
  }

  /**
   * Announce success information
   */
  announceSuccess(successMessage) {
    if (!this.isEnabled) return
    
    // Check if there is a predefined success voice
    const successKey = successMessage.toLowerCase().replace(/\s+/g, '_')
    const voiceId = this.voiceIdMapping[`success_${successKey}`]
    
    if (voiceId) {
      this.playPredefinedVoice(voiceId)
    } else {
      this.playPredefinedVoice('action_success')
    }
  }

  /**
   * Play predefined voice - Pure local template
   */
  async playPredefinedVoice(voiceId, priority = 'normal') {
    if (!this.isEnabled || !voiceId) return
    
    console.log(`🔊 Playing local page voice: ${voiceId}`)
    
    // Use local voice service - instant, no network!
    this.localVoice.playPageVoice(voiceId, priority)
  }

  /**
   * Play dynamic voice - Generate real voice for map details, use templates for others
   */
  playDynamicVoice(text, dynamicParams = null) {
    if (!this.isEnabled) return
    
    console.log(`🔊 Dynamic voice requested: ${text}`)
    
    const textLower = text.toLowerCase()
    
    // 根据关键词匹配本地模板（完全本地化，无网络请求）
    let voiceId = 'action_success' // default
    
    // 地图详情 (Map details)
    if (textLower.includes('map') && textLower.includes('details')) {
      voiceId = 'page_map_details'
    }
    // 快速导航 (Quick navigation)
    else if (textLower.includes('quick') && textLower.includes('navigation')) {
      voiceId = 'action_quick_nav'
    }
    // Loading states
    else if (textLower.includes('loading')) {
      voiceId = 'action_loading'
    }
    // Success states
    else if (textLower.includes('success') || textLower.includes('complete')) {
      voiceId = 'action_success'
    }
    // Error states
    else if (textLower.includes('error') || textLower.includes('failed')) {
      voiceId = 'action_error'
    }
    
    this.playPredefinedVoice(voiceId)
  }
  

  /**
   * Set voice announcement switch
   */
  setEnabled(enabled) {
    this.isEnabled = enabled
    
    // Save settings
    try {
      const voiceSettings = wx.getStorageSync('voiceSettings') || {}
      voiceSettings.pageAnnouncement = enabled
      wx.setStorageSync('voiceSettings', voiceSettings)
    } catch (e) {
      console.error('Save voice announcement settings failed:', e)
    }
  }

  /**
   * Clear announcement queue
   */
  clearQueue() {
    this.queuedAnnouncements = []
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      isPlaying: this.isPlaying,
      isInitialized: this.isInitialized,
      queueLength: this.queuedAnnouncements.length,
      cacheSize: this.voiceCache.size
    }
  }
}

// Export singleton
let voiceAnnouncementService = null

function getVoiceAnnouncementService() {
  if (!voiceAnnouncementService) {
    voiceAnnouncementService = new VoiceAnnouncementService()
  }
  return voiceAnnouncementService
}

// Convenient methods
function announcePageEnter(pageName, description) {
  getVoiceAnnouncementService().announcePageEnter(pageName, description)
}

function announceAction(action, target, result) {
  getVoiceAnnouncementService().announceAction(action, target, result)
}

function announceRoomSelection(roomName, mapName) {
  getVoiceAnnouncementService().announceRoomSelection(roomName, mapName)
}

function announceButton(buttonName, action) {
  getVoiceAnnouncementService().announceButton(buttonName, action)
}

function announceLoading(isLoading, content) {
  getVoiceAnnouncementService().announceLoading(isLoading, content)
}

function announceError(errorMessage) {
  getVoiceAnnouncementService().announceError(errorMessage)
}

function announceSuccess(successMessage) {
  getVoiceAnnouncementService().announceSuccess(successMessage)
}

function playDynamicVoice(text, dynamicParams = null) {
  getVoiceAnnouncementService().playDynamicVoice(text, dynamicParams)
}

// CommonJS export
module.exports = {
  getVoiceAnnouncementService,
  announcePageEnter,
  announceAction,
  announceRoomSelection,
  announceButton,
  announceLoading,
  announceError,
  announceSuccess,
  playDynamicVoice
}
