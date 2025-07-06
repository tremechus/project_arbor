import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.player = null;
    this.otherPlayers = {};
    this.fauna = {};
    this.food = {};
    this.myId = null;
    this.cursors = null;
    this.mapLayer = null;
    this.lastMoveTime = 0;
    this.ws = null;
    this.messageQueue = [];
    this.selectedAction = 'till';
    
    // Zone configuration
    this.zoneConfig = {
      maxFauna: 1  // Maximum number of fauna allowed in the zone (reduced for testing)
    };
  }

  initializeWebSocket() {
    const registryWs = this.sys.game.registry.get('ws');
    
    if (registryWs && (!this.ws || this.ws !== registryWs)) {
      console.log('[GAME] Initializing WebSocket from registry, state:', registryWs.readyState);
      this.ws = registryWs;
      this.setupWebSocketMonitoring();
      return true;
    } else if (!registryWs) {
      console.warn('[GAME] No WebSocket found in registry');
      return false;
    } else if (this.ws === registryWs) {
      console.log('[GAME] WebSocket already initialized and up to date');
      return true;
    }
    
    return false;
  }

  preload() {
    this.load.image('player', '/player.png');
    this.load.image('dragon', '/dragon.png');
    this.load.image('tiles', '/tileset.png');
    this.load.image('food', '/food.png');
    
    // Load sound effects with debugging
    console.log('[GAME] Loading fauna_spawn sound...');
    this.load.audio('fauna_spawn', ['/fauna_spawn.wav', '/fauna_spawn.mp3', '/fauna_spawn.ogg']);
    
    // Add load event listeners for debugging images
    this.load.on('filecomplete-image-player', (key, type, data) => {
        console.log('[GAME] Player image loaded:', {
            key: key,
            width: data.width,
            height: data.height
        });
    });
    
    this.load.on('filecomplete-image-dragon', (key, type, data) => {
        console.log('[GAME] Dragon image loaded:', {
            key: key,
            width: data.width,
            height: data.height
        });
    });
    
    this.load.on('filecomplete-image-food', (key, type, data) => {
        console.log('[GAME] Food image loaded:', {
            key: key,
            width: data.width,
            height: data.height
        });
    });
    
    // Add load event listeners for debugging
    this.load.on('filecomplete-audio-fauna_spawn', function () {
        console.log('[GAME] fauna_spawn audio loaded successfully');
    });
    
    this.load.on('loaderror', function (file) {
        console.error('[GAME] Error loading file:', file.key, file.url);
    });
  }

  create() {
    this.initializeWebSocket();
    this.messageQueue = this.sys.game.registry.get('messageQueue');
    this.selectedAction = this.sys.game.registry.get('selectedAction');
    
    // Debug WebSocket state at creation
    console.log('[GAME] Scene created, WebSocket state:', this.ws ? this.ws.readyState : 'null');
    console.log('[GAME] Selected action at creation:', this.selectedAction);
    
    // Setup retry mechanism for WebSocket initialization
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          console.log('[GAME] WebSocket not ready, retrying initialization...');
          this.initializeWebSocket();
        }
      },
      repeat: 10 // Try for 10 seconds
    });
    
    this.sys.game.registry.events.on('changedata', (parent, key, data) => {
        if (key === 'selectedAction') this.selectedAction = data;
        if (key === 'ws') {
            // WebSocket reference updated, set up connection monitoring
            console.log('[GAME] WebSocket updated in registry, new state:', data ? data.readyState : 'null');
            this.ws = data;
            this.setupWebSocketMonitoring();
        }
    });
    
    // Set up WebSocket connection monitoring
    this.setupWebSocketMonitoring();
    
    // Debug sound loading
    console.log('[GAME] Available sounds:', Object.keys(this.cache.audio.entries.entries));
    if (this.cache.audio.get('fauna_spawn')) {
        console.log('[GAME] fauna_spawn sound found in cache');
    } else {
        console.warn('[GAME] fauna_spawn sound NOT found in cache');
    }
    
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', () => {
      console.log('[GAME] Space bar pressed, selected action:', this.selectedAction);
      
      // Always try to get the latest WebSocket from registry
      this.initializeWebSocket();
      
      console.log('[GAME] WebSocket state after init:', this.ws ? this.ws.readyState : 'null');
      console.log('[GAME] WebSocket ready states: CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3');
      
      if (!this.player) {
        console.warn('[GAME] No player sprite found, cannot perform action');
        return;
      }
      
      console.log('[GAME] Player sprite exists, performing action');
      const message = { type: `action_${this.selectedAction}` };
      
      if (this.selectedAction === 'till') {
        message.tile = { x: Math.floor(this.player.x / 16), y: Math.floor(this.player.y / 16) };
        console.log('[GAME] Till action at tile:', message.tile);
      } else if (this.selectedAction === 'drop_food') {
        message.pos = { x: this.player.x, y: this.player.y };
        console.log('[GAME] Drop food action at position:', message.pos);
      }
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
        console.log('[GAME] Action message sent:', message);
      } else {
        console.warn('[GAME] WebSocket not connected, cannot send action');
        console.warn('[GAME] WebSocket details:', {
          exists: !!this.ws,
          readyState: this.ws ? this.ws.readyState : 'N/A',
          url: this.ws ? this.ws.url : 'N/A'
        });
        
        // Additional debugging - check what's in the registry
        const registryWs = this.sys.game.registry.get('ws');
        console.warn('[GAME] Registry WebSocket details:', {
          exists: !!registryWs,
          readyState: registryWs ? registryWs.readyState : 'N/A',
          url: registryWs ? registryWs.url : 'N/A'
        });
      }
    });
  }
  
  createEntity(id, data, texture) {
    const entity = this.physics.add.sprite(data.x, data.y, texture);
    entity.setData('entityId', id);
    
    // Debug sprite dimensions with additional texture info
    console.log(`[GAME] Creating ${texture} sprite - Width: ${entity.width}, Height: ${entity.height}, ScaleX: ${entity.scaleX}, ScaleY: ${entity.scaleY}`);
    
    // Additional debug for player sprites specifically
    if (texture === 'player') {
        console.log(`[GAME] PLAYER SPRITE DEBUG:`, {
            id: id,
            width: entity.width,
            height: entity.height,
            displayWidth: entity.displayWidth,
            displayHeight: entity.displayHeight,
            scaleX: entity.scaleX,
            scaleY: entity.scaleY,
            textureKey: entity.texture.key,
            frameWidth: entity.frame.width,
            frameHeight: entity.frame.height,
            originX: entity.originX,
            originY: entity.originY
        });
    }
    
    // Set initial depth based on sprite type
    let depthHeight;
    if (texture === 'dragon') {
        // For fauna, use base height regardless of future scaling
        depthHeight = entity.height;
    } else {
        // For other sprites, use scaled height
        depthHeight = entity.height * entity.scaleY;
    }
    
    entity.setDepth(data.y + depthHeight); // Set depth based on bottom of sprite for proper z-ordering
    if (data.name) {
        const nameTag = this.add.text(0, 0, data.name, { fontFamily: 'Arial', fontSize: 12, color: '#ffffff', stroke: '#000000', strokeThickness: 2 });
        nameTag.setOrigin(0.5, 2.0);
        nameTag.setDepth(data.y + depthHeight + 1); // Name tags should appear above sprites
        entity.setData('nameTag', nameTag);
    }
    if (texture === 'dragon') this.updateFaunaState(entity, data);
    return entity;
  }
  
  updateFaunaState(faunaSprite, faunaData) {
      if (!faunaSprite || !faunaData) return;
      switch(faunaData.stage) {
          case 'Infant': faunaSprite.setScale(0.25); break;
          case 'Young': faunaSprite.setScale(0.5); break;
          case 'Adult': faunaSprite.setScale(1.0); break;
          case 'Elderly': faunaSprite.setScale(1.5); break;
          default: faunaSprite.setScale(1.0);
      }
      if (faunaData.is_dead) {
          faunaSprite.setRotation(Phaser.Math.DegToRad(90)).setAlpha(0.7);
      } else {
          faunaSprite.setRotation(0).setAlpha(1.0);
      }
  }

  showSpeechBubble(text, playerSprite) {
    if (!playerSprite) return;
    const existingBubble = playerSprite.getData('speechBubble');
    if (existingBubble) existingBubble.destroy();
    const bubblePadding = 10, arrowHeight = 10;
    const tempText = this.add.text(0, 0, text, { fontFamily: 'Arial', fontSize: 14 });
    const bubbleWidth = tempText.width + bubblePadding, bubbleHeight = tempText.height + bubblePadding;
    tempText.destroy();
    const bubble = this.add.graphics();
    bubble.fillStyle(0xffffff, 1).fillRoundedRect(-bubbleWidth / 2, -bubbleHeight - arrowHeight, bubbleWidth, bubbleHeight, 8);
    bubble.beginPath().moveTo(-arrowHeight, -arrowHeight).lineTo(arrowHeight, -arrowHeight).lineTo(0, 0).closePath().fillPath();
    const content = this.add.text(0, -bubbleHeight / 2 - arrowHeight, text, { fontFamily: 'Arial', fontSize: 14, color: '#000000', align: 'center' }).setOrigin(0.5);
    const nameTag = playerSprite.getData('nameTag');
    const yOffset = nameTag ? nameTag.height : 0;
    const container = this.add.container(playerSprite.x, playerSprite.y - (playerSprite.height * playerSprite.scaleY / 2) - yOffset, [bubble, content]).setDepth(playerSprite.y + (playerSprite.height * playerSprite.scaleY) + 2); // Speech bubbles above name tags
    playerSprite.setData('speechBubble', container);
    this.tweens.add({ targets: container, alpha: 0, duration: 500, delay: 3500, onComplete: () => {
        if (playerSprite.getData('speechBubble') === container) playerSprite.setData('speechBubble', null);
        container.destroy();
    }});
  }

  rebuildWorld(worldData) {
    // Clear existing dynamic elements
    if (this.mapLayer) this.mapLayer.destroy();
    Object.values(this.food).forEach(f => f.destroy());
    this.food = {};
    // Clear existing fauna sprites before rebuilding
    Object.values(this.fauna).forEach(f => f.destroy());
    this.fauna = {};

    // Clear other players but preserve the main player
    Object.values(this.otherPlayers).forEach(p => {
        const bubble = p.getData('speechBubble');
        if (bubble) bubble.destroy();
        const nameTag = p.getData('nameTag');
        if (nameTag) nameTag.destroy();
        p.destroy();
    });
    this.otherPlayers = {};

    // Re-create the map
    const map = this.make.tilemap({ data: worldData.map, tileWidth: 16, tileHeight: 16 });
    const tileset = map.addTilesetImage('tiles');
    this.mapLayer = map.createLayer(0, tileset, 0, 0);

    // Re-create food
    for (const id in worldData.food) {
        if (!this.food[id]) this.food[id] = this.createEntity(id, worldData.food[id], 'food');
    }
    // Re-create fauna from the new world state
    for (const id in worldData.fauna) {
        if (!this.fauna[id]) this.fauna[id] = this.createEntity(id, worldData.fauna[id], 'dragon');
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      
      switch (message.type) {
        case 'world_state':
          console.log('[GAME] Processing world_state message');
          this.myId = message.player_id;
          this.rebuildWorld(message.world);
          
          for (const id in message.world.players) {
            const data = message.world.players[id];
            if (id === this.myId) { 
                if (!this.player) {
                    console.log('[GAME] Creating main player sprite');
                    this.player = this.createEntity(id, data, 'player');
                } else {
                    console.log('[GAME] Main player sprite already exists, updating position');
                    this.player.setPosition(data.x, data.y);
                }
            } else { 
                if (!this.otherPlayers[id]) {
                    console.log('[GAME] Creating other player sprite for ID:', id);
                    this.otherPlayers[id] = this.createEntity(id, data, 'player');
                }
            }
          }
          break;
        
        case 'world_reset':
            console.log("Received world reset command!");
            this.rebuildWorld(message.world);
            break;

        case 'zone_refresh':
            console.log('[GAME] Received zone refresh response from server');
            this.myId = message.player_id;
            this.rebuildWorld(message.world);
            
            // Rebuild all players from the refreshed data
            for (const id in message.world.players) {
                const data = message.world.players[id];
                if (id === this.myId) { 
                    if (!this.player) {
                        console.log('[GAME] Creating main player sprite during zone refresh');
                        this.player = this.createEntity(id, data, 'player');
                    } else {
                        console.log('[GAME] Main player sprite exists during zone refresh, updating position');
                        this.player.setPosition(data.x, data.y);
                    }
                } else { 
                    if (!this.otherPlayers[id]) {
                        console.log('[GAME] Creating other player sprite during zone refresh for ID:', id);
                        this.otherPlayers[id] = this.createEntity(id, data, 'player');
                    }
                }
            }
            break;

        case 'player_joined':
          if (message.player_id !== this.myId && !this.otherPlayers[message.player_id]) {
            this.otherPlayers[message.player_id] = this.createEntity(message.player_id, message.data, 'player');
          }
          break;
        
        case 'player_moved':
          const target = (message.player_id === this.myId) ? this.player : this.otherPlayers[message.player_id];
          if (target && message.player_id !== this.myId) {
            this.tweens.add({ targets: target, x: message.data.x, y: message.data.y, duration: 150, ease: 'Power1' });
          }
          break;

        case 'fauna_spawned':
            // Check if spawning would exceed max fauna limit
            const currentFaunaCount = Object.keys(this.fauna).length;
            if (currentFaunaCount >= this.zoneConfig.maxFauna) {
                console.log(`[GAME] Fauna spawn blocked: would exceed max limit of ${this.zoneConfig.maxFauna} (current: ${currentFaunaCount})`);
                break;
            }
            if (!this.fauna[message.fauna_id]) {
                this.fauna[message.fauna_id] = this.createEntity(message.fauna_id, message.data, 'dragon');
                console.log(`[GAME] Fauna spawned: ${currentFaunaCount + 1}/${this.zoneConfig.maxFauna}`);
                
                // Play fauna spawn sound effect with debugging
                try {
                    console.log('[GAME] Attempting to play fauna spawn sound...');
                    if (this.sound) {
                        // Check cache first, then try to create/get sound
                        if (this.cache.audio.get('fauna_spawn')) {
                            console.log('[GAME] Sound found in cache, attempting to play...');
                            
                            // Always create a fresh sound object for reliable playback
                            // Remove any existing sound object first
                            if (this.sound.get('fauna_spawn')) {
                                this.sound.remove('fauna_spawn');
                                console.log('[GAME] Removed existing sound object');
                            }
                            
                            // Create new sound object from cache
                            const soundObject = this.sound.add('fauna_spawn');
                            
                            if (soundObject) {
                                soundObject.play({ volume: 0.8 });
                                console.log('[GAME] Sound played successfully');
                                
                                // Clean up the sound object after it finishes playing
                                soundObject.once('complete', () => {
                                    console.log('[GAME] Sound playback completed, cleaning up...');
                                    this.sound.remove('fauna_spawn');
                                });
                            } else {
                                console.warn('[GAME] Could not create sound object');
                            }
                        } else {
                            console.warn('[GAME] fauna_spawn sound not found in cache');
                        }
                    } else {
                        console.warn('[GAME] Sound manager not available');
                    }
                } catch (error) {
                    console.error('[GAME] Error playing sound:', error);
                }
            }
            break;
            
        case 'fauna_moved':
            if (this.fauna[message.fauna_id]) {
                const faunaSprite = this.fauna[message.fauna_id];
                const targetX = message.data.x;
                const targetY = message.data.y;
                
                // Calculate distance between current position and target
                const distance = Phaser.Math.Distance.Between(faunaSprite.x, faunaSprite.y, targetX, targetY);
                
                // Only start a new movement if the distance is significant (more than 5 pixels)
                // This prevents oscillation from frequent small position updates
                if (distance > 5) {
                    // Stop any existing movement tween
                    this.tweens.killTweensOf(faunaSprite);
                    
                    // Start new movement tween with duration based on distance for more natural movement
                    const duration = Math.max(1000, Math.min(3000, distance * 20)); // 1-3 seconds based on distance
                    
                    this.tweens.add({ 
                        targets: faunaSprite, 
                        x: targetX, 
                        y: targetY, 
                        duration: duration, 
                        ease: 'Power2' 
                    });
                } else {
                    // For very small movements, just set position directly
                    faunaSprite.setPosition(targetX, targetY);
                }
            }
            break;
        
        case 'fauna_stage_changed':
        case 'fauna_died':
            if (this.fauna[message.fauna_id]) this.updateFaunaState(this.fauna[message.fauna_id], message.data);
            break;
            
        case 'fauna_removed':
            if (this.fauna[message.fauna_id]) {
                this.fauna[message.fauna_id].destroy();
                delete this.fauna[message.fauna_id];
                const remainingFaunaCount = Object.keys(this.fauna).length;
                console.log(`[GAME] Fauna removed: ${remainingFaunaCount}/${this.zoneConfig.maxFauna}`);
            }
            break;
        
        case 'food_spawned':
            if (!this.food[message.food_id]) this.food[message.food_id] = this.createEntity(message.food_id, message.data, 'food');
            break;

        case 'food_removed':
            if (this.food[message.food_id]) {
                this.food[message.food_id].destroy();
                delete this.food[message.food_id];
            }
            break;

        case 'tile_updated':
          if (this.mapLayer) this.mapLayer.putTileAt(message.tile.type, message.tile.x, message.tile.y);
          break;

        case 'player_chatted':
          let chatter = (message.player_id === this.myId) ? this.player : this.otherPlayers[message.player_id];
          this.showSpeechBubble(message.text, chatter);
          break;

        case 'player_left':
          if (this.otherPlayers[message.player_id]) {
            const bubble = this.otherPlayers[message.player_id].getData('speechBubble');
            if (bubble) bubble.destroy();
            const nameTag = this.otherPlayers[message.player_id].getData('nameTag');
            if (nameTag) nameTag.destroy();
            this.otherPlayers[message.player_id].destroy();
            delete this.otherPlayers[message.player_id];
          }
          break;
      }
    }
  }

  updateAttachedUI() {
    const updateElement = (sprite) => {
        if (!sprite) return;
        // Update depth based on bottom of sprite for proper z-ordering
        // For fauna, use base height regardless of scale to ensure consistent ordering
        let depthHeight;
        if (sprite.texture && sprite.texture.key === 'dragon') {
            // Use base sprite height for fauna, not scaled height
            depthHeight = sprite.height;
        } else {
            // For other sprites (players, food), use scaled height
            depthHeight = sprite.height * sprite.scaleY;
        }
        
        sprite.setDepth(sprite.y + depthHeight);
        
        const nameTag = sprite.getData('nameTag');
        if (nameTag) {
            nameTag.setPosition(sprite.x, sprite.y);
            nameTag.setDepth(sprite.y + depthHeight + 1); // Name tags above sprites
        }
        const speechBubble = sprite.getData('speechBubble');
        if (speechBubble) {
            const yOffset = nameTag ? nameTag.height : 0;
            const scaledHeight = sprite.height * sprite.scaleY;
            speechBubble.setPosition(sprite.x, sprite.y - (scaledHeight / 2) - yOffset);
            speechBubble.setDepth(sprite.y + depthHeight + 2); // Speech bubbles above name tags
        }
    };
    updateElement(this.player);
    for (const id in this.otherPlayers) updateElement(this.otherPlayers[id]);
    for (const id in this.fauna) updateElement(this.fauna[id]);
    for (const id in this.food) updateElement(this.food[id]);
  }

  update(time) {
    this.processMessageQueue();
    this.updateAttachedUI();
    
    // Try to ensure WebSocket is available
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.initializeWebSocket();
    }
    
    if (!this.player) {
      // Log this periodically to track when player is missing
      if (time % 1000 < 16) { // Log roughly once per second
        console.warn('[GAME] Player sprite is null in update method');
      }
      return;
    }
    
    if (!this.player.body) {
      console.warn('[GAME] Player sprite has no physics body');
      return;
    }
    
    const moveSpeed = 200;
    this.player.body.setVelocity(0);
    if (this.cursors.left.isDown) this.player.body.setVelocityX(-moveSpeed);
    else if (this.cursors.right.isDown) this.player.body.setVelocityX(moveSpeed);
    if (this.cursors.up.isDown) this.player.body.setVelocityY(-moveSpeed);
    else if (this.cursors.down.isDown) this.player.body.setVelocityY(moveSpeed);
    const isMoving = this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0;
    if (isMoving && time > this.lastMoveTime + 100) {
      const message = { type: 'player_move', x: this.player.x, y: this.player.y };
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
      this.lastMoveTime = time;
    }
  }
  
  setupWebSocketMonitoring() {
    if (!this.ws) return;
    
    // Track connection state
    this.wasConnected = this.ws.readyState === WebSocket.OPEN;
    
    // Set up event listeners for WebSocket connection changes
    const originalOnOpen = this.ws.onopen;
    const originalOnClose = this.ws.onclose;
    const originalOnError = this.ws.onerror;
    
    this.ws.onopen = (event) => {
      console.log('[GAME] WebSocket connected');
      
      // If this is a reconnection (we were previously connected), request zone refresh
      if (this.wasConnected === false) {
        console.log('[GAME] Reconnection detected, requesting zone data refresh...');
        this.requestZoneRefresh();
      }
      
      this.wasConnected = true;
      
      // Call original handler if it exists
      if (originalOnOpen) originalOnOpen.call(this.ws, event);
    };
    
    this.ws.onclose = (event) => {
      console.log('[GAME] WebSocket disconnected');
      this.wasConnected = false;
      
      // Call original handler if it exists
      if (originalOnClose) originalOnClose.call(this.ws, event);
    };
    
    this.ws.onerror = (event) => {
      console.error('[GAME] WebSocket error:', event);
      
      // Call original handler if it exists
      if (originalOnError) originalOnError.call(this.ws, event);
    };
  }
  
  requestZoneRefresh() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[GAME] Cannot request zone refresh - WebSocket not connected');
      return;
    }
    
    const refreshMessage = {
      type: 'request_zone_refresh'
    };
    
    try {
      this.ws.send(JSON.stringify(refreshMessage));
      console.log('[GAME] Zone refresh request sent to server');
    } catch (error) {
      console.error('[GAME] Error sending zone refresh request:', error);
    }
  }
}

