# Project Arbor - Technology Experiment & Learning Project

## Overview
Project Arbor is an **MMO AI experiment** designed as a technology learning project for kids to contribute to. It's a multiplayer online game that combines real-time gameplay with AI-driven fauna that exhibit complex lifecycle behaviors. The project demonstrates real-time multiplayer game development, AI behavior programming, and full-stack web development concepts.

## Architecture Overview
This is a **client-server multiplayer game** with the following technology stack:

### Server Side (Python/FastAPI)
- **Framework**: FastAPI with WebSocket support for real-time communication
- **Database**: SQLite with custom ORM-like functions for persistence
- **Game Loop**: Server-side game loop running every 3 seconds (TICK_RATE)
- **AI Management**: Sophisticated fauna lifecycle and behavior system

### Client Side (React/Phaser)
- **Frontend Framework**: React 19 with Vite for development
- **Game Engine**: Phaser 3.90.0 for 2D game rendering and interaction
- **Real-time Communication**: WebSocket connection for multiplayer features
- **UI**: Custom React components for login, chat, and player actions

## Core Game Mechanics

### World & Environment
- **Grid-based world**: 50x38 tile map stored in database
- **Tile types**: Empty (0) and Tilled (1) tiles that players can modify
- **Persistent world**: All changes saved to SQLite database
- **Food system**: Players can drop food items that fauna will seek

### Player System
- **Named players**: Unique usernames with validation (max 8 chars, alphanumeric + special chars)
- **Persistent positions**: Player locations saved and restored between sessions
- **Real-time movement**: All player actions broadcast to other connected players
- **Player actions**: 
  - `till`: Convert empty tiles to tilled tiles
  - `drop_food`: Place food items in the world
- **Chat system**: Real-time text communication between players
- **Admin commands**: Special commands like `/reset_zone` for world management

### AI Fauna System (Dragons)
This is the most sophisticated part of the project, showcasing AI programming concepts:

#### Lifecycle Stages
- **Infant** (0-120 seconds): Newly spawned, vulnerable stage
- **Young** (120-300 seconds): Actively seeks food, can mature early if fed
- **Adult** (300-900 seconds): Can reproduce, creates offspring
- **Elderly** (900+ seconds): Moves slower, will die after random lifespan (60-300 seconds)

#### AI Behaviors
- **Goal-oriented AI**: Fauna have specific goals and pathfinding
- **Food seeking**: Young dragons actively seek and consume food
- **Wandering**: Adults and elderly may randomly choose movement goals
- **Reproduction**: Adults can spawn up to 3 offspring with cooldown periods
- **Natural death**: Elderly dragons die naturally, bodies remain for 60 seconds

#### Technical Implementation
- **FaunaManager class**: Encapsulates all fauna logic and AI behaviors
- **Real-time updates**: All fauna state changes broadcast to clients
- **Database persistence**: Fauna positions, age, stage, and goals saved
- **Performance optimization**: Efficient pathfinding and state management

## Technical Architecture Details

### Server Architecture (`server/`)
1. **main.py**: 
   - FastAPI application with WebSocket endpoint (`/ws`)
   - ConnectionManager for handling multiple client connections
   - Game loop integration with fauna management
   - Player authentication and session management
   - Real-time message broadcasting to all clients

2. **fauna.py**:
   - FaunaManager class with complete AI lifecycle management
   - Configurable behavior parameters (reproduction rates, lifespans, etc.)
   - Goal-based AI system with pathfinding
   - Real-time state synchronization with database

3. **db.py**:
   - SQLite database management with custom helper functions
   - Tables: users, fauna, food, zone_tiles
   - World state loading and persistence
   - Default world initialization

### Client Architecture (`client/`)
1. **App.jsx**: 
   - Main application component with WebSocket management
   - Connection handling with automatic reconnection (max 3 attempts)
   - Player authentication flow
   - Message queue system for game updates

2. **Game.jsx**: 
   - Phaser 3 game integration (currently incomplete/placeholder)
   - WebSocket and message queue integration
   - Action system integration

3. **UI Components**:
   - **Login.jsx**: Player name selection with validation
   - **Chat.jsx**: Real-time chat interface
   - **PlayerActions.jsx**: Action selection UI (till/drop_food)
   - **ActionBar.jsx**: Logout functionality
   - **DisconnectedOverlay.jsx**: Connection failure handling

### Database Schema
```sql
users: name (PK), x, y
fauna: id (PK), kind, x, y, age_seconds, stage, is_dead, time_of_death, offspring_count, death_timer, goal
food: id (PK), x, y  
zone_tiles: x, y (composite PK), tile_type
```

## Real-time Communication Protocol
WebSocket messages handle all game interactions:

### Client → Server
- `player_join_request`: Initial connection with player name
- `player_move`: Position updates
- `player_chat`: Text messages (including admin commands)
- `action_till`: Modify tile type
- `action_drop_food`: Place food item

### Server → Client
- `join_success`/`error`: Authentication results
- `world_state`: Complete world data on join
- `player_moved`/`player_joined`/`player_left`: Player updates
- `player_chatted`: Chat messages
- `fauna_spawned`/`fauna_removed`/`fauna_moved`/`fauna_stage_changed`/`fauna_died`: AI updates
- `food_spawned`/`food_removed`: Food system updates
- `tile_updated`: World modification updates
- `world_reset`: Complete world reset (admin)

## Development & Learning Opportunities

### For Kids/Contributors
1. **Game Balance**: Adjust fauna lifecycle parameters, reproduction rates
2. **New Fauna Types**: Add different AI behaviors and species
3. **Player Actions**: Implement new tools and world interactions
4. **UI Improvements**: Enhance the game interface and visual feedback
5. **World Features**: Add new tile types, structures, or environmental systems
6. **AI Enhancements**: Improve pathfinding, add group behaviors, predator-prey relationships

### Technical Learning Areas
- **Real-time Systems**: WebSocket programming, game loops, state synchronization
- **AI Programming**: Goal-based AI, state machines, emergent behaviors
- **Database Design**: Persistent world systems, efficient queries
- **Full-stack Development**: Frontend-backend integration, API design
- **Game Development**: Phaser.js, React integration, real-time graphics

## Current State & Next Steps
- **Server**: Fully functional with sophisticated AI system
- **Client**: Basic React structure exists, but Phaser game implementation needs completion
- **Missing**: Actual 2D game rendering, sprite management, visual feedback for game actions
- **Configuration**: Hardcoded server IP (192.168.1.128) needs to be configurable

## Project Philosophy
This is designed as an **educational technology experiment** where children can:
- Learn programming concepts through game development
- Understand AI and emergent behaviors
- Experience real-time multiplayer system design
- Contribute meaningful features to a growing project
- See immediate visual results of their code changes

The codebase is well-structured with clear separation of concerns, making it accessible for learning while demonstrating professional development practices.