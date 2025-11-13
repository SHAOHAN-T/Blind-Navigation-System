"""
3D Map Data Model - supports multi-floor navigation
"""
import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Tuple

try:
    from .map import MapModel
except ImportError:
    # If relative import fails, try absolute import
    from app.models.map import MapModel

class Floor:
    """Floor model"""
    def __init__(self, floor_id: int, name: str, height: float = 3.5):
        self.id = floor_id
        self.name = name  # e.g.: "Floor 1", "Floor 2"
        self.height = height  # Floor height (meters)
        self.width = 20
        self.height_grid = 15
        self.grid = [[0 for _ in range(self.width)] for _ in range(self.height_grid)]
        self.rooms = []
        self.entrance = None  # Entrance position for this floor
    
    def is_walkable(self, x: int, y: int) -> bool:
        """Check if position is walkable"""
        if not (0 <= x < self.width and 0 <= y < self.height_grid):
            return False
        return self.grid[y][x] != 1  # 1 means obstacle
    
    def find_room_by_id(self, room_id: str):
        """Find room by room ID"""
        for room in self.rooms:
            if room["id"] == room_id:
                return room
        return None
    
    def add_room(self, room_id: str, room_name: str, x: int, y: int) -> bool:
        """Add room to this floor"""
        if not self.is_walkable(x, y):
            return False
        
        # Check if room ID already exists
        if self.find_room_by_id(room_id):
            return False
        
        self.rooms.append({
            "id": room_id,
            "name": room_name,
            "x": x,
            "y": y,
            "floor": self.id
        })
        
        # Mark as classroom door
        self.grid[y][x] = 3
        return True
    
    def remove_room(self, room_id: str) -> bool:
        """Delete room"""
        room = self.find_room_by_id(room_id)
        if not room:
            return False
        
        # Remove room marker
        self.grid[room["y"]][room["x"]] = 0
        
        # Remove from room list
        self.rooms = [r for r in self.rooms if r["id"] != room_id]
        return True
    
    def set_entrance(self, x: int, y: int) -> bool:
        """Set entrance position for this floor"""
        if not self.is_walkable(x, y):
            return False
        
        # Clear old entrance marking
        if self.entrance:
            old_x, old_y = self.entrance["x"], self.entrance["y"]
            if 0 <= old_x < self.width and 0 <= old_y < self.height_grid:
                self.grid[old_y][old_x] = 0
        
        # Set new entrance
        self.entrance = {"x": x, "y": y, "floor": self.id}
        self.grid[y][x] = 2
        return True
    
    def get_neighbors(self, x: int, y: int):
        """Get walkable neighbors of a position"""
        neighbors = []
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # Up, right, down, left
        
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if self.is_walkable(nx, ny):
                neighbors.append((nx, ny))
        
        return neighbors
        
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'height': self.height,
            'width': self.width,
            'height_grid': self.height_grid,
            'grid': self.grid,
            'rooms': self.rooms,
            'entrance': self.entrance
        }

class VerticalConnection:
    """Vertical connection (stairs, elevators, etc.)"""
    def __init__(self, connection_id: str, connection_type: str, start_floor: int, end_floor: int):
        self.id = connection_id
        self.type = connection_type  # stair, elevator, ramp, escalator
        self.start_floor = start_floor
        self.end_floor = end_floor
        self.start_pos = {"x": 0, "y": 0}
        self.end_pos = {"x": 0, "y": 0}
        self.steps = 0  # Number of stair steps
        self.duration = 30  # Estimated transit time (seconds)
        self.direction = "up" if end_floor > start_floor else "down"
        self.properties = {}  # Additional properties
        
    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'start_floor': self.start_floor,
            'end_floor': self.end_floor,
            'start_pos': self.start_pos,
            'end_pos': self.end_pos,
            'steps': self.steps,
            'duration': self.duration,
            'direction': self.direction,
            'properties': self.properties
        }

