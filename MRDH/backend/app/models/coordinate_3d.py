"""
True 3D coordinate system - clearly distinguishes 2D and 3D
"""
from typing import Tuple, List
from dataclasses import dataclass

@dataclass
class Position2D:
    """2D coordinates (only x, y)"""
    x: int
    y: int
    
    def to_tuple(self) -> Tuple[int, int]:
        return (self.x, self.y)
    
    def distance_to(self, other: 'Position2D') -> float:
        """Calculate distance to another 2D point"""
        import math
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)
    
    def __eq__(self, other):
        return self.x == other.x and self.y == other.y
    
    def __hash__(self):
        return hash((self.x, self.y))
    
    def __str__(self):
        return f"(x={self.x}, y={self.y})"

@dataclass  
class Position3D:
    """True 3D coordinates (x, y, z)"""
    x: int
    y: int
    z: int  # 🎯 Use z-axis instead of floor
    
    def to_tuple(self) -> Tuple[int, int, int]:
        return (self.x, self.y, self.z)
    
    def distance_to(self, other: 'Position3D') -> float:
        """Calculate distance to another 3D point"""
        import math
        return math.sqrt(
            (self.x - other.x)**2 + 
            (self.y - other.y)**2 + 
            (self.z - other.z)**2
        )
    
    def to_2d(self) -> Position2D:
        """Project to 2D plane (ignore z-axis)"""
        return Position2D(self.x, self.y)
    
    @property
    def floor_level(self) -> int:
        """Convert z coordinate to floor concept (for UI display)"""
        # Assume each floor height is 10 units
        return (self.z // 10) + 1
    
    @classmethod
    def from_floor(cls, x: int, y: int, floor: int) -> 'Position3D':
        """Create 3D coordinates from floor concept"""
        z = (floor - 1) * 10  # Each floor height is 10 units
        return cls(x, y, z)
    
    def __eq__(self, other):
        return self.x == other.x and self.y == other.y and self.z == other.z
    
    def __hash__(self):
        return hash((self.x, self.y, self.z))
    
    def __str__(self):
        return f"(x={self.x}, y={self.y}, z={self.z})"

class FloorLevel:
    """Floor level concept encapsulation"""
    def __init__(self, level: int, z_min: int, z_max: int):
        self.level = level  # Floor number (1, 2, 3...)
        self.z_min = z_min  # Minimum z coordinate for this floor
        self.z_max = z_max  # Maximum z coordinate for this floor
    
    def contains_z(self, z: int) -> bool:
        """Check if z coordinate belongs to this floor"""
        return self.z_min <= z <= self.z_max
    
    def center_z(self) -> int:
        """Center z coordinate of the floor"""
        return (self.z_min + self.z_max) // 2
    
    def __str__(self):
        return f"Floor {self.level} (z: {self.z_min}-{self.z_max})"

class Map2D:
    """Pure 2D map (only x, y coordinates)"""
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.grid = [[0 for _ in range(width)] for _ in range(height)]  # 2D grid
        self.rooms: List[dict] = []
        self.entrance: Position2D = Position2D(0, 0)
    
    def is_valid_position(self, pos: Position2D) -> bool:
        """Check if 2D position is valid"""
        return 0 <= pos.x < self.width and 0 <= pos.y < self.height
    
    def is_walkable(self, pos: Position2D) -> bool:
        """Check if 2D position is walkable"""
        if not self.is_valid_position(pos):
            return False
        return self.grid[pos.y][pos.x] != 1  # 1 means obstacle
    
    def get_neighbors_2d(self, pos: Position2D) -> List[Position2D]:
        """Get 2D neighbor positions"""
        neighbors = []
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:  # 4 directions
            new_pos = Position2D(pos.x + dx, pos.y + dy)
            if self.is_walkable(new_pos):
                neighbors.append(new_pos)
        return neighbors

class Map3D:
    """True 3D map (x, y, z coordinates)"""
    def __init__(self, width: int, height: int, depth: int):
        self.width = width
        self.height = height 
        self.depth = depth  # z-axis depth
        
        # 3D grid [z][y][x]
        self.grid = [[[0 for _ in range(width)] for _ in range(height)] for _ in range(depth)]
        
        self.rooms: List[dict] = []
        self.entrance: Position3D = Position3D(0, 0, 0)
        
        # Floor definitions (for UI display)
        self.floors: List[FloorLevel] = []
        self._setup_default_floors()
    
    def _setup_default_floors(self):
        """Set default floors"""
        floor_height = 10  # Each floor height
        num_floors = (self.depth + floor_height - 1) // floor_height
        
        for i in range(num_floors):
            z_min = i * floor_height
            z_max = min((i + 1) * floor_height - 1, self.depth - 1)
            floor = FloorLevel(i + 1, z_min, z_max)
            self.floors.append(floor)
    
    def is_valid_position(self, pos: Position3D) -> bool:
        """Check if 3D position is valid"""
        return (0 <= pos.x < self.width and 
                0 <= pos.y < self.height and 
                0 <= pos.z < self.depth)
    
    def is_walkable(self, pos: Position3D) -> bool:
        """Check if 3D position is walkable"""
        if not self.is_valid_position(pos):
            return False
        return self.grid[pos.z][pos.y][pos.x] != 1  # 1 means obstacle
    
    def get_neighbors_3d(self, pos: Position3D) -> List[Position3D]:
            """Get 3D neighbor positions (6 directions)"""
        neighbors = []
        # 6 directions: left, right, front, back, up, down
        for dx, dy, dz in [(-1, 0, 0), (1, 0, 0), (0, -1, 0), (0, 1, 0), (0, 0, -1), (0, 0, 1)]:
            new_pos = Position3D(pos.x + dx, pos.y + dy, pos.z + dz)
            if self.is_walkable(new_pos):
                neighbors.append(new_pos)
        return neighbors
    
    def get_floor_for_z(self, z: int) -> FloorLevel:
        """Get floor for z coordinate"""
        for floor in self.floors:
            if floor.contains_z(z):
                return floor
        # If not found, create a temporary floor
        return FloorLevel(1, 0, self.depth - 1)
    
    def get_positions_on_floor(self, floor_level: int) -> List[Position3D]:
        """Get all positions on a specified floor"""
        positions = []
        floor = next((f for f in self.floors if f.level == floor_level), None)
        if not floor:
            return positions
            
        for z in range(floor.z_min, floor.z_max + 1):
            for y in range(self.height):
                for x in range(self.width):
                    pos = Position3D(x, y, z)
                    if self.is_walkable(pos):
                        positions.append(pos)
        return positions
