// 3D Map Component Logic
// Simplified 3D rendering engine, implemented directly in the component

Component({
  properties: {
    mapData: {
      type: Object,
      value: null,
      observer: 'onMapDataChange'
    },
    currentFloor: {
      type: Number,
      value: 1
    },
    pathData: {
      type: Array,
      value: []
    }
  },

  data: {
    canvasWidth: 600,
    canvasHeight: 400,
    floors: [],
    loading: true,
    selectedObject: null,
    showConnections: true,
    showLabels: true,
    showPath: true,
    
    // Simplified 3D rendering state
    canvasContext: null,
    
    // Interaction state
    isRotating: false,
    lastTouchX: 0,
    lastTouchY: 0,
    cameraAngle: 3, // Initial angle offset to make 3D effect more obvious
    cameraHeight: 15, // Initial height boost to enhance stereoscopic effect
    cameraDistance: 20,
    showHint: true, // Show interaction hints
    
    // Auto-rotation state
    isAutoRotating: false,
    autoRotationTimer: null,
    
    // Panel state
    panelCollapsed: true, // Collapse control panel by default to reduce obstruction
    
    // Render data
    renderObjects: []
  },

  lifetimes: {
    attached() {
      this.init3DScene();
    },

    detached() {
      this.cleanup3D();
    }
  },

  methods: {
    /**
     * Initialize 3D Scene
     */
    init3DScene() {
      console.log('Initializing 3D scene');
      
      // Get canvas element
      const query = this.createSelectorQuery();
      query.select('#map3d-canvas').boundingClientRect((rect) => {
        if (!rect) return;
        
        this.setData({
          canvasWidth: rect.width,
          canvasHeight: rect.height
        });
        
        // Initialize Three.js scene
        this.initThreeJS();
      }).exec();
    },

    /**
     * Initialize simplified 3D rendering
     */
    initThreeJS() {
      try {
        // Get canvas element and dimensions
        const query = this.createSelectorQuery();
        query.select('#map3d-canvas').boundingClientRect().exec((res) => {
          if (!res || !res[0]) {
            console.error('Unable to get canvas information');
            return;
          }
          
          const rect = res[0];
          console.log('Canvas dimension info:', rect);
          
          // Set canvas dimension data
          this.setData({
            canvasWidth: rect.width,
            canvasHeight: rect.height
          });
          
          // Get canvas node
          const nodeQuery = this.createSelectorQuery();
          nodeQuery.select('#map3d-canvas').node((nodeRes) => {
            if (!nodeRes || !nodeRes.node) {
              console.error('Unable to get canvas node');
              return;
            }
            
            const canvas = nodeRes.node;
            const ctx = canvas.getContext('2d');
            
            // Set high-resolution canvas
            const dpr = wx.getWindowInfo().pixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            
            console.log('Canvas actual size:', canvas.width, 'x', canvas.height);
            console.log('Logical size:', rect.width, 'x', rect.height);
            
            // Save canvas context
            this.setData({
              canvasContext: ctx,
              loading: false
            });
            
            // Initial rendering
            this.renderInitialScene();
            
            console.log('3D Canvas initialization complete');
          }).exec();
        });
        
      } catch (error) {
        console.error('3D scene initialization failed:', error);
        this.setData({ loading: false });
      }
    },

    /**
     * Initial scene rendering
     */
    renderInitialScene() {
      // Render background
      const ctx = this.data.canvasContext;
      if (!ctx) return;
      
      // Clear canvas and draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, this.data.canvasHeight);
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(1, '#F0F8FF');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
      
      // Draw hint text
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Loading 3D map...', this.data.canvasWidth / 2, this.data.canvasHeight / 2);
      
      // If there is map data, start building 3D scene
      if (this.data.mapData) {
        console.log('Map data available, starting to build 3D scene');
        this.buildMap3D();
      } else {
        console.log('No map data, creating demo scene');
        this.createDemoScene();
      }
    },

    /**
     * Create demo scene (when there is no real data)
     */
    createDemoScene() {
      console.log('Creating 3D demo scene');
      
      // Create demo data
      const demoData = {
        name: 'Demo Map',
        width: 10,
        height: 8,
        entrance: { x: 1, y: 1 },
        rooms: [
          { id: 'A', name: 'Room A', x: 3, y: 2 },
          { id: 'B', name: 'Room B', x: 6, y: 2 },
          { id: 'C', name: 'Room C', x: 3, y: 5 },
          { id: 'D', name: 'Room D', x: 7, y: 6 }
        ],
        grid: [] // Empty grid, indicating all areas are passable
      };
      
      // Set demo data
      this.setData({ mapData: demoData });
      
      // Trigger data change handling
      this.onMapDataChange(demoData);
      
      // Build 3D scene
      this.buildMap3D();
    },

    /**
     * Map data change handling
     */
    onMapDataChange(newData, oldData) {
      if (!newData) return;
      
      console.log('3D map data update:', newData);
      
      // Check if this is real 3D map data
      if (!newData.floors && !newData.is_3d) {
        console.log('This is 2D map data, 3D component does not handle it');
        this.setData({ 
          floors: [],
          renderObjects: []
        });
        this.renderNoDataScene();
        return;
      }
      
      // Process floor information for 3D maps
      const floors = [];
      if (newData.floors) {
        for (const [floorId, floorData] of Object.entries(newData.floors)) {
          floors.push({
            id: parseInt(floorId),
            name: floorData.name,
            roomCount: floorData.rooms ? floorData.rooms.length : 0
          });
        }
      }
      
      this.setData({ 
        floors: floors.sort((a, b) => a.id - b.id)
      });
      
      // Rebuild 3D map (only for 3D data)
      if (this.data.canvasContext && newData.floors) {
        this.buildMap3D();
      }
    },

    /**
     * Render no-data scene
     */
    renderNoDataScene() {
      if (!this.data.canvasContext) return;
      
      const ctx = this.data.canvasContext;
      const centerX = this.data.canvasWidth / 2;
      const centerY = this.data.canvasHeight / 2;
      
      // Clear canvas
      ctx.clearRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
      
      // Set background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, this.data.canvasHeight);
      gradient.addColorStop(0, '#f5f5f5');
      gradient.addColorStop(1, '#e8e8e8');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
      
      // Show hint information
      ctx.fillStyle = '#999';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Current is 2D map', centerX, centerY - 20);
      ctx.fillText('Please select 3D map to view 3D effect', centerX, centerY + 10);
      
      // Add icon
      ctx.fillStyle = '#ccc';
      ctx.font = '32px Arial';
      ctx.fillText('🏢', centerX, centerY - 60);
    },

    /**
     * Build simplified 3D map
     */
    buildMap3D() {
      if (!this.data.canvasContext) {
        console.log('Canvas context does not exist');
        return;
      }
      
      if (!this.data.mapData) {
        console.log('Map data does not exist');
        return;
      }
      
      console.log('Building simplified 3D map, map data:', this.data.mapData);
      
      // Clear canvas
      this.clearCanvas();
      
      // Prepare render objects
      this.prepareRenderObjects();
      
      console.log('Number of render objects:', this.data.renderObjects.length);
      
      // Render scene
      this.renderScene();
    },

    /**
     * Clear canvas
     */
    clearCanvas() {
      if (this.data.canvasContext) {
        const ctx = this.data.canvasContext;
        ctx.clearRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
        
        // Draw background
        ctx.fillStyle = '#f0f8ff';
        ctx.fillRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
      }
    },

    /**
     * Prepare render objects
     */
    prepareRenderObjects() {
      const renderObjects = [];
      const mapData = this.data.mapData;
      
      if (!mapData) {
        console.log('3D map: No map data');
        this.setData({ renderObjects: [] });
        return;
      }
      
      // Get floor data (only process real 3D maps)
      const floors = mapData.floors || {};
      
      // If there is no floor data, it means it's not a 3D map
      if (Object.keys(floors).length === 0) {
        console.log('3D map: No floor data, cannot render');
        this.setData({ renderObjects: [] });
        return;
      }
      
      // Traverse floors
      Object.entries(floors).forEach(([floorId, floorData]) => {
        const floorNum = parseInt(floorId);
        const floorY = (floorNum - 1) * 60; // 60 pixels spacing between each floor
        
        // Add floor plane
        renderObjects.push({
          type: 'floor',
          floorId: floorNum,
          y: floorY,
          data: floorData,
          visible: true
        });
        
        // Add rooms on the floor
        if (floorData.rooms && floorData.rooms.length > 0) {
          floorData.rooms.forEach(room => {
            renderObjects.push({
              type: 'room',
              floorId: floorNum,
              y: floorY - 20,
              x: room.x || 0,
              z: room.y || 0,
              data: room,
              visible: true
            });
          });
        }
        
        // Add entrance markers
        if (mapData.entrance) {
          renderObjects.push({
            type: 'entrance',
            floorId: floorNum,
            y: floorY - 15,
            x: mapData.entrance.x || 0,
            z: mapData.entrance.y || 0,
            data: mapData.entrance,
            visible: true
          });
        }
      });
      
      // Add vertical connections
      if (this.data.showConnections && mapData.vertical_connections) {
        mapData.vertical_connections.forEach(conn => {
          renderObjects.push({
            type: 'connection',
            startFloor: conn.start_floor,
            endFloor: conn.end_floor,
            x: conn.start_pos.x,
            z: conn.start_pos.y,
            data: conn,
            visible: true
          });
        });
      }
      
      // Add path points
      if (this.data.showPath && this.data.pathData.length > 0) {
        this.data.pathData.forEach((point, index) => {
          if (point.length >= 3) {
            renderObjects.push({
              type: 'path',
              x: point[0],
              z: point[1], 
              floorId: point[2],
              y: (point[2] - 1) * 60 - 30,
              index: index,
              data: point,
              visible: true
            });
          }
        });
      }
      
      console.log('3D map: Preparing render objects', renderObjects.length, 'items');
      this.setData({ renderObjects });
    },

    // Three.js related methods have been removed, using Canvas 2D implementation

    /**
     * Render scene - Enhanced 3D
     */
    renderScene() {
      if (!this.data.canvasContext) {
        console.log('Render scene: Canvas context does not exist');
        return;
      }
      
      const ctx = this.data.canvasContext;
      const centerX = this.data.canvasWidth / 2;
      const centerY = this.data.canvasHeight / 2;
      
      console.log('Starting scene rendering, Canvas size:', this.data.canvasWidth, 'x', this.data.canvasHeight);
      console.log('Number of render objects:', this.data.renderObjects.length);
      
      // Clear canvas
      ctx.clearRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
      
      // Set background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, this.data.canvasHeight);
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(1, '#F0F8FF');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
      
      // If there are no render objects, show hint
      if (!this.data.renderObjects || this.data.renderObjects.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No 3D content to display', centerX, centerY);
        console.log('No render objects, showing hint');
        
        // Render UI information
        this.renderUI(ctx);
        return;
      }
      
      // Apply 3D transformations
      ctx.save();
      ctx.translate(centerX, centerY * 0.7); // Slightly offset upward
      
      // Enhanced isometric projection
      const cameraAngle = this.data.cameraAngle;
      const cameraHeight = this.data.cameraHeight;
      const scale = 0.6 + (cameraHeight - 5) * 0.04; // Adjust base scaling
      
      // Enhanced 3D perspective effect
      ctx.scale(scale, scale * 0.7); // Stronger Y-axis compression
      ctx.rotate(cameraAngle * 0.08); // Increase rotation sensitivity
      
      // Add pseudo-perspective transformation
      ctx.transform(1, 0, -0.3, 1, 0, 0); // Tilt transformation to enhance stereoscopic effect
      
      // Sort render objects by depth and floor
      const sortedObjects = [...this.data.renderObjects].sort((a, b) => {
        // Sort by floor first, then by depth
        const floorDiff = (a.floorId || 0) - (b.floorId || 0);
        if (floorDiff !== 0) return floorDiff;
        
        // Calculate 3D depth
        const depthA = (a.x || 0) + (a.z || 0) * 0.5 + (a.y || 0) * 0.1;
        const depthB = (b.x || 0) + (b.z || 0) * 0.5 + (b.y || 0) * 0.1;
        return depthB - depthA; // From far to near
      });
      
      console.log('Sorted render objects:', sortedObjects.length, 'items');
      
      // Layered rendering
      this.renderFloorFoundations(ctx, sortedObjects);
      this.renderWorldObjects(ctx, sortedObjects);
      
      ctx.restore();
      
      // Render UI information
      this.renderUI(ctx);
      
      console.log('Scene rendering complete');
    },

    /**
     * Render floor foundations
     */
    renderFloorFoundations(ctx, objects) {
      const floors = objects.filter(obj => obj.type === 'floor');
      
      floors.forEach(floor => {
        const floorY = (floor.floorId - 1) * 100; // Further increase floor spacing
        
        ctx.save();
        ctx.translate(0, -floorY);
        
        // Render floor base (heavy feel)
        this.renderFloorBase(ctx, floor);
        
        // Add transparency for non-current floors
        if (floor.floorId !== this.data.currentFloor) {
          ctx.globalAlpha = 0.4;
        }
        
        ctx.restore();
      });
    },

    /**
     * Render world objects
     */
    renderWorldObjects(ctx, objects) {
      const nonFloorObjects = objects.filter(obj => obj.type !== 'floor');
      
      nonFloorObjects.forEach(obj => {
        if (obj.visible) {
          this.renderObject(ctx, obj);
        }
      });
    },

    /**
     * Render floor base - Enhanced stereoscopic effect
     */
    renderFloorBase(ctx, floor) {
      const isCurrentFloor = floor.floorId === this.data.currentFloor;
      const width = 400;  // Increase size
      const height = 300; // Increase size
      const depth = 30;   // Increase thickness
      
      // 3D isometric projection parameters - Enhanced stereoscopic effect
      const isoX = 1.0;   // Increase X projection
      const isoY = 0.6;   // Increase Y projection
      
      ctx.save();
      
      // Floor top surface (main plane)
      ctx.fillStyle = isCurrentFloor ? 'rgba(100, 149, 237, 0.9)' : 'rgba(200, 200, 200, 0.7)';
      ctx.strokeStyle = isCurrentFloor ? '#4169E1' : '#888';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(-width/2, -height/2);
      ctx.lineTo(width/2, -height/2);
      ctx.lineTo(width/2 + depth * isoX, -height/2 - depth * isoY);
      ctx.lineTo(-width/2 + depth * isoX, -height/2 - depth * isoY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Floor side surface (right side)
      ctx.fillStyle = isCurrentFloor ? 'rgba(65, 105, 225, 0.8)' : 'rgba(150, 150, 150, 0.6)';
      ctx.beginPath();
      ctx.moveTo(width/2, -height/2);
      ctx.lineTo(width/2, height/2);
      ctx.lineTo(width/2 + depth * isoX, height/2 - depth * isoY);
      ctx.lineTo(width/2 + depth * isoX, -height/2 - depth * isoY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Floor side surface (bottom)
      ctx.fillStyle = isCurrentFloor ? 'rgba(72, 61, 139, 0.8)' : 'rgba(120, 120, 120, 0.6)';
      ctx.beginPath();
      ctx.moveTo(-width/2, height/2);
      ctx.lineTo(width/2, height/2);
      ctx.lineTo(width/2 + depth * isoX, height/2 - depth * isoY);
      ctx.lineTo(-width/2 + depth * isoX, height/2 - depth * isoY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Floor front surface
      ctx.fillStyle = isCurrentFloor ? 'rgba(173, 216, 230, 0.9)' : 'rgba(240, 240, 240, 0.8)';
      ctx.strokeStyle = isCurrentFloor ? '#4682b4' : '#ccc';
      ctx.fillRect(-width/2, -height/2, width, height);
      ctx.strokeRect(-width/2, -height/2, width, height);
      
      // Add grid lines (enhance 3D effect)
      if (isCurrentFloor) {
        ctx.strokeStyle = 'rgba(70, 130, 180, 0.3)';
        ctx.lineWidth = 1;
        
        // Vertical grid lines
        for (let i = 1; i < 8; i++) {
          const x = -width/2 + (width/8) * i;
          ctx.beginPath();
          ctx.moveTo(x, -height/2);
          ctx.lineTo(x, height/2);
          ctx.stroke();
        }
        
        // Horizontal grid lines
        for (let i = 1; i < 6; i++) {
          const y = -height/2 + (height/6) * i;
          ctx.beginPath();
          ctx.moveTo(-width/2, y);
          ctx.lineTo(width/2, y);
          ctx.stroke();
        }
      }
      
      // Floor label
      if (this.data.showLabels) {
        ctx.fillStyle = isCurrentFloor ? '#000' : '#666';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(floor.data.name || `Floor ${floor.floorId}`, 0, -height/2 - 35);
      }
      
      ctx.restore();
    },

    /**
     * Render single object - Enhanced 3D projection
     */
    renderObject(ctx, obj) {
      // Enhanced 3D coordinate transformation
      const scale = 25; // Increase scale
      const x = (obj.x || 0) * scale - 150;
      const z = (obj.z || 0) * scale - 120;
      const floorOffset = (obj.floorId - 1) * 100; // Offset consistent with floor foundation
      const y = -(obj.y || 0) * 0.3 - floorOffset;
      
      // Isometric projection transformation
      const isoX = x + z * 0.6;  // Enhanced X-axis projection
      const isoY = y + z * 0.3;  // Enhanced Y-axis projection
      
      ctx.save();
      ctx.translate(isoX, isoY);
      
      switch (obj.type) {
        case 'room':
          this.renderRoom3D(ctx, obj);
          break;
        case 'entrance':
          this.renderEntrance3D(ctx, obj);
          break;
        case 'connection':
          this.renderConnection3D(ctx, obj);
          break;
        case 'path':
          this.renderPathPoint3D(ctx, obj);
          break;
      }
      
      ctx.restore();
    },

    /**
     * Render 3D room cube - Enhanced version
     */
    renderRoom3D(ctx, room) {
      const size = 45;   // Increase room size
      const height = 60; // Increase room height
      
      // 3D isometric projection parameters - Enhanced stereoscopic effect
      const isoX = 1.2;  // Increase X projection
      const isoY = 0.8;  // Increase Y projection
      
      // Room color (varies by floor)
      const hue = (room.floorId || 1) * 60 % 360;
      const baseColor = `hsl(${200 + hue % 120}, 70%, 60%)`;
      const darkColor = `hsl(${200 + hue % 120}, 70%, 40%)`;
      const lightColor = `hsl(${200 + hue % 120}, 70%, 80%)`;
      
      ctx.save();
      
      // Draw three visible faces of the cube
      
      // 1. Front face (brightest)
      ctx.fillStyle = baseColor;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-size/2, -height/2, size, height);
      ctx.strokeRect(-size/2, -height/2, size, height);
      
      // 2. Right side face (medium brightness) - Enhanced shadow
      ctx.fillStyle = darkColor;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      
      ctx.beginPath();
      ctx.moveTo(size/2, -height/2);
      ctx.lineTo(size/2 + size * isoX * 0.8, -height/2 - size * isoY * 0.8);
      ctx.lineTo(size/2 + size * isoX * 0.8, height/2 - size * isoY * 0.8);
      ctx.lineTo(size/2, height/2);
      ctx.closePath();
      ctx.fill();
      
      // Clear shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.stroke();
      
      // 3. Top face (brightest) - Enhanced highlight
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      ctx.moveTo(-size/2, -height/2);
      ctx.lineTo(-size/2 + size * isoX * 0.8, -height/2 - size * isoY * 0.8);
      ctx.lineTo(size/2 + size * isoX * 0.8, -height/2 - size * isoY * 0.8);
      ctx.lineTo(size/2, -height/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Room label (in the center of front face)
      if (this.data.showLabels && room.data.name) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeText(room.data.name, 0, 3);
        ctx.fillText(room.data.name, 0, 3);
      }
      
      ctx.restore();
    },

    /**
     * Render 3D entrance marker
     */
    renderEntrance3D(ctx, entrance) {
      const radius = 20;
      const height = 35;
      
      // 3D isometric projection parameters
      const isoX = 0.866;
      const isoY = 0.5;
      
      ctx.save();
      
      // Cylinder base (ellipse)
      ctx.fillStyle = '#52c41a';
      ctx.strokeStyle = '#389e0d';
      ctx.lineWidth = 2;
      
      // Draw elliptical base
      ctx.beginPath();
      ctx.ellipse(0, height/2, radius, radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Cylinder side surface
      ctx.fillStyle = '#73d13d';
      ctx.beginPath();
      ctx.moveTo(-radius, height/2);
      ctx.lineTo(-radius, -height/2);
      ctx.bezierCurveTo(-radius, -height/2 - radius * 0.3, radius, -height/2 - radius * 0.3, radius, -height/2);
      ctx.lineTo(radius, height/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Cylinder top surface (ellipse)
      ctx.fillStyle = '#95de64';
      ctx.beginPath();
      ctx.ellipse(0, -height/2, radius, radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Entrance label
      if (this.data.showLabels) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#389e0d';
        ctx.lineWidth = 2;
        ctx.strokeText('Entrance', 0, 3);
        ctx.fillText('Entrance', 0, 3);
      }
      
      ctx.restore();
    },

    /**
     * Render 3D connection points
     */
    renderConnection3D(ctx, conn) {
      const size = 25;
      const height = 50;
      
      let color = '#ffa500';
      if (conn.data.type === 'elevator') {
        color = '#ff6b6b';
      } else if (conn.data.type === 'stair') {
        color = '#4ecdc4';
      }
      
      ctx.save();
      
      // Draw connection pillar
      ctx.fillStyle = color;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      
      // Main pillar body
      ctx.fillRect(-size/3, -height/2, size * 2/3, height);
      ctx.strokeRect(-size/3, -height/2, size * 2/3, height);
      
      // 3D effect side surface
      const darkerColor = this.darkenColor(color, 0.3);
      ctx.fillStyle = darkerColor;
      ctx.beginPath();
      ctx.moveTo(size/3, -height/2);
      ctx.lineTo(size/2, -height/2 - size * 0.2);
      ctx.lineTo(size/2, height/2 - size * 0.2);
      ctx.lineTo(size/3, height/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Top identifier
      ctx.fillStyle = this.lightenColor(color, 0.3);
      ctx.beginPath();
      ctx.moveTo(-size/3, -height/2);
      ctx.lineTo(-size/3 + size * 0.2, -height/2 - size * 0.2);
      ctx.lineTo(size/2, -height/2 - size * 0.2);
      ctx.lineTo(size/3, -height/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    },

    /**
     * Render 3D path points
     */
    renderPathPoint3D(ctx, pathPoint) {
      const radius = 8;
      const height = 15;
      
      ctx.save();
      
      // Path point small cylinder
      ctx.fillStyle = '#ff4d4f';
      ctx.strokeStyle = '#cf1322';
      ctx.lineWidth = 1;
      
      // Cylinder body
      ctx.fillRect(-radius/2, -height/2, radius, height);
      ctx.strokeRect(-radius/2, -height/2, radius, height);
      
      // Top circle
      ctx.beginPath();
      ctx.ellipse(0, -height/2, radius/2, radius/4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    },

    // Color processing utility functions
    darkenColor(color, amount) {
      if (color.startsWith('#')) {
        // Process hexadecimal color
        const num = parseInt(color.slice(1), 16);
        const r = Math.max(0, (num >> 16) * (1 - amount));
        const g = Math.max(0, ((num >> 8) & 0x00FF) * (1 - amount));
        const b = Math.max(0, (num & 0x0000FF) * (1 - amount));
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
      }
      return color; // If not hexadecimal, return original color
    },

    lightenColor(color, amount) {
      if (color.startsWith('#')) {
        // Process hexadecimal color
        const num = parseInt(color.slice(1), 16);
        const r = Math.min(255, (num >> 16) + (255 - (num >> 16)) * amount);
        const g = Math.min(255, ((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * amount);
        const b = Math.min(255, (num & 0x0000FF) + (255 - (num & 0x0000FF)) * amount);
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
      }
      return color; // If not hexadecimal, return original color
    },

    /**
     * Render entrance
     */
    renderEntrance(ctx, entrance) {
      const size = 30;
      
      // Entrance circle (green)
      ctx.fillStyle = '#52c41a';
      ctx.strokeStyle = '#389e0d';
      ctx.lineWidth = 3;
      
      ctx.beginPath();
      ctx.arc(0, 0, size/2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Entrance label
      if (this.data.showLabels) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Entrance', 0, 3);
      }
    },

    /**
     * Render connection points (stairs, elevators)
     */
    renderConnection(ctx, conn) {
      const size = 20;
      let color = '#ffa500'; // Default orange
      
      if (conn.data.type === 'elevator') {
        color = '#ff6b6b'; // Elevator red
      } else if (conn.data.type === 'stair') {
        color = '#4ecdc4'; // Stair cyan
      }
      
      // Connection point circle
      ctx.fillStyle = color;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.arc(0, 0, size/2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Connection line (represents vertical connection)
      if (this.data.showConnections) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -40); // Upward connection line
        ctx.stroke();
      }
    },

    /**
     * Render path points
     */
    renderPathPoint(ctx, pathPoint) {
      const size = 8;
      let color = '#ffff00'; // Default yellow
      
      if (pathPoint.index === 0) {
        color = '#00ff00'; // Start point green
      } else if (pathPoint.index === this.data.pathData.length - 1) {
        color = '#ff0000'; // End point red
      }
      
      ctx.fillStyle = color;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    },

    /**
     * Render UI information
     */
    renderUI(ctx) {
      // Simplified UI display, show detailed information only in debug mode
      const debugMode = false; // Set to false to turn off debug information
      
      if (debugMode) {
        // Display current floor information
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, 10, 200, 80);
        
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Current Floor: ${this.data.currentFloor}`, 20, 30);
        
        // Display interaction status and camera information
        ctx.fillText(`Rotation Angle: ${Math.round(this.data.cameraAngle * 57.3)}°`, 20, 50);
        ctx.fillText(`View Height: ${Math.round(this.data.cameraHeight)}`, 20, 70);
        
        if (this.data.isRotating) {
          ctx.fillStyle = '#4CAF50';
          ctx.fillText('🔄 Rotating', 20, 90);
        }
      }
    },

    /**
     * Floor selection
     */
    onFloorSelect(e) {
      const floorId = e.currentTarget.dataset.floor;
      this.setData({ currentFloor: parseInt(floorId) });
      
      // Update camera position to selected floor
      this.focusOnFloor(parseInt(floorId));
      
      // Rebuild map to update floor transparency
      this.buildMap3D();
      
      this.triggerEvent('floorchange', { floor: parseInt(floorId) });
    },

    /**
     * Focus on specified floor
     */
    focusOnFloor(floorId) {
      if (this.data.camera) {
        const targetY = (floorId - 1) * 4 + 10;
        this.data.camera.position.y = targetY;
        this.renderScene();
      }
    },

    /**
     * Touch start - Enhanced version
     */
    onTouchStart(e) {
      console.log('Touch start event:', e.touches.length, 'touch points');
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.setData({
          isRotating: true,
          lastTouchX: touch.x || touch.clientX,
          lastTouchY: touch.y || touch.clientY,
          showHint: false // Hide interaction hints
        });
        console.log('Start rotation, initial position:', this.data.lastTouchX, this.data.lastTouchY);
      }
    },

    /**
     * Touch move - Enhanced 3D control
     */
    onTouchMove(e) {
      if (!this.data.isRotating || e.touches.length !== 1) return;
      
      const touch = e.touches[0];
      const currentX = touch.x || touch.clientX;
      const currentY = touch.y || touch.clientY;
      
      const deltaX = currentX - this.data.lastTouchX;
      const deltaY = currentY - this.data.lastTouchY;
      
      console.log('Touch move:', deltaX, deltaY);
      
      // Enhanced sensitivity and viewing range
      let newCameraAngle = this.data.cameraAngle + deltaX * 0.03; // Increase rotation sensitivity
      let newCameraHeight = Math.max(2, Math.min(35, this.data.cameraHeight - deltaY * 0.1)); // Increase height range
      
      this.setData({
        cameraAngle: newCameraAngle,
        cameraHeight: newCameraHeight,
        lastTouchX: currentX,
        lastTouchY: currentY
      });
      
      // Immediately update scene
      this.renderScene();
    },

    /**
     * Touch end
     */
    onTouchEnd() {
      this.setData({ isRotating: false });
      console.log('3D scene rotation ended, current angle:', this.data.cameraAngle);
    },

    /**
     * Mouse wheel zoom control
     */
    onMouseWheel(e) {
      const delta = e.detail.deltaY;
      let newHeight = this.data.cameraHeight + delta * 0.01;
      newHeight = Math.max(2, Math.min(35, newHeight));
      
      this.setData({ cameraHeight: newHeight });
      this.renderScene();
      
      console.log('Wheel zoom, new height:', newHeight);
    },

    /**
     * Update camera position
     */
    updateCameraPosition() {
      // In simplified 3D rendering, camera parameters are directly used for rendering transformations
      this.renderScene();
    },

    /**
     * View control - Enhanced version
     */
    resetView() {
      console.log('Reset view');
      this.setData({
        cameraAngle: 3,
        cameraHeight: 15,
        cameraDistance: 20
      });
      this.renderScene();
      
      wx.showToast({
        title: 'View Reset',
        icon: 'success',
        duration: 1000
      });
    },

    topView() {
      console.log('Switch to top view');
      this.setData({
        cameraAngle: 0,
        cameraHeight: 25,
        cameraDistance: 15
      });
      this.renderScene();
      
      wx.showToast({
        title: 'Top View Mode',
        icon: 'success',
        duration: 1000
      });
    },

    sideView() {
      console.log('Switch to side view');
      this.setData({
        cameraAngle: 8,
        cameraHeight: 12,
        cameraDistance: 25
      });
      this.renderScene();
      
      wx.showToast({
        title: 'Side View Mode',
        icon: 'success',
        duration: 1000
      });
    },

    // New: Perspective view (best shows 3D effect)
    perspectiveView() {
      console.log('Switch to perspective view');
      this.setData({
        cameraAngle: 5,
        cameraHeight: 18,
        cameraDistance: 22
      });
      this.renderScene();
      
      wx.showToast({
        title: 'Perspective View Mode',
        icon: 'success',
        duration: 1000
      });
    },

    /**
     * Display option toggles
     */
    onToggleConnections(e) {
      this.setData({ showConnections: e.detail.value });
      this.buildMap3D();
    },

    onToggleLabels(e) {
      this.setData({ showLabels: e.detail.value });
      this.buildMap3D();
    },

    onTogglePath(e) {
      this.setData({ showPath: e.detail.value });
      this.buildMap3D();
    },

    /**
     * Auto-rotation demo
     */
    startAutoRotation() {
      if (this.data.autoRotationTimer) {
        clearInterval(this.data.autoRotationTimer);
      }
      
      const timer = setInterval(() => {
        if (!this.data.isRotating) { // Only auto-rotate when not manually operating
          let newAngle = this.data.cameraAngle + 0.05;
          this.setData({ cameraAngle: newAngle });
          this.renderScene();
        }
      }, 100);
      
      this.setData({ 
        autoRotationTimer: timer,
        isAutoRotating: true 
      });
      
      // Stop auto-rotation after 10 seconds
      setTimeout(() => {
        this.stopAutoRotation();
      }, 10000);
      
      console.log('Start auto-rotation demo');
    },

    stopAutoRotation() {
      if (this.data.autoRotationTimer) {
        clearInterval(this.data.autoRotationTimer);
        this.setData({ 
          autoRotationTimer: null,
          isAutoRotating: false 
        });
        console.log('Stop auto-rotation');
      }
    },

    /**
     * Collapse/expand control panel
     */
    togglePanel() {
      const collapsed = !this.data.panelCollapsed;
      this.setData({ panelCollapsed: collapsed });
      
      console.log('Control panel', collapsed ? 'collapsed' : 'expanded');
    },

    /**
     * Clean up 3D resources
     */
    cleanup3D() {
      console.log('Cleaning up 3D resources');
      
      // Stop auto-rotation
      this.stopAutoRotation();
      
      // Clean up canvas context and render data
      this.setData({
        canvasContext: null,
        renderObjects: [],
        isRotating: false,
        showHint: true,
        panelCollapsed: false
      });
    }
  }
})
