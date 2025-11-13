"""
Map data model
"""
import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from app.services.file_manager import FileManager

class MapModel:
    """Map data model"""
    
    def __init__(self, map_id: int = None, name: str = "", width: int = 20, height: int = 15):
        self.id = map_id
        self.name = name
        self.width = width
        self.height = height
        self.grid = [[0 for _ in range(width)] for _ in range(height)]  # Initialize as empty space
        self.entrance = {"x": 0, "y": 0}
        self.rooms = []
        self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()
    
    def to_dict(self) -> Dict:
        """Convert to dictionary format"""
        return {
            "id": self.id,
            "name": self.name,
            "width": self.width,
            "height": self.height,
            "grid": self.grid,
            "entrance": self.entrance,
            "rooms": self.rooms,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'MapModel':
        """Create map instance from dictionary"""
        map_instance = cls(
            map_id=data.get("id"),
            name=data.get("name", ""),
            width=data.get("width", 20),
            height=data.get("height", 15)
        )
        map_instance.grid = data.get("grid", map_instance.grid)
        map_instance.entrance = data.get("entrance", {"x": 0, "y": 0})
        map_instance.rooms = data.get("rooms", [])
        map_instance.created_at = data.get("created_at", map_instance.created_at)
        map_instance.updated_at = data.get("updated_at", map_instance.updated_at)
        return map_instance
    
    def validate(self) -> Tuple[bool, List[str]]:
        """Validate map data validity"""
        errors = []
        
        # Check basic parameters
        if not self.name:
            errors.append("Map name cannot be empty")
        
        if self.width <= 0 or self.height <= 0:
            errors.append("Map dimensions must be greater than 0")
        
        if self.width > 100 or self.height > 100:
            errors.append("Map dimensions cannot exceed 100x100")
        
        # Check grid data
        if len(self.grid) != self.height:
            errors.append("Grid height does not match set height")
        
        for row in self.grid:
            if len(row) != self.width:
                errors.append("Grid width does not match set width")
                break
            
            # Check the validity of grid values
            for cell in row:
                if cell not in [0, 1, 2, 3]:  # 0:空地 1:障碍物 2:入口 3:教室门
                    errors.append("Grid contains invalid values")
                    break
        
        # Check entrance position
        entrance_x, entrance_y = self.entrance["x"], self.entrance["y"]
        if not (0 <= entrance_x < self.width and 0 <= entrance_y < self.height):
            errors.append("Entrance position exceeds map range")
        elif self.grid[entrance_y][entrance_x] == 1:  # Obstacle
            errors.append("Entrance position cannot be an obstacle")
        
        # Check room position
        for room in self.rooms:
            room_x, room_y = room["x"], room["y"]
            if not (0 <= room_x < self.width and 0 <= room_y < self.height):
                errors.append(f"Room {room['name']} position exceeds map range")
            elif self.grid[room_y][room_x] == 1:  # 障碍物
                errors.append(f"Room {room['name']} position cannot be an obstacle")
        
        return len(errors) == 0, errors
    
    def is_walkable(self, x: int, y: int) -> bool:
        """Check if position is walkable"""
        if not (0 <= x < self.width and 0 <= y < self.height):
            return False
        return self.grid[y][x] != 1  # 1 means obstacle
    
    def get_neighbors(self, x: int, y: int) -> List[Tuple[int, int]]:
        """Get walkable neighbors of a position"""
        neighbors = []
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # Up, right, down, left
        
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if self.is_walkable(nx, ny):
                neighbors.append((nx, ny))
        
        return neighbors
    
    def find_room_by_id(self, room_id: str) -> Optional[Dict]:
        """Find room by room ID"""
        for room in self.rooms:
            if room["id"] == room_id:
                return room
        return None
    
    def add_room(self, room_id: str, room_name: str, x: int, y: int) -> bool:
        """Add room"""
        if not self.is_walkable(x, y):
            return False
        
        # Check if room ID already exists
        if self.find_room_by_id(room_id):
            return False
        
        self.rooms.append({
            "id": room_id,
            "name": room_name,
            "x": x,
            "y": y
        })
        
        # Mark as classroom door
        self.grid[y][x] = 3
        self.updated_at = datetime.now().isoformat()
        return True
    
    def remove_room(self, room_id: str) -> bool:
        """Remove room"""
        room = self.find_room_by_id(room_id)
        if not room:
            return False
        
        # Remove room mark
        self.grid[room["y"]][room["x"]] = 0
        
        # Remove room from room list
        self.rooms = [r for r in self.rooms if r["id"] != room_id]
        self.updated_at = datetime.now().isoformat()
        return True
    
    def set_entrance(self, x: int, y: int) -> bool:
        """Set entrance position"""
        if not self.is_walkable(x, y):
            return False
        
        # Clear old entrance mark
        old_x, old_y = self.entrance["x"], self.entrance["y"]
        if 0 <= old_x < self.width and 0 <= old_y < self.height:
            self.grid[old_y][old_x] = 0
        
        # Set new entrance
        self.entrance = {"x": x, "y": y}
        self.grid[y][x] = 2
        self.updated_at = datetime.now().isoformat()
        return True