class Map3D(MapModel):
    """3D map model, inherits from original map model"""
    
    def __init__(self, map_id: int = None, name: str = "", width: int = 20, height: int = 15):
        super().__init__(map_id, name, width, height)
        
        # 3D extension properties
        self.floors = {}  # {floor_id: Floor}
        self.vertical_connections = []  # Vertical connection list
        self.current_floor = 1  # Default current floor
        self.is_3d = True  # Mark as 3D map
        
        # Create first floor by default
        self.add_floor(1, "First Floor")
        # Migrate original 2D data to first floor
        if self.entrance:
            self.floors[1].entrance = {**self.entrance, "floor": 1}
    
    def add_floor(self, floor_id: int, name: str, height: float = 3.5):
        """Add floor"""
        floor = Floor(floor_id, name, height)
        floor.width = self.width
        floor.height_grid = self.height
        floor.grid = [[0 for _ in range(self.width)] for _ in range(self.height)]
        self.floors[floor_id] = floor
        return floor
    
    def add_room_3d(self, room_id: str, room_name: str, x: int, y: int, floor: int = 1):
        """Add 3D room"""
        # Ensure floor exists
        if floor not in self.floors:
            self.add_floor(floor, f"Floor{floor}")
        
        floor_obj = self.floors[floor]
        
        # Check if position is walkable
        if not (0 <= x < floor_obj.width and 0 <= y < floor_obj.height_grid):
            return False
        if floor_obj.grid[y][x] == 1:  # Obstacle
            return False
        
        # Check if room ID already exists
        if self.find_room_by_id_3d(room_id):
            return False
        
        # Add room to floor
        room = {
            "id": room_id,
            "name": room_name,
            "x": x,
            "y": y,
            "floor": floor
        }
        floor_obj.rooms.append(room)
        
        # Mark grid
        floor_obj.grid[y][x] = 3
        
        # Keep backward compatibility
        self.rooms.append(room)
        
        self.updated_at = datetime.now().isoformat()
        return True
    
    def add_vertical_connection(self, connection_type: str, start_floor: int, end_floor: int, 
                             start_pos: dict, end_pos: dict, **properties):
        """Add vertical connection"""
        connection_id = f"{connection_type}_{start_floor}_{end_floor}_{len(self.vertical_connections)}"
        connection = VerticalConnection(connection_id, connection_type, start_floor, end_floor)
        connection.start_pos = start_pos
        connection.end_pos = end_pos
        connection.properties = properties
        
        # Set stair special properties
        if connection_type == "stair":
            connection.steps = properties.get("steps", abs(end_floor - start_floor) * 15)
            connection.duration = properties.get("duration", connection.steps * 1.2)  # 每级台阶1.2秒
        elif connection_type == "elevator":
            connection.duration = properties.get("duration", abs(end_floor - start_floor) * 5)  # 电梯每层5秒
        
        self.vertical_connections.append(connection)
        
        # Mark connection points on start and end floors
        if start_floor in self.floors:
            start_x, start_y = start_pos["x"], start_pos["y"]
            if 0 <= start_x < self.width and 0 <= start_y < self.height:
                self.floors[start_floor].grid[start_y][start_x] = 4  # 4表示垂直连接点
        
        if end_floor in self.floors:
            end_x, end_y = end_pos["x"], end_pos["y"]
            if 0 <= end_x < self.width and 0 <= end_y < self.height:
                self.floors[end_floor].grid[end_y][end_x] = 4
        
        return connection
    
    def find_room_by_id_3d(self, room_id: str):
        """Find room in all floors"""
        for floor in self.floors.values():
            for room in floor.rooms:
                if room["id"] == room_id:
                    return room
        return None
    
    def get_floor_rooms(self, floor_id: int):
        """Get rooms on a specified floor"""
        if floor_id in self.floors:
            return self.floors[floor_id].rooms
        return []
    
    def get_all_floors(self):
        """Get all floor information"""
        return list(self.floors.values())
    
    def get_vertical_connections_from_floor(self, floor_id: int):
        """Get vertical connections from a specified floor"""
        return [vc for vc in self.vertical_connections if vc.start_floor == floor_id or vc.end_floor == floor_id]
    
    def is_walkable_3d(self, x: int, y: int, floor: int) -> bool:
        """Check if 3D position is walkable"""
        if floor not in self.floors:
            return False
        
        floor_obj = self.floors[floor]
        if not (0 <= x < floor_obj.width and 0 <= y < floor_obj.height_grid):
            return False
        
        return floor_obj.grid[y][x] != 1  # 1 means obstacle
    
    def get_neighbors_3d(self, x: int, y: int, floor: int) -> List[Tuple[int, int, int]]:
        """Get walkable neighbors of a 3D position (including vertical connections)"""
        neighbors = []
        
        # Horizontal neighbors on the same floor
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # Up, right, down, left
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if self.is_walkable_3d(nx, ny, floor):
                neighbors.append((nx, ny, floor))
        
        # Check vertical connections
        for vc in self.vertical_connections:
            # From the connection point on the current floor to other floors
            if vc.start_floor == floor and vc.start_pos["x"] == x and vc.start_pos["y"] == y:
                if self.is_walkable_3d(vc.end_pos["x"], vc.end_pos["y"], vc.end_floor):
                    neighbors.append((vc.end_pos["x"], vc.end_pos["y"], vc.end_floor))
            elif vc.end_floor == floor and vc.end_pos["x"] == x and vc.end_pos["y"] == y:
                if self.is_walkable_3d(vc.start_pos["x"], vc.start_pos["y"], vc.start_floor):
                    neighbors.append((vc.start_pos["x"], vc.start_pos["y"], vc.start_floor))
        
        return neighbors
    
    def to_dict(self) -> Dict:
        """Convert to dictionary format (3D version)"""
        base_dict = super().to_dict()
        
        # Summarize all floor room data
        all_rooms = []
        main_entrance = None
        
        for floor_id, floor in self.floors.items():
            # Collect all rooms
            for room in floor.rooms:
                room_copy = room.copy()
                room_copy['floor'] = floor_id
                all_rooms.append(room_copy)
            
            # Find main entrance (use 1st floor entrance first)
            if floor.entrance and (main_entrance is None or floor_id == 1):
                main_entrance = {
                    'x': floor.entrance.get('x', 0),
                    'y': floor.entrance.get('y', 0),
                    'floor': floor_id
                }
        
        # Update base dictionary
        base_dict.update({
            # Update summarized room and entrance data (for compatibility with map management page)
            "rooms": all_rooms,
            "entrance": main_entrance if main_entrance else {"x": 0, "y": 0},
            
            # 3D extended fields
            "floors": {str(k): v.to_dict() for k, v in self.floors.items()},
            "vertical_connections": [vc.to_dict() for vc in self.vertical_connections],
            "current_floor": self.current_floor,
            "is_3d": self.is_3d,
        })
        return base_dict
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Map3D':
        """Create 3D map instance from dictionary"""
        map_instance = cls(
            map_id=data.get("id"),
            name=data.get("name", ""),
            width=data.get("width", 20),
            height=data.get("height", 15)
        )
        
        # Base properties
        map_instance.grid = data.get("grid", map_instance.grid)
        map_instance.entrance = data.get("entrance", {"x": 0, "y": 0})
        map_instance.rooms = data.get("rooms", [])
        map_instance.created_at = data.get("created_at", map_instance.created_at)
        map_instance.updated_at = data.get("updated_at", map_instance.updated_at)
        
        # 3D properties
        map_instance.current_floor = data.get("current_floor", 1)
        
        # Rebuild floor structure
        map_instance.floors = {}
        floors_data = data.get("floors", {})
        for floor_id, floor_data in floors_data.items():
            floor_obj = Floor(int(floor_id), floor_data["name"], floor_data.get("height", 3.5))
            floor_obj.width = floor_data.get("width", 20)
            floor_obj.height_grid = floor_data.get("height_grid", 15)
            floor_obj.grid = floor_data.get("grid", floor_obj.grid)
            floor_obj.rooms = floor_data.get("rooms", [])
            floor_obj.entrance = floor_data.get("entrance")
            map_instance.floors[int(floor_id)] = floor_obj
        
        # Rebuild vertical connections
        map_instance.vertical_connections = []
        connections_data = data.get("vertical_connections", [])
        for conn_data in connections_data:
            conn = VerticalConnection(
                conn_data["id"], 
                conn_data["type"],
                conn_data["start_floor"],
                conn_data["end_floor"]
            )
            conn.start_pos = conn_data.get("start_pos", {"x": 0, "y": 0})
            conn.end_pos = conn_data.get("end_pos", {"x": 0, "y": 0})
            conn.steps = conn_data.get("steps", 0)
            conn.duration = conn_data.get("duration", 30)
            conn.direction = conn_data.get("direction", "up")
            conn.properties = conn_data.get("properties", {})
            map_instance.vertical_connections.append(conn)
        
        return map_instance
