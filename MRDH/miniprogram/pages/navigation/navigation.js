// Navigation page logic
const app = getApp()
const { 
  announcePageEnter,
  announceRoomSelection
} = require('../../utils/voiceAnnouncement.js')
const { getLocalVoiceService } = require('../../utils/localVoiceService.js')

Page({
  data: {
    // Map information
    mapData: null,
    mapId: null,
    allRooms: [], // All rooms list (including floor information)
    
    // Navigation information
    currentPath: [],
    instructions: [],
    currentInstructionIndex: 0,
    
    // Position information
    currentPosition: { x: 0, y: 0 },
    targetPosition: { x: 0, y: 0 },
    targetRoom: null,
    
    // Navigation status
    navigationActive: false,
    isNavigating: false,
    
    // Map display
    mapGrid: [],
    cellSize: 20, // rpx - Dynamically calculated cell size
    
    // Voice control
    currentAudio: null,
    voiceEnabled: true,
    autoPlayVoice: true,
    
    // UI status
    loading: true,
    loadingText: 'Loading map data...',
    showInstructions: true,
    mapScale: 1.0,
    mapScaleDisplay: 100,
    touchMode: 'none', // none, scroll, zoom
    
    // 3D mode
    is3DMode: false,
    isReal3DMap: false, // Whether it's a real 3D map
    currentFloor: 1,
    
  },

  onLoad: function (options) {
    console.log('🚀 Navigation page loading, parameters:', options)
    
    // Initialize basic state
    this.setData({
      loading: true
    })
    
    // If there's a mapId parameter, directly load the specified map
    if (options.mapId) {
      const mapId = parseInt(options.mapId)
      const mapName = options.mapName ? decodeURIComponent(options.mapName) : 'Map'
      console.log('🎯 Quick navigation: directly loading map:', { mapId, mapName })
      this.loadMap(mapId, mapName)
    } else {
      console.log('⚠️ No mapId parameter, will show map selector in onShow')
    }
  },

  // Load specified map
  loadMap: function(mapId, mapName) {
    console.log('🗺️ Loading map:', { mapId, mapName })
    this.loadMapData(mapId, mapName)
  },

  // Show map selector
  showMapSelector: function() {
    // 🔧 Reset all navigation related states to ensure correct page layout
    this.setData({ 
      loading: true,
      navigationActive: false,
      isNavigating: false,
      currentPath: [],
      instructions: [],
      currentInstructionIndex: 0,
      targetPosition: { x: 0, y: 0 },
      targetRoom: null
    })
    
    // Stop current audio playback
    this.stopCurrentAudio()
    
    app.getMaps((maps) => {
      this.setData({ loading: false })
      
      if (!maps || maps.length === 0) {
        wx.showModal({
          title: 'Notice',
          content: 'No maps available. Please create maps in the admin panel first.',
          showCancel: false,
          confirmText: 'Back to Home',
          success: () => {
            wx.switchTab({
              url: '/pages/index/index'
            })
          }
        })
        return
      }
      
      const mapNames = maps.map(map => map.name)
      
      wx.showActionSheet({
        itemList: mapNames,
        success: (res) => {
          const selectedMap = maps[res.tapIndex]
          
          // Directly load the selected map
          this.loadMapData(selectedMap.id, selectedMap.name)
        },
        fail: () => {
          // User cancelled selection, can stay on current page
        }
      })
    })
  },

  // 🔧 Common method: handle map data and 3D/2D determination
  _processMapData: function(mapData, options = {}) {
    
    // Unified 3D/2D determination logic (supports two field formats)
    const isReal3DMap = mapData.map_type === '3D' || mapData.is_3d === true;
    
    // Set basic data
    const dataToSet = {
      mapData: mapData,
      isReal3DMap: isReal3DMap,
      is3DMode: isReal3DMap,
      currentPosition: {
        x: mapData.entrance.x,
        y: mapData.entrance.y
      },
      loading: false
    }
    
    // 🔧 3D map special handling
    if (isReal3DMap && mapData.floors) {
      // Ensure currentFloor is a valid floor
      const availableFloors = Object.keys(mapData.floors).map(f => parseInt(f)).sort()
      if (availableFloors.length > 0) {
        dataToSet.currentFloor = availableFloors[0] // Default to first floor
      }
    }
    
    // Merge additional data
    if (options.extraData) {
      Object.assign(dataToSet, options.extraData)
    }
    
    this.setData(dataToSet, () => {
      console.log('🚨 Unified processing complete, verification:', {
        isReal3DMap: this.data.isReal3DMap,
        is3DMode: this.data.is3DMode,
        hasMapData: !!this.data.mapData,
        mapDataWidth: this.data.mapData ? this.data.mapData.width : 'none'
      })
      
      // Execute callback after setData completion
      if (options.callback) {
        options.callback()
      }
    })
  },

  // Load map data
  loadMapData: function(mapId, mapName) {
    
    this.setData({ 
      loading: true,
      mapId: mapId,
      navigationActive: false,
      targetRoom: null
    })

    // Load map details
    app.getMapDetail(mapId, (mapData) => {
      
      // 🔧 Use unified map processing method
      this._processMapData(mapData, {
        callback: () => {
          console.log('🔧 Map data processing complete, start initialization display')
          // Initialize map display
          this.initMapDisplay()
          
          // 🔧 Get room list after data setting is complete
          const allRooms = this.getAllRoomsFromMap(mapData)
          console.log('🏠 Retrieved room data:', allRooms ? allRooms.length : 0)
          
          if (allRooms && allRooms.length > 0) {
            // Set room data for sliding selection use
            this.setData({ allRooms: allRooms })
            console.log('✅ Quick navigation: room data setting complete, room count:', allRooms.length)
            console.log('📋 Room list preview:', allRooms.slice(0, 3).map(r => ({ id: r.id, name: r.name })))
          } else {
            console.log('❌ Room data not found, map details:', {
              mapName: mapData.name,
              isReal3DMap: this.data.isReal3DMap,
              hasMainRooms: !!(mapData.rooms),
              mainRoomsLength: mapData.rooms ? mapData.rooms.length : 0
            })
            
            // 🔧 If it's a 3D map but no rooms found, try to directly check main rooms field
            if (this.data.isReal3DMap && mapData.rooms && mapData.rooms.length > 0) {
              const fallbackRooms = mapData.rooms.map(room => ({
                ...room,
                floor: 1,
                floorName: 'Floor 1'
              }))
              this.setData({ allRooms: fallbackRooms })
            } else {
              this.setData({ allRooms: [] })
              wx.showToast({
                title: 'This map has no rooms',
                icon: 'none'
              })
            }
          }
        }
      })
    })
  },

  // 🔧 Get all rooms from map (support 2D and 3D)
  getAllRoomsFromMap: function(mapData) {
    let allRooms = []
    
    // 🔧 Key fix: prioritize checking floors field, not rely on isReal3DMap flag
    if (mapData.floors && Object.keys(mapData.floors).length > 0) {
      // 3D map: collect rooms from all floors
      Object.keys(mapData.floors).forEach(floorId => {
        const floor = mapData.floors[floorId]
        if (floor.rooms && floor.rooms.length > 0) {
          // Add floor information for each room
          const floorRooms = floor.rooms.map(room => ({
            ...room,
            floor: parseInt(floorId),
            floorName: floor.name || `Floor ${floorId}`
          }))
          allRooms.push(...floorRooms)
        }
      })
      
    } else if (mapData.rooms && mapData.rooms.length > 0) {
      // 2D map: directly use rooms array
      allRooms = mapData.rooms.map(room => ({
        ...room,
        floor: room.floor || 1, // Retain original floor info, or default to floor 1
        floorName: room.floor ? `Floor ${room.floor}` : 'Floor 1'
      }))
      
    }
    
    return allRooms
  },

  // 🔧 Unified processing for room selection
  selectRoom: function(selectedRoom) {
    
    // 🔧 Ensure room object contains complete information
    const targetRoom = {
      id: selectedRoom.id,
      name: selectedRoom.name,
      x: selectedRoom.x,
      y: selectedRoom.y
    }
    
    // 🔧 3D map needs to add floor information
    if (this.data.isReal3DMap && selectedRoom.floor !== undefined) {
      targetRoom.floor = selectedRoom.floor
    }
    
    // Set target room
    this.setData({
      targetRoom: targetRoom,
      targetPosition: {
        x: selectedRoom.x,
        y: selectedRoom.y
      }
    })
    
    
    // Only update target marker on map, don't re-render entire map
    this.updateTargetMarker()

    wx.showToast({
      title: `Selected ${selectedRoom.name}`,
      icon: 'success'
    })
    
    // Note: no longer auto-start navigation, requires second click to start
  },

  onShow: function () {
    console.log('Navigation page displayed')
    
    // Restore voice settings
    this.setData({
      voiceEnabled: app.globalData.voiceSettings.enabled,
      autoPlayVoice: app.globalData.voiceSettings.autoPlay
    })
    
    // Check if there are quick navigation parameters
    this.checkQuickNavigationParams()
    
    // 🔊 Voice announcement: page entry (only announce when there's map data)
    if (this.data.mapData) {
      const mapName = this.data.mapData.name || 'Navigation'
      announcePageEnter('Navigation Page', `Entered map: ${mapName}, please select a room to start navigation`)
    } else if (!this.data.loading) {
      // If no map data and not loading, show map selector
      this.showMapSelector()
    }
  },

  // Check quick navigation parameters
  checkQuickNavigationParams: function() {
    const quickNavParams = app.globalData.quickNavigationParams
    
    if (quickNavParams && quickNavParams.mapId) {
      // Check if it's a new navigation request (avoid duplicate processing)
      if (!this.lastQuickNavTimestamp || quickNavParams.timestamp > this.lastQuickNavTimestamp) {
        this.lastQuickNavTimestamp = quickNavParams.timestamp
        
        console.log('🚀 Processing quick navigation request:', quickNavParams)
        
        // Load specified map
        this.loadMap(quickNavParams.mapId, quickNavParams.mapName)
        
        // Clear global parameters
        app.globalData.quickNavigationParams = null
      }
    }
  },

  // 🔧 Reset navigation state
  resetNavigationState: function() {
    console.log('🔄 Reset navigation state')
    
    // Stop current audio
    this.stopCurrentAudio()
    
    // Reset all navigation-related states
    this.setData({
      // Navigation status
      navigationActive: false,
      isNavigating: false,
      
      // Path and instructions
      currentPath: [],
      instructions: [],
      currentInstructionIndex: 0,
      
      // Position information
      currentPosition: { x: 0, y: 0 },
      targetPosition: { x: 0, y: 0 },
      targetRoom: null,
      
      // UI state
      loading: false,
      loadingText: 'Loading map data...',
      
      // Map display
      mapGrid: [],
      
      // 3D state
      currentFloor: 1,
      
      // Clear possible error states
      error: null
    })
    
  },

  onHide: function () {
    // Pause voice playback
    this.stopCurrentAudio()
  },

  onUnload: function () {
    // Stop navigation
    this.stopNavigation()
  },

  // Initialize navigation
  initNavigation: function(autoStart = false) {
    this.setData({ loading: true })

    // Load map data
    app.getMapDetail(this.data.mapId, (mapData) => {
      
      // 🔧 Use unified map processing method
      this._processMapData(mapData, {
        callback: () => {
          // Initialize map display
          this.initMapDisplay()
        }
      })

      // If target room is specified and needs to auto start
      if (this.data.targetRoom && autoStart) {
        this.startNavigationToRoom()
      }
    })
  },

  // 🔧 Get current effective map dimensions (considering 3D floors)
  getCurrentMapDimensions: function() {
    const { mapData, isReal3DMap, currentFloor } = this.data
    
    if (!mapData) return { width: 0, height: 0 }
    
    // 3D map: use current floor dimensions
    if (isReal3DMap && mapData.floors && mapData.floors[currentFloor]) {
      const floorData = mapData.floors[currentFloor]
      return {
        width: floorData.width || mapData.width,
        height: floorData.height_grid || mapData.height
      }
    }
    
    // 2D map: use main map dimensions
    return {
      width: mapData.width,
      height: mapData.height
    }
  },

  // Initialize map display
  initMapDisplay: function() {
    
    const { mapData } = this.data
    if (!mapData) {
      console.error('❌ mapData is empty, cannot initialize map display')
      return
    }

    // 🔧 Get current effective map dimensions (considering 3D floors)
    const dimensions = this.getCurrentMapDimensions()
    const totalCells = dimensions.width * dimensions.height
    
    
    if (totalCells <= 0) {
      console.error('❌ Map dimensions invalid:', dimensions)
      return
    }

    // 🔧 Large map performance optimization: batch rendering
    if (totalCells > 1000) {
      this.initMapDisplayBatched(dimensions)
      return
    }

    // Small map: direct rendering
    this.initMapDisplayDirect(dimensions)
  },

  // 🔧 Small map direct rendering
  initMapDisplayDirect: function(dimensions) {
    const mapGrid = this.createMapGrid(dimensions)
    const calculatedCellSize = this.calculateCellSize(dimensions)
    
    this.setData({ 
      mapGrid,
      cellSize: calculatedCellSize,
      mapGridColumns: dimensions.width,
      mapGridRows: dimensions.height
    })
  },

  // 🔧 Large map batch rendering
  initMapDisplayBatched: function(dimensions) {
    const batchSize = 200 // Process 200 cells per batch
    const totalCells = dimensions.width * dimensions.height
    let processedCells = 0
    const mapGrid = []
    
    // Update loading status
    this.setData({ 
      loading: true,
      loadingText: 'Rendering large map...'
    })

    const processBatch = () => {
      const startTime = Date.now()
      let currentBatchSize = 0
      
      // Process a batch of cells
      while (processedCells < totalCells && currentBatchSize < batchSize) {
        const x = processedCells % dimensions.width
        const y = Math.floor(processedCells / dimensions.width)
        
        const cellType = this.getCellType(x, y)
        const cellData = {
          x: x,
          y: y,
          type: cellType,
          class: this.getCellClass(cellType, x, y),
          label: this.getCellLabel(x, y, cellType)
        }
        
        // 🏗️ 3D map flat display mode: use same styles as 2D
        // No need to add 3D transform properties
        
        mapGrid.push(cellData)
        processedCells++
        currentBatchSize++
      }
      
      const processingTime = Date.now() - startTime
      
      // Update progress
      const progress = Math.round((processedCells / totalCells) * 100)
      this.setData({ 
        loadingText: `Rendering map... ${progress}%`
      })
      
      // If there are unprocessed cells, continue with next batch
      if (processedCells < totalCells) {
        setTimeout(processBatch, 10) // Give UI thread time
      } else {
        // Rendering complete
        const calculatedCellSize = this.calculateCellSize(dimensions)
        
        this.setData({ 
          mapGrid,
          cellSize: calculatedCellSize,
          mapGridColumns: dimensions.width,
          mapGridRows: dimensions.height,
          loading: false,
          loadingText: 'Loading map data...'
        })
        
      }
    }
    
    // Start batch processing
    setTimeout(processBatch, 50)
  },

  // 🔧 Create map grid (for small maps)
  createMapGrid: function(dimensions) {
    
    const mapGrid = []
    let errorCount = 0
    
    for (let y = 0; y < dimensions.height; y++) {
      for (let x = 0; x < dimensions.width; x++) {
        try {
          const cellType = this.getCellType(x, y)
          const cellData = {
            x: x,
            y: y,
            type: cellType,
            class: this.getCellClass(cellType, x, y),
            label: this.getCellLabel(x, y, cellType)
          }
          
          
          mapGrid.push(cellData)
        } catch (error) {
          errorCount++
          if (errorCount <= 5) { // Only log first 5 errors
            console.error(`❌ Failed to create cell (${x},${y}):`, error)
          }
        }
      }
    }
    
    
    return mapGrid
  },

  // 🔧 Calculate cell size
  calculateCellSize: function(dimensions) {
    if (dimensions.width <= 20) {
      // Small map: use larger cells
      return Math.max(30, Math.min(50, Math.floor(750 / dimensions.width)))
    } else if (dimensions.width <= 30) {
      // Medium map: balanced size
      return Math.max(20, Math.min(35, Math.floor(750 / dimensions.width)))
    } else {
      // Large map (like 50x50): use smaller cells to ensure more content can be displayed
      return Math.max(12, Math.min(25, Math.floor(750 / dimensions.width)))
    }
  },

  // Get cell type
  getCellType: function(x, y) {
    const { mapData, currentPosition, currentPath, targetPosition, isReal3DMap, currentFloor } = this.data
    
    // Current position
    if (currentPosition && x === currentPosition.x && y === currentPosition.y) {
      return 'current'
    }
    
    // Target position
    if (targetPosition && x === targetPosition.x && y === targetPosition.y) {
      return 'target'
    }
    
    // Path check (need to consider 3D situation)
    if (currentPath && currentPath.length > 0) {
      if (isReal3DMap) {
        // 3D path: only show path points on current floor
        const pathOnCurrentFloor = currentPath.some(pos => 
          pos.x === x && pos.y === y && 
          (pos.floor === currentFloor || pos.floor === undefined)
        )
        if (pathOnCurrentFloor) {
          return 'path'
        }
        
        // Check if it's a floor connection point
        const isConnection = currentPath.some(pos => 
          pos.x === x && pos.y === y && 
          pos.action && (pos.action.includes('stair') || pos.action.includes('elevator'))
        )
        if (isConnection) {
          return 'connection' // New connection point type
        }
      } else {
        // 2D path
        if (currentPath.some(pos => pos.x === x && pos.y === y)) {
          return 'path'
        }
      }
    }
    
    // Entrance position check
    if (isReal3DMap) {
      // 3D map: check main entrance and current floor entrance
      const mainEntrance = mapData.entrance
      const floorEntrance = mapData.floors && mapData.floors[currentFloor] ? mapData.floors[currentFloor].entrance : null
      
      if ((mainEntrance && x === mainEntrance.x && y === mainEntrance.y) ||
          (floorEntrance && x === floorEntrance.x && y === floorEntrance.y)) {
        return 2 // Entrance
      }
    } else {
      // 2D map: check main entrance
      if (mapData.entrance && x === mapData.entrance.x && y === mapData.entrance.y) {
        return 2 // Entrance
      }
    }
    
    // Room position check
    if (isReal3DMap) {
      // 3D map: check rooms on current floor
      if (mapData.floors && mapData.floors[currentFloor] && mapData.floors[currentFloor].rooms) {
        const room = mapData.floors[currentFloor].rooms.find(room => room.x === x && room.y === y)
        if (room) {
          return 3 // Room
        }
      }
    } else {
      // 2D map: check main room list
      if (mapData.rooms) {
        const room = mapData.rooms.find(room => room.x === x && room.y === y)
        if (room) {
          return 3 // Room
        }
      }
    }
    
    // 🔧 Base type (from grid data) - fix 3D map and large map display issues
    let gridData = null
    
    if (isReal3DMap) {
      // 3D map: get grid data from current floor
      if (mapData.floors && mapData.floors[currentFloor] && mapData.floors[currentFloor].grid) {
        gridData = mapData.floors[currentFloor].grid
      } else {
        console.error(`❌ 3D map floor ${currentFloor} data missing:`, {
          hasFloors: !!mapData.floors,
          availableFloors: mapData.floors ? Object.keys(mapData.floors) : 'none',
          hasCurrentFloor: mapData.floors ? !!mapData.floors[currentFloor] : false,
          hasGrid: mapData.floors && mapData.floors[currentFloor] ? !!mapData.floors[currentFloor].grid : false
        })
      }
    } else {
      // 2D map: directly use mapData.grid
      gridData = mapData.grid
      if (gridData) {
        console.log(`🎯 2D map data source: main grid, size: ${gridData.length}x${gridData[0] ? gridData[0].length : 0}`)
      }
    }
    
    // 🔧 Safe access to grid data
    if (gridData && Array.isArray(gridData) && 
        y >= 0 && y < gridData.length && 
        x >= 0 && gridData[y] && x < gridData[y].length && 
        gridData[y][x] !== undefined) {
      const cellValue = gridData[y][x]
      
      // Data retrieval successful, return cell value
      
      return cellValue
    }
    
    // 🚨 Debug: record data missing situation
    if (x < 5 && y < 5) { // Only log first few cells to avoid too many logs
      console.error('🚨 Data missing:', {
        position: `(${x},${y})`,
        isReal3DMap,
        currentFloor,
        hasFloors: mapData.floors ? Object.keys(mapData.floors) : 'none',
        hasGrid: mapData.grid ? 'yes' : 'no',
        gridDataType: typeof gridData,
        gridDataSize: gridData ? `${gridData.length}x${gridData[0] ? gridData[0].length : 0}` : 'null'
      })
    }
    
    // Default to empty space
    return 0
  },

  // 🔧 Get cell type name (for debugging)
  getCellTypeName: function(cellType) {
    const typeNames = {
      0: 'Empty',
      1: 'Obstacle',
      2: 'Entrance', 
      3: 'Room',
      4: 'Stair',
      'current': 'Current position',
      'target': 'Target position',
      'path': 'Path',
      'connection': 'Connection'
    }
    return typeNames[cellType] || `Unknown(${cellType})`
  },

  // Get cell CSS class
  getCellClass: function(cellType, x, y) {
    const baseClass = 'map-cell'
    
    switch (cellType) {
      case 0: return `${baseClass} cell-empty`
      case 1: return `${baseClass} cell-obstacle`
      case 2: return `${baseClass} cell-entrance`
      case 3: return `${baseClass} cell-room`
      case 4: return `${baseClass} cell-connection` // 🔧 Stair/Elevator
      case 'current': return `${baseClass} cell-current`
      case 'target': return `${baseClass} cell-target`
      case 'path': return `${baseClass} cell-path`
      case 'connection': return `${baseClass} cell-connection` // 🔧 Connection point
      default: return `${baseClass} cell-empty`
    }
  },

  // Get cell label
  getCellLabel: function(x, y, cellType) {
    const { mapData, isReal3DMap, currentFloor } = this.data
    
    // Entrance label
    if (cellType === 2) {
      return 'Entrance'
    }
    
    // Room label - 🔧 Support 3D map
    if (cellType === 3) {
      let room = null
      
      if (isReal3DMap) {
        // 3D map: find room from current floor
        if (mapData.floors && mapData.floors[currentFloor] && mapData.floors[currentFloor].rooms) {
          room = mapData.floors[currentFloor].rooms.find(room => room.x === x && room.y === y)
        }
      } else {
        // 2D map: find from main room list
        if (mapData.rooms) {
          room = mapData.rooms.find(room => room.x === x && room.y === y)
        }
      }
      
      if (room) {
        return room.name || room.id || 'Room'
      }
    }
    
    // Current position label
    if (cellType === 'current') {
      return 'Current'
    }
    
    // Target position label
    if (cellType === 'target') {
      return 'Target'
    }
    
    // 🔧 Connection point label (stair/elevator)
    if (cellType === 'connection' || cellType === 4) {
      // Check if it's a vertical connection point
      if (mapData.vertical_connections) {
        const connection = mapData.vertical_connections.find(vc => 
          (vc.start_pos.x === x && vc.start_pos.y === y) ||
          (vc.end_pos && vc.end_pos.x === x && vc.end_pos.y === y)
        )
        if (connection) {
          return connection.type === 'stair' ? 'Stair' : 'Elevator'
        }
      }
      return 'Connection'
    }
    
    return ''
  },

  // Click map cell
  onCellTap: function(e) {
    const { x, y, type } = e.currentTarget.dataset
    const intX = parseInt(x)
    const intY = parseInt(y)
    
    
    // 🔧 First check if clicked on a room
    const cellType = this.getCellType(intX, intY)
    
    if (cellType === 3 || type === 'room') {
      // Clicked on a room, find room info and select
      this.handleRoomClick(intX, intY)
    } else if (!this.data.mapData.grid || !this.data.mapData.grid[intY] || !this.data.mapData.grid[intY][intX]) {
      // Clicked on walkable area, navigate to that position
      this.startNavigationTo(intX, intY)
    } else {
      wx.showToast({
        title: 'This location is unreachable',
        icon: 'none'
      })
    }
  },

  // 🔧 Handle room click
  handleRoomClick: function(x, y) {
    const { mapData, isReal3DMap, currentFloor } = this.data
    let foundRoom = null
    
    if (isReal3DMap) {
      // 3D map: find room from current floor
      if (mapData.floors && mapData.floors[currentFloor] && mapData.floors[currentFloor].rooms) {
        foundRoom = mapData.floors[currentFloor].rooms.find(room => room.x === x && room.y === y)
        if (foundRoom) {
          foundRoom.floor = currentFloor
          foundRoom.floorName = mapData.floors[currentFloor].name || `Floor ${currentFloor}`
        }
      }
    } else {
      // 2D map: find from main room list
      if (mapData.rooms) {
        foundRoom = mapData.rooms.find(room => room.x === x && room.y === y)
        if (foundRoom) {
          foundRoom.floor = 1
          foundRoom.floorName = 'Floor 1'
        }
      }
    }
    
    if (foundRoom) {
      
      // Set target room and start navigation
      this.setData({
        targetRoom: {
          id: foundRoom.id,
          name: foundRoom.name,
          x: foundRoom.x,
          y: foundRoom.y,
          floor: foundRoom.floor,
          floorName: foundRoom.floorName
        }
      })
      
      wx.showToast({
        title: `Selected ${foundRoom.name}`,
        icon: 'success'
      })
      
      // 🔧 Delay navigation start to ensure UI update completion
      setTimeout(() => {
        this.startNavigationToRoom()
      }, isReal3DMap ? 800 : 500)
      
    } else {
      wx.showToast({
        title: 'Room information incomplete',
        icon: 'none'
      })
    }
  },

  // Click room
  onRoomTap: function(e) {
    const { roomId, roomName, roomFloor } = e.currentTarget.dataset
    
    // Find complete room information from allRooms
    const selectedRoom = this.data.allRooms.find(room => room.id === roomId)
    
    if (!selectedRoom) {
      console.error('❌ Room information not found:', { roomId, roomName, roomFloor })
      wx.showToast({
        title: 'Room information error',
        icon: 'none'
      })
      return
    }

    console.log('🎯 Click room:', selectedRoom)
    
    // Check if it's the second click on the same room
    if (this.data.targetRoom && this.data.targetRoom.id === selectedRoom.id) {
      // Second click: directly start navigation
      console.log('🚀 Second click, start navigation')
      this.startNavigationToRoom()
    } else {
      // First click: announce room name and set as target room
      console.log('🔊 First click, announce room name')
      this.selectRoomFirstTime(selectedRoom)
    }
  },

  // First time selecting room (announce room name)
  selectRoomFirstTime: function(selectedRoom) {
    console.log('🔊 First time selecting room, announce name:', selectedRoom.name)
    
    // Set as target room
    const targetRoom = {
      id: selectedRoom.id,
      name: selectedRoom.name,
      x: selectedRoom.x,
      y: selectedRoom.y
    }
    
    // 🔧 3D map needs to add floor information
    if (this.data.isReal3DMap && selectedRoom.floor !== undefined) {
      targetRoom.floor = selectedRoom.floor
    }
    
    this.setData({
      targetRoom: targetRoom,
      targetPosition: {
        x: selectedRoom.x,
        y: selectedRoom.y
      }
    })
    
    // Only update target marker on map, don't re-render entire map
    this.updateTargetMarker()
    
    // 🔊 Announce room name (English)
    announceRoomSelection(selectedRoom.name, `Room ${selectedRoom.name}`)
    
    // Show prompt
    wx.showToast({
      title: `Selected ${selectedRoom.name}, click again to start navigation`,
      icon: 'none',
      duration: 2000
    })
  },

  // Start navigation to selected room (second click)
  startNavigationToRoom: function() {
    if (!this.data.targetRoom) {
      console.error('❌ No selected target room')
      return
    }
    
    console.log('🚀 Start navigation to room:', this.data.targetRoom.name)
    
    // Second click: re-render map and start navigation
    this.initMapDisplay()
    
    wx.showToast({
      title: `Start navigation to ${this.data.targetRoom.name}`,
      icon: 'success'
    })
    
    // 🔧 Auto start navigation (3D map needs longer delay to ensure floor data loading completion)
    const delay = this.data.isReal3DMap ? 800 : 500
    setTimeout(() => {
      this.startActualNavigation()
    }, delay)
  },

  // Actually start navigation calculation
  startActualNavigation: function() {
    const { mapId, targetRoom, isReal3DMap, currentFloor } = this.data
    
    this.setData({ loading: true })

    console.log('📋 Navigation parameter details:', {
      mapId,
      targetRoom,
      isReal3DMap,
      currentFloor,
      mapData: !!this.data.mapData
    })
    
    // 🔧 Pass correct 3D parameters  
    app.calculatePathToRoom(mapId, targetRoom.id, (pathData) => {
      console.log('🛣️ API callback received path data:', pathData)
      console.log('📊 Path data type and content:', {
        type: typeof pathData,
        isNull: pathData === null,
        isUndefined: pathData === undefined,
        hasPath: !!(pathData && pathData.path),
        hasInstructions: !!(pathData && pathData.instructions)
      })
      
      if (pathData && pathData.target_room) {
        this.setData({
          targetPosition: {
            x: pathData.target_room.x,
            y: pathData.target_room.y
          }
        })
      }
      this.handlePathResult(pathData)
    }, isReal3DMap, currentFloor)
  },

  // Start navigation to specified position
  startNavigationTo: function(targetX, targetY) {
    this.setData({
      targetPosition: { x: targetX, y: targetY },
      loading: true
    })

    const { mapId, currentPosition, isReal3DMap, currentFloor } = this.data

    // Select API based on map type
    const pathOptions = {
      map_id: mapId,
      start: currentPosition,
      end: { x: targetX, y: targetY },
      is_3d: isReal3DMap
    }
    
    // If it's a 3D map, add floor information
    if (isReal3DMap) {
      pathOptions.start.floor = currentFloor
      pathOptions.end.floor = currentFloor // Default same-floor navigation
    }

    console.log('Start navigation calculation, parameters:', pathOptions)

    app.calculatePath(pathOptions, (pathData) => {
      this.handlePathResult(pathData)
    })
  },

  // Update target marker (don't re-render entire map)
  updateTargetMarker: function() {
    const { targetRoom, mapGrid } = this.data
    if (!targetRoom || !mapGrid || mapGrid.length === 0) {
      return
    }

    // Find target room position in map grid and update marker
    const dimensions = this.getCurrentMapDimensions()
    if (targetRoom.x >= 0 && targetRoom.x < dimensions.width && 
        targetRoom.y >= 0 && targetRoom.y < dimensions.height) {
      
      // Create updated map grid copy
      const updatedMapGrid = [...mapGrid]
      const index = targetRoom.y * dimensions.width + targetRoom.x
      
      if (index >= 0 && index < updatedMapGrid.length) {
        // Update Target position marker
        updatedMapGrid[index] = {
          ...updatedMapGrid[index],
          isTarget: true
        }
        
        // Only update map grid data, don't trigger complete re-render
        this.setData({
          mapGrid: updatedMapGrid
        })
      }
    }
  },

  // Handle path calculation results
  handlePathResult: function(pathData) {
    console.log('🛣️ Handle path results:', pathData)
    
    if (!pathData) {
      console.error('❌ Path data is empty')
      this.setData({ loading: false })
      wx.showToast({
        title: 'Path calculation failed',
        icon: 'none'
      })
      return
    }
    
    // Detailed analysis of path data
    console.log('📊 Path analysis:', {
      pathLength: pathData.path ? pathData.path.length : 0,
      instructionsCount: pathData.instructions ? pathData.instructions.length : 0,
      hasStairs: pathData.instructions ? pathData.instructions.some(inst => inst.includes('stair')) : false,
      api_used: pathData.api_endpoint || 'unknown',
      path_type: pathData.is_3d ? '3D path' : '2D path'
    });

    const instructions = pathData.instructions || []
    const path = pathData.path || []

    this.setData({
      currentPath: path,
      instructions: instructions,
      currentInstructionIndex: 0,
      navigationActive: true,
      isNavigating: false,
      loading: false
    })

    // Update map display
    this.updateMapDisplay()

    // Start voice navigation
    if (this.data.autoPlayVoice && instructions.length > 0) {
      this.startVoiceNavigation()
    }

    wx.showToast({
      title: `Navigation started, ${instructions.length} steps total`,
      icon: 'success'
    })
  },

  // Update map display
  updateMapDisplay: function() {
    const { mapData, isReal3DMap, currentFloor } = this.data
    if (!mapData) return

    // 🔧 Get current effective map dimensions (considering 3D floors)
    const dimensions = this.getCurrentMapDimensions()
    const totalCells = dimensions.width * dimensions.height

    // 🔧 Large map performance optimization: use same batch rendering logic
    if (totalCells > 1000) {
      this.updateMapDisplayBatched(dimensions)
      return
    }

    // Small map: direct update
    this.updateMapDisplayDirect(dimensions)
  },

  // 🔧 Small map direct update
  updateMapDisplayDirect: function(dimensions) {
    const mapGrid = this.createMapGrid(dimensions)
    const calculatedCellSize = this.calculateCellSize(dimensions)
    
    this.setData({ 
      mapGrid,
      cellSize: calculatedCellSize,
      mapGridColumns: dimensions.width,
      mapGridRows: dimensions.height
    })
  },

  // 🔧 Large map batch update
  updateMapDisplayBatched: function(dimensions) {
    const batchSize = 300 // Can be slightly faster when updating
    const totalCells = dimensions.width * dimensions.height
    let processedCells = 0
    const mapGrid = []
    
    // Show update status (don't block current interface)
    const processBatch = () => {
      const startTime = Date.now()
      let currentBatchSize = 0
      
      // Process a batch of cells
      while (processedCells < totalCells && currentBatchSize < batchSize) {
        const x = processedCells % dimensions.width
        const y = Math.floor(processedCells / dimensions.width)
        
        const cellType = this.getCellType(x, y)
        const cellData = {
          x: x,
          y: y,
          type: cellType,
          class: this.getCellClass(cellType, x, y),
          label: this.getCellLabel(x, y, cellType)
        }
        
        // 🏗️ 3D map flat display mode: use same styles as 2D
        // No need to add 3D transform properties
        
        mapGrid.push(cellData)
        processedCells++
        currentBatchSize++
      }
      
      const processingTime = Date.now() - startTime
      
      // If there are unprocessed cells, continue with next batch
      if (processedCells < totalCells) {
        setTimeout(processBatch, 5) // Shorter interval when updating
      } else {
        // Update complete
        const calculatedCellSize = this.calculateCellSize(dimensions)
        
        this.setData({ 
          mapGrid,
          cellSize: calculatedCellSize,
          mapGridColumns: dimensions.width,
          mapGridRows: dimensions.height
        })
        
      }
    }
    
    // Start batch processing
    setTimeout(processBatch, 10)
  },

  // Start voice navigation - Pure local templates (NO NETWORK!)
  startVoiceNavigation: function() {
    if (!this.data.voiceEnabled || this.data.instructions.length === 0) {
      console.log('Voice disabled or no instructions')
      return
    }

    console.log('🔊 Start LOCAL voice navigation, instruction count:', this.data.instructions.length)
    
    const localVoice = getLocalVoiceService()
    
    // Use pure local templates - instant, no network!
    localVoice.playBatchNavigation(this.data.instructions, (success) => {
      if (success) {
        console.log('✅ Local navigation voice completed')
      } else {
        console.warn('⚠️ Some voice playback had issues')
      }
    })
  },

  // Play instruction
  playInstruction: function(index, audioFiles) {
    if (index >= audioFiles.length || !this.data.voiceEnabled) {
      return
    }

    const audioFile = audioFiles[index]
    if (audioFile && audioFile.download_url) {
      const audio = app.playVoice(audioFile.download_url, () => {
        // Playback completed, prepare to play next
        setTimeout(() => {
          this.playInstruction(index + 1, audioFiles)
        }, 1000) // 1 second interval
      })

      this.setData({
        currentAudio: audio,
        currentInstructionIndex: index
      })
    }
  },

  // Stop current audio
  stopCurrentAudio: function() {
    if (this.data.currentAudio) {
      try {
        this.data.currentAudio.stop()
        this.data.currentAudio.destroy()
        console.log('Audio stopped and destroyed')
      } catch (error) {
        console.error('Stop audio failed:', error)
      }
      this.setData({ currentAudio: null })
    }
  },

  // Next instruction
  onNextInstruction: function() {
    const { currentInstructionIndex, instructions } = this.data
    if (currentInstructionIndex < instructions.length - 1) {
      this.setData({
        currentInstructionIndex: currentInstructionIndex + 1
      })
    }
  },

  // Previous instruction
  onPrevInstruction: function() {
    const { currentInstructionIndex } = this.data
    if (currentInstructionIndex > 0) {
      this.setData({
        currentInstructionIndex: currentInstructionIndex - 1
      })
    }
  },

  // Replay current instruction (using local templates)
  onReplayInstruction: function() {
    const { currentInstructionIndex, instructions } = this.data
    
    if (instructions.length === 0) {
      wx.showToast({
        title: 'No instructions to play',
        icon: 'none'
      })
      return
    }

    const instruction = instructions[currentInstructionIndex]
    if (instruction) {
      // Use local voice service to replay single instruction
      const { getLocalVoiceService } = require('../../utils/localVoiceService.js')
      const localVoice = getLocalVoiceService()
      
      // Play single instruction using batch navigation (with one item)
      localVoice.playBatchNavigation([instruction], (success) => {
        if (!success) {
          wx.showToast({
            title: 'Replay failed',
            icon: 'none'
          })
        }
      })
    }
  },


  // Stop navigation
  stopNavigation: function() {
    this.stopCurrentAudio()
    
    this.setData({
      navigationActive: false,
      isNavigating: false,
      currentPath: [],
      instructions: [],
      currentInstructionIndex: 0,
      targetPosition: { x: 0, y: 0 },
      targetRoom: null
    })

    // Update map display
    this.updateMapDisplay()

    app.stopNavigation()

    wx.showToast({
      title: 'Navigation stopped',
      icon: 'success'
    })
  },

  // Restart navigation
  onRestartNavigation: function() {
    if (this.data.targetRoom) {
      this.startNavigationToRoom()
    } else if (this.data.targetPosition.x !== 0 || this.data.targetPosition.y !== 0) {
      this.startNavigationTo(this.data.targetPosition.x, this.data.targetPosition.y)
    } else {
      wx.showToast({
        title: 'Please reselect target',
        icon: 'none'
      })
    }
  },

  // Toggle instruction display
  onToggleInstructions: function() {
    this.setData({
      showInstructions: !this.data.showInstructions
    })
  },

  // View mode switching
  // Note: removed manual 2D/3D mode switching functionality
  // Now completely automatically decide display mode based on map type


  // Floor switching
  // 🔧 Floor switching (compatible with original functionality)
  onFloorChange: function(e) {
    let floor
    
    // Compatible with different event sources
    if (e.detail && e.detail.floor !== undefined) {
      // From original map-3d component
      floor = e.detail.floor
    } else if (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.floor !== undefined) {
      // From button click
      floor = parseInt(e.currentTarget.dataset.floor)
    } else {
      console.error('Invalid floor switching event:', e)
      return
    }
    
    this.setData({ currentFloor: floor })
    
    // Re-render map to display current floor
    this.initMapDisplay()
  },

  // 🔧 3D cell click (compatible with original functionality)
  on3DCellTap: function(e) {
    const { x, y, type, label } = e.currentTarget.dataset
    
    // 3D map cell click handling
    
    // Construct object format compatible with original component
    let objectData = {
      x: parseInt(x),
      y: parseInt(y),
      floor: this.data.currentFloor,
      type: type,
      name: label || `Position(${x},${y})`
    }
    
    // If it's a room, find detailed room information
    if (type === 3 || type === 'room') {
      const room = this.data.mapData.rooms?.find(room => 
        room.x === parseInt(x) && room.y === parseInt(y)
      )
      if (room) {
        objectData = {
          ...objectData,
          type: 'room',
          name: room.name || room.id || `Room(${x},${y})`,
          data: room
        }
        
        // Can trigger navigation to this room
        this.navigateToRoom(room.id || room.name)
      }
    }
    
    // Trigger original object selection event
    this.onObjectSelect({
      detail: {
        object: objectData
      }
    })
  },

  // Object selection
  onObjectSelect: function(e) {
    const object = e.detail.object
    
    if (object.type === 'room') {
      // Show room information or trigger navigation
      wx.showModal({
        title: 'Room Information',
        content: `Name: ${object.name}\nPosition: (${object.x}, ${object.y})\nFloor: ${object.floor}`,
        confirmText: 'Navigate',
        cancelText: 'Cancel',
        success: (res) => {
          if (res.confirm && object.data) {
            this.navigateToRoom(object.data.id || object.data.name)
          }
        }
      })
    }
  },

  // 🔧 Navigate to room
  navigateToRoom: function(roomId) {
    const targetRoom = this.data.mapData.rooms?.find(room => 
      room.id === roomId || room.name === roomId
    )
    
    if (targetRoom) {
      this.setData({
        targetRoom: {
          id: targetRoom.id,
          name: targetRoom.name
        }
      })
      this.startNavigationToRoom()
    } else {
      console.error('Target room not found:', roomId)
    }
  },

  // Map zoom
  // Touch event handling
  onTouchStart: function(e) {
    if (e.touches.length === 2) {
      // Two-finger touch start, prepare to zoom
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      this.setData({
        touchStartDistance: distance,
        touchStartScale: this.data.mapScale,
        isTouching: true,
        touchMode: 'zoom'
      })
    } else if (e.touches.length === 1) {
      // Single finger touch, allow scrolling
      this.setData({
        touchMode: 'scroll'
      })
    }
  },

  onTouchMove: function(e) {
    if (e.touches.length === 2 && this.data.touchMode === 'zoom' && this.data.isTouching) {
      // Two-finger zoom
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      
      const scale = (distance / this.data.touchStartDistance) * this.data.touchStartScale
      const newScale = Math.max(0.5, Math.min(3.0, scale))
      
      this.setData({
        mapScale: newScale,
        mapScaleDisplay: Math.round(newScale * 100)
      })
    }
    // For single finger sliding, don't prevent, let scroll-view handle naturally
  },

  onTouchEnd: function(e) {
    this.setData({
      isTouching: false,
      touchMode: 'none',
      touchStartDistance: 0,
      touchStartScale: 1.0
    })
  },

  // 🔧 2D map zoom button control
  zoomIn: function() {
    const newScale = Math.min(3.0, this.data.mapScale * 1.2)
    this.setData({
      mapScale: newScale,
      mapScaleDisplay: Math.round(newScale * 100)
    })
  },

  zoomOut: function() {
    const newScale = Math.max(0.5, this.data.mapScale / 1.2)
    this.setData({
      mapScale: newScale,
      mapScaleDisplay: Math.round(newScale * 100)
    })
  },

  // Remove onMapTouchMove, handle directly in onTouchMove

  // Mouse wheel zoom (H5 environment)
  onMouseWheel: function(e) {
    const delta = e.detail.delta || e.detail.wheelDelta || e.detail.deltaY
    let newScale = this.data.mapScale
    
    if (delta > 0) {
      newScale = Math.max(this.data.mapScale - 0.1, 0.5)
    } else {
      newScale = Math.min(this.data.mapScale + 0.1, 3.0)
    }
    
    this.setData({
      mapScale: newScale,
      mapScaleDisplay: Math.round(newScale * 100)
    })
  }

})

