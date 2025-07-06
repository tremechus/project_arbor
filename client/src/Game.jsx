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
  }

  preload() {
    this.load.image('player', '/player.png');
    this.load.image('dragon', '/dragon.png');
    this.load.image('tiles', '/tileset.png');
    this.load.image('food', '/food.png');
  }

  create() {
    this.ws = this.sys.game.registry.get('ws');
    this.messageQueue = this.sys.game.registry.get('messageQueue');
    this.selectedAction = this.sys.game.registry.get('selectedAction');
    this.sys.game.registry.events.on('changedata', (parent, key, data) => {
        if (key === 'selectedAction') this.selectedAction = data;
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', () => {
      if (!this.player) return;
      const message = { type: `action_${this.selectedAction}` };
      if (this.selectedAction === 'till') {
        message.tile = { x: Math.floor(this.player.x / 16), y: Math.floor(this.player.y / 16) };
      } else if (this.selectedAction === 'drop_food') {
        message.pos = { x: this.player.x, y: this.player.y };
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
    });
  }
  
  createEntity(id, data, texture) {
    const entity = this.physics.add.sprite(data.x, data.y, texture);
    entity.setData('entityId', id);
    entity.setDepth(1);
    if (data.name) {
        const nameTag = this.add.text(0, 0, data.name, { fontFamily: 'Arial', fontSize: 12, color: '#ffffff', stroke: '#000000', strokeThickness: 2 });
        nameTag.setOrigin(0.5, 2.0);
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
          case 'Elderly': faunaSprite.setScale(2.0); break;
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
    const container = this.add.container(playerSprite.x, playerSprite.y - (playerSprite.height / 2) - yOffset, [bubble, content]).setDepth(2);
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
          this.myId = message.player_id;
          this.rebuildWorld(message.world);
          
          for (const id in message.world.players) {
            const data = message.world.players[id];
            if (id === this.myId) { if (!this.player) this.player = this.createEntity(id, data, 'player'); } 
            else { if (!this.otherPlayers[id]) this.otherPlayers[id] = this.createEntity(id, data, 'player'); }
          }
          break;
        
        case 'world_reset':
            console.log("Received world reset command!");
            this.rebuildWorld(message.world);
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
            if (!this.fauna[message.fauna_id]) this.fauna[message.fauna_id] = this.createEntity(message.fauna_id, message.data, 'dragon');
            break;
            
        case 'fauna_moved':
            if (this.fauna[message.fauna_id]) {
                this.tweens.add({ targets: this.fauna[message.fauna_id], x: message.data.x, y: message.data.y, duration: 3000, ease: 'Linear' });
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
        const nameTag = sprite.getData('nameTag');
        if (nameTag) nameTag.setPosition(sprite.x, sprite.y);
        const speechBubble = sprite.getData('speechBubble');
        if (speechBubble) {
            const yOffset = nameTag ? nameTag.height : 0;
            speechBubble.setPosition(sprite.x, sprite.y - (sprite.height / 2) - yOffset);
        }
    };
    updateElement(this.player);
    for (const id in this.otherPlayers) updateElement(this.otherPlayers[id]);
  }

  update(time) {
    this.processMessageQueue();
    this.updateAttachedUI();
    if (!this.player || !this.player.body) return;
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
}

export const Game = ({ ws, selectedAction }) => {
  const phaserGameRef = useRef(null);
  useEffect(() => {
    if (phaserGameRef.current) phaserGameRef.current.registry.set('selectedAction', selectedAction);
  }, [selectedAction]);
  useEffect(() => {
    const config = { type: Phaser.AUTO, width: 800, height: 600, parent: 'container', physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false }, }, scene: [MainScene] };
    if (!phaserGameRef.current && ws.current) {
      const messageQueue = [];
      ws.current.onmessage = (event) => { messageQueue.push(JSON.parse(event.data)); };
      const game = new Phaser.Game(config);
      game.registry.set('ws', ws.current);
      game.registry.set('messageQueue', messageQueue);
      game.registry.set('selectedAction', selectedAction);
      phaserGameRef.current = game;
    }
    return () => { if (phaserGameRef.current) { phaserGameRef.current.destroy(true); phaserGameRef.current = null; }};
  }, [ws]);
  return <div id="container" style={{ cursor: 'auto' }} />;
};