export const Game = ({ ws, selectedAction, messageQueue }) => {
  const phaserGameRef = useRef(null);
  
  useEffect(() => {
    if (phaserGameRef.current) {
        phaserGameRef.current.registry.set('selectedAction', selectedAction);
    }
  }, [selectedAction]);

  useEffect(() => {
    const config = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: 'container',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      },
      scene: [MainScene]
    };

    // Create the game if it doesn't exist
    if (!phaserGameRef.current) {
      console.log('[GAME] Creating Phaser game instance');
      console.log('[GAME] WebSocket at game creation:', ws.current ? ws.current.readyState : 'null');
      const game = new Phaser.Game(config);
      
      // Pass the WebSocket and message queue from App.jsx to Phaser
      if (ws.current) {
        console.log('[GAME] Setting WebSocket in registry at creation, state:', ws.current.readyState);
        game.registry.set('ws', ws.current);
      } else {
        console.warn('[GAME] WebSocket is null at game creation time');
      }
      game.registry.set('messageQueue', messageQueue.current);
      game.registry.set('selectedAction', selectedAction);
      phaserGameRef.current = game;
    }

    return () => {
      console.log('[GAME] Cleanup called');
      if (phaserGameRef.current) {
        console.log('[GAME] Destroying Phaser game instance');
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  // Update game registry when props change
  useEffect(() => {
    console.log('[GAME] Props changed effect triggered');
    console.log('[GAME] WebSocket exists:', !!ws.current);
    console.log('[GAME] WebSocket state:', ws.current ? ws.current.readyState : 'null');
    console.log('[GAME] MessageQueue exists:', !!messageQueue.current);
    
    if (phaserGameRef.current) {
      if (ws.current) {
        console.log('[GAME] Updating WebSocket in registry, state:', ws.current.readyState);
        phaserGameRef.current.registry.set('ws', ws.current);
      } else {
        console.warn('[GAME] WebSocket is null when trying to update registry');
      }
      phaserGameRef.current.registry.set('messageQueue', messageQueue.current);
    } else {
      console.warn('[GAME] Phaser game instance not available when trying to update registry');
    }
  }, [ws, messageQueue]);

  // Additional effect to monitor WebSocket state changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (phaserGameRef.current && ws.current) {
        const currentWs = phaserGameRef.current.registry.get('ws');
        if (!currentWs || currentWs !== ws.current) {
          console.log('[GAME] WebSocket mismatch detected, updating registry');
          phaserGameRef.current.registry.set('ws', ws.current);
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [ws]);

  console.log('[GAME] Rendering container');
  return <div id="container" style={{ cursor: 'auto', width: '800px', height: '600px', border: '1px solid #ccc' }} />;
};
